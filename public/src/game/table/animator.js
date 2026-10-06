// Playing engine events back at the user's chosen speeds.
//
// The engine runs to completion and reports what happened; this turns that list
// into a timeline of steps with a pause and a sound each, and plays it one step
// at a time. Input is blocked while a timeline is playing, so a tap cannot land
// in the middle of an animation and corrupt the queue.

import { DEALER_KEY } from './table-state.js';

/** Speeds are 1..100; speed s is a pause of (101-s)/120 s. */
export const pauseForSpeed = speed => Math.round(((101 - clampSpeed(speed)) / 120) * 1000);

const clampSpeed = speed => Math.min(100, Math.max(1, Number(speed) || 1));

/** Sounds played for a settled hand, by result. */
const RESULT_SOUNDS = { Win: 'win', '21': 'win', Bonus: 'win', Lose: 'lose', Bust: 'lose', Surrender: 'lose', Push: 'push' };

/** Results the original swept off the table as soon as they happened, not at the payoff. */
const SWEPT_IN_PLAY = { Bust: 'Bust', Surrender: 'Surrender', Blackjack: '21' };

/** Events that only change what is on screen, with no pause of their own. */
const INSTANT = new Set(['roundStart', 'dealt', 'offerInsurance', 'insuranceDeclined', 'turn', 'action', 'dealerTurn', 'clear', 'conceal']);

/** How long the dealer's hole card flashes when the player catches sight of it. */
const PEEK_MS = 500;

/**
 * Turns engine events into timeline steps.
 * @param {object[]} events
 * @param {object} o
 * @param {{dealer: number, player: number, payoff: number}} o.pauses  In milliseconds.
 * @param {(handKey: string) => boolean} [o.isComputer]  Computer seats never show an amount at the payoff.
 * @param {Set<string>} [o.swept]  Hands already swept this round; planning a sweep adds to it.
 * @param {boolean} [o.sweepNaturals]  A blackjack is paid at once (the dealer has checked for one).
 * @returns {{event: object, pause: number, sound: string|null}[]}
 */
export function planSteps(events, { pauses, isComputer = () => false, swept = new Set(), sweepNaturals = true }) {
  const expanded = upcardDealtFaceDown(events);
  // The initial deal runs at the dealer's speed; cards drawn in play do not.
  const dealEnds = expanded.findIndex(e => e.type === 'dealt');
  // The burn cards are shown, then gathered into the tray after the last of them.
  const lastBurn = expanded.findLastIndex(e => e.type === 'burn');
  return expanded.flatMap((event, index) => {
    if (index === lastBurn) {
      return [
        { event, pause: pauseFor(event, pauses, false), sound: soundFor(event) },
        { event: { type: 'burnsToTray' }, pause: pauses.dealer, sound: null },
      ];
    }
    const dealing = dealEnds >= 0 && index <= dealEnds;
    const inPlay = event.type === 'message' && event.hand ? SWEPT_IN_PLAY[event.text] : null;
    if (inPlay && (inPlay !== '21' || sweepNaturals)) {
      swept.add(event.hand);
      return payoff({ type: 'result', hand: event.hand, result: inPlay }, null, pauses);
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
function payoff(event, payout, pauses) {
  const steps = [{ event, pause: pauses.payoff, sound: null }];
  if (payout !== null) steps.push({ event: { type: 'payout', hand: event.hand, amount: payout }, pause: Math.round(pauses.payoff * 0.15), sound: null });
  steps.push({ event: { type: 'sweep', hand: event.hand }, pause: pauses.payoff, sound: RESULT_SOUNDS[event.result] ?? null });
  return steps;
}

/**
 * As in the original, the dealer's up card is dealt face down like the hole
 * card, and turned over once every card is out.
 */
export function upcardDealtFaceDown(events) {
  const dealt = events.findIndex(e => e.type === 'dealt');
  const up = events.findIndex(e => e.type === 'card' && e.hand === DEALER_KEY && e.cardIndex === 0);
  if (dealt < 0 || up < 0 || up > dealt) return events;
  const out = events.slice();
  out[up] = { ...out[up], faceUp: false };
  out.splice(dealt, 0, { type: 'reveal', hand: DEALER_KEY, cardIndex: 0, card: out[up].card });
  return out;
}

function pauseFor(event, pauses, dealing) {
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

function soundFor(event) {
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
 * @param {object} o
 * @param {(step: object) => void} o.onStep
 * @param {() => void} [o.onIdle]
 * @param {(fn: () => void, ms: number) => *} [o.schedule]  Injected for tests.
 * @param {(handle: *) => void} [o.unschedule]
 */
export function createAnimator({ onStep, onIdle, schedule = setTimeout, unschedule = clearTimeout }) {
  let queue = [];
  let timer = null;
  let playing = false;

  const runNext = () => {
    timer = null;
    if (queue.length === 0) {
      playing = false;
      onIdle?.();
      return;
    }
    const step = queue.shift();
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
    play(steps) {
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
      while (queue.length > 0) onStep(queue.shift());
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
