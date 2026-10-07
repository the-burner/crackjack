// Running count, true count and side counts for the selected counting system.

import type { CardId } from './cards';
import type { Strategy } from './strategy/strategy-tables';

/** How the true count divisor (decks remaining) is estimated. */
export const TC_DIVISION = { fullDeck: 0, halfDeck: 1, quarterDeck: 2, exact: 3 } as const;
export type TcDivision = (typeof TC_DIVISION)[keyof typeof TC_DIVISION];
/** Resolution used once less than one deck remains. */
export const TC_LAST_DECK = { halfDeck: 1, quarterDeck: 2, exact: 3 } as const;
export type TcLastDeck = (typeof TC_LAST_DECK)[keyof typeof TC_LAST_DECK];
/** How the true count is rounded to an integer. */
export const TC_ROUNDING = { round: 0, truncate: 1, floor: 2 } as const;
export type TcRounding = (typeof TC_ROUNDING)[keyof typeof TC_ROUNDING];
/** Which cards count as "gone" when estimating decks remaining (game only). */
export const TC_REMAINING = { dealt: 0, shown: 1, inTray: 2 } as const;
export type TcRemaining = (typeof TC_REMAINING)[keyof typeof TC_REMAINING];

/** Per strategy file: what the true count is measured per. */
export const COUNT_UNIT = { halfDeck: 0, deck: 1, runningOnly: 2, quarterDeck: 3 } as const;
export type CountUnit = (typeof COUNT_UNIT)[keyof typeof COUNT_UNIT];

/** A count value of 10000 means the card counts +1 only when it is a red card (e.g. Red Seven). */
const RED_ONLY = 10000;

/** 0 = nearest, 1 = round up, 2 = nearest (slightly biased up). */
export type DeckEstimate = 0 | 1 | 2;

export interface DecksRemainingParams {
  decks: number;
  /** Cards considered gone from the shoe. */
  cardsGone: number;
  /** Default 52. */
  cardsPerDeck?: number;
  /** Cards removed from the shoe before play (deck editing). Default 0. */
  removedCards?: number;
  /** COUNT_UNIT of the strategy (a number read from its file). */
  countUnit: number;
  division: TcDivision;
  lastDeck: TcLastDeck;
  /** Default 0. */
  estimate?: DeckEstimate;
}

/** Estimated decks remaining, used as the true count divisor. */
export function decksRemaining({
  decks,
  cardsGone,
  cardsPerDeck = 52,
  removedCards = 0,
  countUnit,
  division,
  lastDeck,
  estimate = 0,
}: DecksRemainingParams): number {
  const exact = (decks * cardsPerDeck - cardsGone + removedCards) / cardsPerDeck;
  let resolution: TcDivision = exact < 1 ? lastDeck : division;
  if (countUnit === COUNT_UNIT.halfDeck && resolution === TC_DIVISION.fullDeck) resolution = TC_DIVISION.halfDeck;
  const steps = [1, 2, 4][resolution];
  let dl;
  if (resolution === TC_DIVISION.exact) dl = exact;
  else {
    const bias = [
      [0.499, 0.249, 0.1249],
      [0.999, 0.499, 0.249],
      [0.999 * 0.95, 0.499 * 0.95, 0.249 * 0.95],
    ][estimate][resolution];
    dl = truncate(steps * (exact + bias)) / steps;
  }
  return dl < 0.1 ? 0.1 : dl;
}

/** VBScript-style Fix() as used for estimates (always applied to positive values here). */
function truncate(n: number): number {
  const i = Math.floor(n);
  return i < 0 ? i + 1 : i;
}

export function roundTrueCount(value: number, rounding: TcRounding): number {
  if (rounding === TC_ROUNDING.round) return Math.round(value);
  if (rounding === TC_ROUNDING.truncate) return Math.trunc(value) + 0; // + 0 turns -0 into 0
  return Math.floor(value);
}

/** True count settings a Counter works with. */
export interface CounterSettings {
  division: TcDivision;
  lastDeck: TcLastDeck;
  rounding: TcRounding;
  estimate?: DeckEstimate;
  aceSideCount?: boolean;
}

/**
 * Tracks the counts for one shoe.
 *
 * Card ids are 1..52 (13 per suit). For red/black systems ids above 25 use
 * the strategy's main values and the rest the "black" values.
 */
export class Counter {
  strategy: Strategy;
  settings: CounterSettings;
  decks = 0;
  cardsPerDeck = 52;
  removedCards = 0;
  running = 0;
  trueCount = 0;
  exactTrueCount = 0;
  betCount = 0;
  aces = 0;
  tens = 0;

  /** `strategy` is the result of buildStrategy(). */
  constructor(strategy: Strategy, settings: CounterSettings) {
    this.strategy = strategy;
    this.settings = settings;
    this.reset(strategy.decks);
  }

  /** Starts a new shoe. */
  reset(
    decks = this.decks,
    { cardsPerDeck = 52, removedCards = 0 }: { cardsPerDeck?: number; removedCards?: number } = {},
  ) {
    this.decks = decks;
    this.cardsPerDeck = cardsPerDeck;
    this.removedCards = removedCards;
    this.running = this.strategy.initialRunningCount[decks - 1];
    this.trueCount = this.running;
    this.exactTrueCount = 0;
    this.betCount = this.running;
    this.aces = 0;
    this.tens = 0;
  }

  /** Adds a seen card, then recomputes the true count with `cardsGone` cards gone. */
  addCard(cardId: CardId, cardsGone: number): void {
    const { countValues, countValuesBlack, kiss } = this.strategy;
    let rank = ((cardId - 1) % 13) + 1;
    const exactRank = rank;
    if (rank > 10) rank = 10;
    if (countValues[rank] === RED_ONLY) {
      if (cardId > 25) this.running += 1;
    } else if (!(exactRank === 10 && kiss)) {
      this.running += (cardId > 25 ? countValues[rank] : countValuesBlack[rank]) / 10;
    }
    if (rank === 1) this.aces += 1;
    this.tens += rank === 10 ? -2 : 1;
    this.update(cardsGone);
  }

  decksRemaining(cardsGone: number): number {
    return decksRemaining({
      decks: this.decks,
      cardsGone,
      cardsPerDeck: this.cardsPerDeck,
      removedCards: this.removedCards,
      countUnit: this.strategy.trueCountType,
      division: this.settings.division,
      lastDeck: this.settings.lastDeck,
      estimate: this.settings.estimate ?? 0,
    });
  }

  /** Recomputes the true count and bet count. */
  update(cardsGone: number): void {
    const unit = this.strategy.trueCountType;
    const { rounding } = this.settings;
    const cardsLeft = this.decks * this.cardsPerDeck > cardsGone;
    const perDeck: Partial<Record<number, number>> = {
      [COUNT_UNIT.halfDeck]: 2,
      [COUNT_UNIT.quarterDeck]: 4,
      [COUNT_UNIT.deck]: 1,
    };
    const per = perDeck[unit];
    if (cardsLeft && per) {
      const divisor = this.decksRemaining(cardsGone) * per;
      this.exactTrueCount = this.running / divisor;
      this.trueCount = roundTrueCount(this.running / divisor, rounding);
    }
    if (unit === COUNT_UNIT.runningOnly) this.trueCount = this.running;
    this.betCount = this.trueCount;

    // Ace side count: adjust the bet count for aces dealt versus expected.
    if (this.strategy.countValues[1] === 0 && this.settings.aceSideCount) {
      const dl = this.decksRemaining(cardsGone);
      const adjusted =
        ((((this.decks - dl) * 52) / 13 - this.aces) * Math.abs(this.strategy.countValues[10])) / 10 + this.running;
      if (cardsLeft && per) this.betCount = roundTrueCount(adjusted / (dl * per), rounding);
      if (unit === COUNT_UNIT.runningOnly) this.betCount = adjusted;
    }
  }

  /** The count used for playing and insurance decisions. */
  get playCount(): number {
    return this.trueCount;
  }
}
