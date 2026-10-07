// The counts the Count and Full table drills ask for.
//
// They are taken at the moment a test starts, and the true count never divides
// by less than a quarter of a deck. The ace-adjusted counts only make sense for
// one kind of counting system each: the bet count for systems that ignore aces,
// the play and insurance counts for systems that count them.

import { COUNT_UNIT, roundTrueCount } from '../../core/counting.ts';
import type { Strategy } from '../../core/strategy/strategy-tables.ts';
import type { DrillShoe } from './shoe.ts';

/** True-count units per deck, by COUNT_UNIT; running-count-only systems have none. */
export const UNITS_PER_DECK: Readonly<Partial<Record<number, number>>> = {
  [COUNT_UNIT.halfDeck]: 2,
  [COUNT_UNIT.quarterDeck]: 4,
  [COUNT_UNIT.deck]: 1,
};

/**
 * Clears the floating-point dust a division leaves behind, so a count that is
 * mathematically a whole number is not floored to the one below.
 */
const tidy = (value: number): number => Math.round(value * 1e9) / 1e9;

/** True when the counting system gives aces no count value, so an ace side count helps the bet. */
export const isAceNeutral = (strategy: Pick<Strategy, 'countValues'>): boolean => strategy.countValues[1] === 0;

/** All the counts a test can ask for. */
export interface DrillCounts {
  runningCount: number;
  trueCount: number;
  betCount: number;
  playCount: number;
  insureCount: number;
  aces: number;
  tens: number;
  acesLeft: number;
}

/** Drills that stop once every ace has been dealt. */
export const isAceCountDrill = (drill: string): boolean => drill === 'acesLeft' || drill === 'acesDealt';

/** Tests stop once the aces the drill is about have all been dealt. */
export const testsPossible = (drill: string, shoe: DrillShoe): boolean =>
  !(isAceCountDrill(drill) && shoe.counter.aces === 4 * shoe.decks);

export function drillCounts(shoe: DrillShoe): DrillCounts {
  const { counter, decks, cardsPerDeck } = shoe;
  const { rounding } = counter.settings;
  const { strategy } = counter;
  const remaining = Math.max(cardsPerDeck / 4, shoe.remaining);
  const cardsGone = decks * cardsPerDeck - remaining;
  const unitsPerDeck = UNITS_PER_DECK[strategy.trueCountType] ?? null;
  const running = counter.running;
  const trueCount = unitsPerDeck
    ? roundTrueCount(tidy(running / (counter.decksRemaining(cardsGone) * unitsPerDeck)), rounding)
    : running;

  // Aces missing from the shoe compared with the one-in-thirteen average, worth
  // the system's ten value each.
  const aceSurplus = cardsGone / 13 - counter.aces;
  const aceValue = Math.abs(strategy.countValues[10]) / 10;
  const unitsLeft = unitsPerDeck ? (remaining / cardsPerDeck) * unitsPerDeck : null;
  const perUnit = (value: number) => roundTrueCount(tidy(unitsLeft === null ? value : value / unitsLeft), rounding);
  const neutral = isAceNeutral(strategy);

  return {
    runningCount: running,
    trueCount,
    aces: counter.aces,
    acesLeft: 4 * decks - counter.aces,
    tens: counter.tens,
    betCount: neutral ? perUnit(running + aceSurplus * aceValue) : trueCount,
    playCount: neutral ? trueCount : perUnit(running - aceSurplus * aceValue),
    insureCount: neutral ? trueCount : perUnit(running - 2 * aceSurplus * aceValue),
  };
}
