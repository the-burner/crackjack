// The round's choreography: what the player sees, in what order, and how long each moment holds.
//
// The engine reports what happened as a flat list of facts. `segment` cuts that list into units,
// each one thing happening at the table (the deal, a decision and what it led to, the dealer's
// turn, a hand's payoff). Each kind of unit has one script below, which lays out its steps and the
// pauses between them in beats of the three speed settings. To change how a moment feels, change
// its script; nothing here looks at the neighbouring units.
//
// Pause values: `pauses.dealer`, `.player` and `.payoff` come from the three speed settings.

import { DEALER_KEY } from './table-state';
import { DEALER_SPREAD_CARDS } from './layout';
import { RESULT_TONES } from './animator';
import type { Pauses, Step } from './animator';
import type { TableEvent } from './table-state';
import type { GameEvent, GameEventOf } from '@/game/engine/events';
import type { GameAction } from '@/game/engine/game';
import type { HandKey } from '@/game/engine/hand';
import type { Result } from '@/game/engine/settlement';
import type { SoundName } from '@/services/sound';

/** One thing happening at the table, and the engine's facts that make it up. */
export type Unit =
  | { kind: 'shuffle'; events: GameEvent[] }
  | { kind: 'deal'; events: GameEvent[] }
  | { kind: 'insurance'; events: GameEvent[] }
  /** The dealer looked under its up card: no blackjack, or the hole card turned and announced. */
  | { kind: 'dealerCheck'; events: GameEvent[] }
  /** The pointer reaches a hand: a face-down hand is turned over, a split hand gets its second card. */
  | { kind: 'turn'; hand: HandKey; events: GameEvent[] }
  /** A decision, and everything it led to for that hand (its cards, a split, a bust). */
  | { kind: 'decision'; hand: HandKey; action: GameAction; events: GameEvent[] }
  | { kind: 'natural'; hand: HandKey; events: GameEvent[] }
  /** A result settled during play without a decision of its own (a surrender during insurance). */
  | { kind: 'inPlay'; hand: HandKey; events: GameEvent[] }
  | { kind: 'dealer'; events: GameEvent[] }
  /** The hands still face down at the payoff, turned up. */
  | { kind: 'showdown'; events: GameEvent[] }
  | { kind: 'payoff'; hand: HandKey; events: GameEvent[] }
  /** The dealer discards what is left on the table, ready for the next bets. */
  | { kind: 'clear'; events: GameEvent[] }
  | { kind: 'other'; events: GameEvent[] };

/** What the scripts need to know about the table. */
export interface Stage {
  pauses: Pauses;
  isComputer: (key: HandKey) => boolean;
  /** Hands already swept this round; a script that sweeps one adds it. */
  swept: Set<HandKey>;
  /** A blackjack is paid at once: the dealer has checked for one. */
  sweepNaturals: boolean;
}

const handOf = (event: GameEvent): HandKey | undefined => ('hand' in event ? event.hand : undefined);
const isPlayerReveal = (event: GameEvent): event is GameEventOf<'reveal'> =>
  event.type === 'reveal' && event.hand !== DEALER_KEY;
const INSURANCE = new Set(['offerInsurance', 'insuranceTaken', 'insuranceDeclined', 'insuranceLost']);

/** Cuts the engine's facts into units, in the order the player is to see them. */
export function segment(events: readonly GameEvent[]): Unit[] {
  const units: Unit[] = [];
  let i = 0;
  /** Takes events from `i` while `belongs` holds. */
  const take = (belongs: (event: GameEvent) => boolean): GameEvent[] => {
    const out: GameEvent[] = [];
    while (i < events.length && belongs(events[i])) out.push(events[i++]);
    return out;
  };
  while (i < events.length) {
    const event = events[i];
    const hand = handOf(event);
    switch (event.type) {
      case 'shuffle':
      case 'burn':
        units.push({ kind: 'shuffle', events: [events[i++], ...take(e => e.type === 'burn')] });
        break;
      case 'roundStart': {
        const deal = take(e => e.type !== 'dealt');
        if (i < events.length) deal.push(events[i++]);
        deal.push(...take(e => e.type === 'peek' || e.type === 'conceal'));
        units.push({ kind: 'deal', events: deal });
        break;
      }
      case 'turn': {
        const turn = [events[i++]];
        // A split hand's second card comes as the pointer arrives (turned up, in a face-down game).
        if (events[i]?.type === 'card' && handOf(events[i]) === hand) {
          turn.push(events[i++]);
          turn.push(...take(e => isPlayerReveal(e) && handOf(e) === hand));
        }
        units.push({ kind: 'turn', hand: hand!, events: turn });
        break;
      }
      case 'reveal': {
        // The dealer's hole card turned outside its turn: it checked and has blackjack.
        if (!isPlayerReveal(event)) {
          units.push({ kind: 'dealerCheck', events: [events[i++], ...take(e => e.type === 'message' && !e.hand)] });
          break;
        }
        const reveals = take(e => isPlayerReveal(e) && handOf(e) === hand);
        // A face-down hand turned over for its turn.
        if (events[i]?.type === 'turn' && handOf(events[i]) === hand) {
          units.push({ kind: 'turn', hand: hand!, events: [events[i++], ...reveals] });
          break;
        }
        // A face-down hand turned over to be announced (a blackjack, a bust).
        const announced = events[i];
        if (announced?.type === 'message' && announced.hand === hand) {
          i++;
          const kind = announced.text === 'Blackjack' ? 'natural' : 'inPlay';
          units.push({ kind, hand: hand!, events: [...reveals, announced] });
          break;
        }
        // The showdown: every hand turned up and paid.
        const showdown = [...reveals, ...take(e => isPlayerReveal(e) || e.type === 'settled')];
        if (showdown.some(e => e.type === 'settled')) units.push(...payoffs(showdown));
        else units.push({ kind: 'other', events: showdown });
        break;
      }
      case 'dealerChecked':
        units.push({ kind: 'dealerCheck', events: [events[i++]] });
        break;
      case 'action': {
        const decision = [events[i++]];
        // Its consequences: the hand's cards and reveals, a double, a split, a bust announced.
        decision.push(
          ...take(e => handOf(e) === hand && e.type !== 'action' && e.type !== 'turn' && e.type !== 'settled'),
        );
        units.push({ kind: 'decision', hand: hand!, action: event.action, events: decision });
        break;
      }
      case 'message':
        if (!hand) {
          units.push({ kind: 'other', events: [events[i++]] });
        } else if (event.text === 'Blackjack') {
          units.push({ kind: 'natural', hand, events: [events[i++]] });
        } else {
          units.push({ kind: 'inPlay', hand, events: [events[i++]] });
        }
        break;
      case 'dealerTurn':
        units.push({
          kind: 'dealer',
          events: [events[i++], ...take(e => handOf(e) === DEALER_KEY || (e.type === 'message' && !e.hand))],
        });
        break;
      case 'settled':
        units.push(...payoffs(take(e => isPlayerReveal(e) || e.type === 'settled')));
        break;
      case 'clear':
        units.push({ kind: 'clear', events: [events[i++]] });
        break;
      default:
        if (INSURANCE.has(event.type)) units.push({ kind: 'insurance', events: take(e => INSURANCE.has(e.type)) });
        else units.push({ kind: 'other', events: [events[i++]] });
    }
  }
  return units;
}

/** The showdown: the hands still face down turned up, then each hand paid, in the engine's order. */
function payoffs(showdown: GameEvent[]): Unit[] {
  const reveals = showdown.filter(e => e.type === 'reveal');
  const paid = showdown
    .filter(e => e.type === 'settled')
    .map((e): Unit => ({ kind: 'payoff', hand: handOf(e)!, events: [e] }));
  return reveals.length ? [{ kind: 'showdown', events: reveals }, ...paid] : paid;
}

// --- the scripts ---------------------------------------------------------------------------

const step = (event: TableEvent, pause: number, sound: SoundName | null = null): Step => ({ event, pause, sound });
const cardSound = (event: GameEvent) => (event.type === 'card' ? 'card' : null);
/**
 * A face-down hand turns over as one moment, however many cards it holds: the pause comes after
 * the last card of a run of reveals on one hand.
 */
const turnOver = (events: readonly GameEvent[], index: number, pause: number): number => {
  const next = events[index + 1];
  return next?.type === 'reveal' && handOf(next) === handOf(events[index]) ? 0 : pause;
};
/** The share of a payoff pause that shows what a hand paid. */
const PAID_SHARE = 0.15;

/** One hand's payoff: its result, what it paid (none shown for a computer, or for a hand settled in play), then the sweep. */
function payoff(
  stage: Stage,
  shown: GameEventOf<'settled'> | { type: 'result'; hand: HandKey; result: Result },
  paid: number | null,
): Step[] {
  const { payoff: y } = stage.pauses;
  stage.swept.add(shown.hand);
  return [
    step(shown, y),
    ...(paid === null ? [] : [step({ type: 'payout', hand: shown.hand, amount: paid }, Math.round(y * PAID_SHARE))]),
    step({ type: 'sweep', hand: shown.hand }, y, RESULT_TONES[shown.result] ?? null),
  ];
}

/** A Bust or Surrender announced during play: swept at once. */
function inPlayResult(stage: Stage, event: GameEventOf<'message'> & { hand: HandKey }): Step[] {
  const result = event.text === 'Bust' ? 'Bust' : event.text === 'Surrender' ? 'Surrender' : null;
  if (!result) return [step(event, stage.pauses.payoff)];
  return payoff(stage, { type: 'result', hand: event.hand, result }, null);
}

type Script<K extends Unit['kind']> = (unit: Extract<Unit, { kind: K }>, stage: Stage) => Step[];

export const SCRIPTS: { [K in Unit['kind']]: Script<K> } = {
  /** The shuffle, then each burn card, a dealer beat apart; then a dealer beat as they go into the tray. */
  shuffle: ({ events }, { pauses: { dealer } }) => [
    ...events.map(event =>
      event.type === 'shuffle'
        ? step(event, dealer, 'shuffle')
        : step(event, event.type === 'burn' ? dealer : 0, 'card'),
    ),
    ...(events.some(e => e.type === 'burn') ? [step({ type: 'burnsToTray' }, dealer)] : []),
  ],

  /**
   * A dealer beat after each card. As in the original, the up card is dealt face down and turned
   * once every card is out, a dealer beat before any glimpse of the hole card.
   */
  deal: ({ events }, stage) => {
    const { dealer } = stage.pauses;
    const up = events.find(e => e.type === 'card' && e.hand === DEALER_KEY && e.cardIndex === 0);
    return events.flatMap((event): Step[] => {
      if (event.type === 'card') return [step(event === up ? { ...event, faceUp: false } : event, dealer, 'card')];
      if (event.type === 'dealt' && up?.type === 'card')
        return [step({ type: 'reveal', hand: DEALER_KEY, cardIndex: 0, card: up.card }, dealer), step(event, 0)];
      // The glimpse of the hole card lasts a dealer beat.
      if (event.type === 'peek') return [step(event, dealer)];
      return [step(event, 0)];
    });
  },

  /** The player's insurance stake shows a player beat before the dealer checks; lost, it is taken at the payoff's pace. */
  insurance: ({ events }, { pauses }) =>
    events.map(event =>
      step(event, event.type === 'insuranceTaken' ? pauses.player : event.type === 'insuranceLost' ? pauses.payoff : 0),
    ),

  /** Found: the hole card turns and the dealer announces its blackjack, a dealer beat each. */
  dealerCheck: ({ events }, { pauses }) =>
    events.map(event => step(event, event.type === 'reveal' || event.type === 'message' ? pauses.dealer : 0)),

  /**
   * The pointer moves; a face-down hand is turned over first, in a player beat. A split hand's
   * pointer rests a player beat before its second card, which shows for one too.
   */
  turn: ({ events }, stage) => {
    const { player } = stage.pauses;
    const turn = events.find(e => e.type === 'turn')!;
    const revealed = events.filter(e => e.type === 'reveal');
    const reveals = revealed.map((e, i) => step(e, turnOver(revealed, i, player)));
    const card = events.find(e => e.type === 'card');
    return card ? [step(turn, player), step(card, player, 'card'), ...reveals] : [...reveals, step(turn, 0)];
  },

  /**
   * A computer seat takes a beat over each of its decisions; the player's own take no time of
   * their own. Each card, split and double of the player's shows for a player beat.
   */
  decision: (unit, stage) => {
    const { player } = stage.pauses;
    const computer = stage.isComputer(unit.hand);
    return unit.events.flatMap((event, index): Step[] => {
      switch (event.type) {
        case 'action':
          return [step(event, computer ? player : 0)];
        // A computer's double is in its decision's beat.
        case 'double':
          return [step(event, computer ? 0 : player)];
        case 'split':
          return [step(event, player)];
        case 'card':
          return [step(event, player, 'card')];
        case 'reveal':
          return [step(event, turnOver(unit.events, index, player))];
        case 'message':
          return event.hand ? inPlayResult(stage, { ...event, hand: event.hand }) : [step(event, stage.pauses.dealer)];
        default:
          return [step(event, 0)];
      }
    });
  },

  /** The pointer rests a beat on a blackjack; paid at once once the dealer has checked, else announced and paid at the payoff. */
  natural: ({ events, hand }, stage) => {
    // A face-down blackjack is turned over first, in a player beat.
    const revealed = events.filter(e => e.type === 'reveal');
    const reveals = revealed.map((e, i) => step(e, turnOver(revealed, i, stage.pauses.player)));
    const pointer = step({ type: 'turn', hand }, stage.pauses.player);
    if (!stage.sweepNaturals)
      return [...reveals, pointer, ...events.filter(e => e.type === 'message').map(e => step(e, stage.pauses.payoff))];
    return [...reveals, pointer, ...payoff(stage, { type: 'result', hand, result: '21' }, null)];
  },

  inPlay: ({ events, hand }, stage) =>
    events.flatMap((event, index) =>
      event.type === 'message'
        ? inPlayResult(stage, { ...event, hand })
        : [step(event, event.type === 'reveal' ? turnOver(events, index, stage.pauses.player) : 0)],
    ),

  /** The hole card turns and each draw lands a dealer beat apart; the cards close up a beat before a fifth. */
  dealer: ({ events }, stage) => {
    const { dealer } = stage.pauses;
    return events.flatMap((event): Step[] => {
      if (event.type === 'card' && event.cardIndex === DEALER_SPREAD_CARDS)
        return [step({ type: 'squeeze', hand: DEALER_KEY }, dealer), step(event, dealer, 'card')];
      if (event.type === 'card' || event.type === 'reveal') return [step(event, dealer, cardSound(event))];
      // The dealer's own announcement.
      if (event.type === 'message') return [step(event, dealer)];
      return [step(event, 0)];
    });
  },

  /** Every hand still face down at the showdown is turned up, a player beat a hand. */
  showdown: ({ events }, stage) =>
    events.map((event, index) => step(event, turnOver(events, index, stage.pauses.player))),

  /** A hand paid at the payoff; one already swept in play only changes the bankroll. */
  payoff: ({ events, hand }, stage) =>
    events.flatMap(event => {
      if (event.type !== 'settled') return [step(event, 0)];
      if (stage.swept.has(hand)) return [step(event, 0)];
      return payoff(stage, event, stage.isComputer(hand) ? null : event.payout);
    }),

  /** The table rests a dealer beat once the dealer has discarded, before the bets are asked for. */
  clear: ({ events }, stage) => events.map(event => step(event, stage.pauses.dealer)),

  /** Anything else: a table message (the dealer's) holds a dealer beat; a card on its own (after a reshuffle mid-hand) a player's or dealer's. */
  other: ({ events }, stage) =>
    events.map(event => {
      if (event.type === 'message') return step(event, stage.pauses.dealer);
      if (event.type === 'card')
        return step(event, event.hand === DEALER_KEY ? stage.pauses.dealer : stage.pauses.player, 'card');
      return step(event, 0);
    }),
};

/** The timeline for a run of engine events: cut into units, each played by its script. */
export function planSteps(
  events: readonly GameEvent[],
  {
    pauses,
    isComputer = () => false,
    swept = new Set(),
    sweepNaturals = true,
  }: Partial<Omit<Stage, 'pauses'>> & { pauses: Pauses },
): Step[] {
  const stage: Stage = { pauses, isComputer, swept, sweepNaturals };
  return segment(events).flatMap(unit => (SCRIPTS[unit.kind] as Script<typeof unit.kind>)(unit as never, stage));
}
