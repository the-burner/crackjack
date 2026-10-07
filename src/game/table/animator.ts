// Playing engine events back at the user's chosen speeds.
//
// The engine runs to completion and reports what happened; this turns that list
// into a timeline of steps with a pause and a sound each, and plays it one step
// at a time. Input is blocked while a timeline is playing, so a tap cannot land
// in the middle of an animation and corrupt the queue.

import { DEALER_KEY } from './table-state';
import type { TableEvent } from './table-state';
import type { HandKey } from '@/game/engine/hand';
import type { GameEvent, MessageText } from '@/game/engine/events';
import type { Result } from '@/game/engine/settlement';
import type { SoundName } from '@/services/sound';

/** Speeds are 1..100; speed s is a pause of (101-s)/120 s. */
export const pauseForSpeed = (speed: number): number => Math.round(((101 - clampSpeed(speed)) / 120) * 1000);

const clampSpeed = (speed: number) => Math.min(100, Math.max(1, Number(speed) || 1));

/**
 * The original's tone for a result: the colour on the chips and the sound
 * played as a settled hand is swept.
 */
export const RESULT_TONES: Partial<Record<Result, 'win' | 'lose' | 'push'>> = {
  Win: 'win',
  21: 'win',
  Bonus: 'win',
  Lose: 'lose',
  Bust: 'lose',
  Surrender: 'lose',
  Push: 'push',
};

/** Results the original swept off the table as soon as they happened, not at the payoff. */
const SWEPT_IN_PLAY: Partial<Record<MessageText, Result>> = { Bust: 'Bust', Surrender: 'Surrender', Blackjack: '21' };

/** Pauses in milliseconds. */
export interface Pauses {
  dealer: number;
  player: number;
  payoff: number;
}

/** One step of a timeline: an event, the pause after it and its sound. */
export interface Step {
  event: TableEvent;
  pause: number;
  sound: SoundName | null;
}

/** Events that only change what is on screen, with no pause of their own. */
const INSTANT = new Set<TableEvent['type']>([
  'roundStart',
  'dealt',
  'offerInsurance',
  'insuranceDeclined',
  'turn',
  'action',
  'dealerTurn',
  'clear',
  'conceal',
]);

/** How long the dealer's hole card flashes when the player catches sight of it. */
const PEEK_MS = 500;

/**
 * Turns engine events into timeline steps.
 * @param isComputer  Computer seats never show an amount at the payoff.
 * @param swept  Hands already swept this round; planning a sweep adds to it.
 * @param sweepNaturals  A blackjack is paid at once (the dealer has checked for one).
 */
export function planSteps(
  events: readonly GameEvent[],
  {
    pauses,
    isComputer = () => false,
    swept = new Set(),
    sweepNaturals = true,
  }: {
    pauses: Pauses;
    isComputer?: (key: HandKey) => boolean;
    swept?: Set<HandKey>;
    sweepNaturals?: boolean;
  },
): Step[] {
  const expanded = upcardDealtFaceDown(events);
  // The initial deal runs at the dealer's speed; cards drawn in play do not.
  const dealEnds = expanded.findIndex(e => e.type === 'dealt');
  // The burn cards are shown, then gathered into the tray after the last of them.
  const lastBurn = expanded.findLastIndex(e => e.type === 'burn');
  return expanded.flatMap((event, index): Step[] => {
    if (index === lastBurn) {
      return [
        { event, pause: pauseFor(event, pauses, false), sound: soundFor(event) },
        { event: { type: 'burnsToTray' }, pause: pauses.dealer, sound: null },
      ];
    }
    const dealing = dealEnds >= 0 && index <= dealEnds;
    if (event.type === 'message' && event.hand) {
      const inPlay = SWEPT_IN_PLAY[event.text];
      if (inPlay && (inPlay !== '21' || sweepNaturals)) {
        swept.add(event.hand);
        return payoff({ type: 'result', hand: event.hand, result: inPlay }, null, pauses);
      }
    }
    if (event.type === 'settled') {
      // Paid already: only the bankroll changes.
      if (swept.has(event.hand)) return [{ event, pause: 0, sound: null }];
      swept.add(event.hand);
      return payoff(event, isComputer(event.hand) ? null : event.payout, pauses);
    }
    // The pointer rests on a computer hand long enough to be seen, even when it stands.
    if (event.type === 'turn' && isComputer(event.hand)) return [{ event, pause: pauses.player, sound: null }];
    return [{ event, pause: pauseFor(event, pauses, dealing), sound: soundFor(event) }];
  });
}

/** As in the original: the result on the seat's chips, what it paid, then the cards are swept. */
function payoff(
  event: Extract<TableEvent, { type: 'result' | 'settled' }>,
  payout: number | null,
  pauses: Pauses,
): Step[] {
  const steps: Step[] = [{ event, pause: pauses.payoff, sound: null }];
  if (payout !== null)
    steps.push({
      event: { type: 'payout', hand: event.hand, amount: payout },
      pause: Math.round(pauses.payoff * 0.15),
      sound: null,
    });
  steps.push({
    event: { type: 'sweep', hand: event.hand },
    pause: pauses.payoff,
    sound: RESULT_TONES[event.result] ?? null,
  });
  return steps;
}

/**
 * As in the original, the dealer's up card is dealt face down like the hole
 * card, and turned over once every card is out.
 */
export function upcardDealtFaceDown(events: readonly GameEvent[]): readonly GameEvent[] {
  const dealt = events.findIndex(e => e.type === 'dealt');
  const up = events.findIndex(e => e.type === 'card' && e.hand === DEALER_KEY && e.cardIndex === 0);
  if (dealt < 0 || up < 0 || up > dealt) return events;
  const upcard = events[up];
  if (upcard.type !== 'card') return events;
  const out = events.slice();
  out[up] = { ...upcard, faceUp: false };
  out.splice(dealt, 0, { type: 'reveal', hand: DEALER_KEY, cardIndex: 0, card: upcard.card });
  return out;
}

function pauseFor(event: TableEvent, pauses: Pauses, dealing: boolean): number {
  if (INSTANT.has(event.type)) return 0;
  switch (event.type) {
    case 'card':
    case 'reveal':
      // The dealer deals the round and plays its own hand; a player's own draws are slower.
      if (dealing || event.hand === DEALER_KEY) return pauses.dealer;
      return pauses.player;
    case 'split':
    case 'double':
      return pauses.player;
    case 'peek':
      return PEEK_MS;
    // The insurance stake is put down and seen before the dealer checks.
    case 'insuranceTaken':
      return pauses.dealer;
    case 'shuffle':
    case 'burn':
      return pauses.dealer;
    default:
      return pauses.payoff;
  }
}

function soundFor(event: TableEvent): SoundName | null {
  switch (event.type) {
    case 'card':
    case 'burn':
      return 'card';
    case 'shuffle':
      return 'shuffle';
    default:
      return null;
  }
}

/**
 * Plays timelines one step at a time.
 *
 * `onStep` applies a step to the screen; `onIdle` runs when the queue empties,
 * which is when the screen may accept input again.
 * @param schedule  Injected for tests.
 */
export function createAnimator({
  onStep,
  onIdle,
  schedule = setTimeout,
  unschedule = clearTimeout,
}: {
  onStep: (step: Step) => void;
  onIdle?: () => void;
  schedule?: (fn: () => void, ms: number) => number;
  unschedule?: (handle: number) => void;
}) {
  let queue: Step[] = [];
  let timer: number | null = null;
  let playing = false;

  const runNext = () => {
    timer = null;
    const step = queue.shift();
    if (!step) {
      playing = false;
      onIdle?.();
      return;
    }
    onStep(step);
    if (step.pause > 0) {
      timer = schedule(runNext, step.pause);
      return;
    }
    runNext();
  };

  return {
    /** True while steps are still being played: the screen must ignore input. */
    get busy() {
      return playing;
    },

    /** Adds steps to the queue and starts playing if it was idle. */
    play(steps: Step[]) {
      if (steps.length === 0) {
        if (!playing) onIdle?.();
        return;
      }
      queue.push(...steps);
      if (playing) return;
      playing = true;
      runNext();
    },

    /** Plays every remaining step at once, without pauses. */
    finish() {
      if (timer !== null) unschedule(timer);
      timer = null;
      for (let step = queue.shift(); step; step = queue.shift()) onStep(step);
      playing = false;
      onIdle?.();
    },

    /** Throws the queue away (leaving the table). */
    cancel() {
      if (timer !== null) unschedule(timer);
      timer = null;
      queue = [];
      playing = false;
    },
  };
}
