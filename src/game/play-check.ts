// Checks the player's decisions against their chosen strategy, and their bet
// against their bet ramp.

import { advisePlay, adviseInsurance, ACTION as ADVICE, SECTION } from '../core/strategy/advisor.ts';
import type { Action as Advice, PlayAdvice, Section } from '../core/strategy/advisor.ts';
import type { Strategy } from '../core/strategy/strategy-tables.ts';
import type { TableName } from '../core/strategy/strategy-file.ts';
import { ACTION } from './engine/game.ts';
import type { GameAction } from './engine/game.ts';
import { valueOf } from '../core/cards.ts';
import type { CardId } from '../core/cards.ts';
import { doubleAllowed, splitAllowed, surrenderAllowed } from './engine/rules.ts';
import type { Rules } from './engine/rules.ts';
import type { Hand } from './engine/hand.ts';
import type { Ramp } from '../settings/bet-ramp.ts';

/** The counts a decision is judged at. */
export interface PlayCounts {
  trueCount: number;
  runningCount: number;
  /** Unrounded true count, for insurance. */
  exactTrueCount?: number;
}

/** What a decision needs to know of the shoe. */
export interface ShoeState {
  decks: number;
  dealt: number;
}

export interface PlayQuestion {
  /** Built strategy. */
  strategy: Strategy;
  rules: Rules;
  hand: Hand;
  upcard: CardId;
  counts: PlayCounts;
  shoe: ShoeState;
  handsInSeat: number;
}

/** A decision judged against the strategy. */
export interface DecisionCheck {
  correct: boolean;
  expectedName: string;
  /** The strategy (and error-tally) table, or null. */
  table: TableName | null;
  row: number;
  column: number;
  message: string;
}

export interface PlayCheck extends DecisionCheck {
  expected: GameAction;
}

/** Which strategy table a decision belongs to; also the error-tally table name. */
const SECTION_TABLES: Partial<Record<Section, TableName>> = {
  [SECTION.surrender]: 'surrender',
  [SECTION.split]: 'split',
  [SECTION.softDouble]: 'softDouble',
  [SECTION.hardDouble]: 'hardDouble',
  [SECTION.softStand]: 'softStand',
  [SECTION.hardStand]: 'hardStand',
};

const ACTION_NAMES: Record<GameAction, string> = {
  [ACTION.hit]: 'Hit',
  [ACTION.stand]: 'Stand',
  [ACTION.double]: 'Double',
  [ACTION.split]: 'Split',
  [ACTION.surrender]: 'Surrender',
};

const ADVICE_TO_ACTION: Record<Advice, GameAction> = {
  [ADVICE.hit]: ACTION.hit,
  [ADVICE.stand]: ACTION.stand,
  [ADVICE.double]: ACTION.double,
  [ADVICE.split]: ACTION.split,
  [ADVICE.surrender]: ACTION.surrender,
};

/** The strategy-correct action for a hand. */
export function correctPlay({ strategy, rules, hand, upcard, counts, shoe, handsInSeat }: PlayQuestion): {
  action: GameAction;
  advice: PlayAdvice;
} {
  const { total, hardTotal } = hand.totals();
  const advice = advisePlay(
    strategy,
    {
      total,
      hardTotal,
      card1: valueOf(hand.cards[0]),
      card2: valueOf(hand.cards[1] ?? hand.cards[0]),
      cardCount: hand.cardCount,
      cardIds: hand.cards.slice(0, 2),
    },
    {
      upcard: valueOf(upcard),
      dealerTotal: valueOf(upcard) === 1 ? 11 : valueOf(upcard),
      dealerHardTotal: valueOf(upcard),
      trueCount: counts.trueCount,
      runningCount: counts.runningCount,
      decks: shoe.decks,
      cardsDealt: shoe.dealt,
      allowed: {
        double: doubleAllowed(rules, hand),
        softDouble: doubleAllowed(rules, hand),
        split: splitAllowed(rules, hand, handsInSeat),
        surrender: surrenderAllowed(rules, hand),
      },
    },
  );
  return { action: ADVICE_TO_ACTION[advice.action], advice };
}

/** Whether taking insurance is correct for the current count. */
export function correctInsurance({
  strategy,
  counts,
  hand,
  tenSideCount,
}: {
  strategy: Strategy;
  counts: PlayCounts;
  hand: Hand | null;
  tenSideCount: { tens: number; decks: number } | null;
}): boolean {
  return adviseInsurance(strategy, {
    trueCount: counts.exactTrueCount ?? counts.trueCount,
    insuranceCount: counts.trueCount,
    hardTotal: hand?.hardTotal ?? 12,
    tenSideCount,
  });
}

/** Compares what the player did with what the strategy says. */
export function checkPlay({
  strategy,
  rules,
  hand,
  upcard,
  counts,
  shoe,
  handsInSeat,
  action,
}: PlayQuestion & { action: GameAction }): PlayCheck {
  const { action: expected, advice } = correctPlay({ strategy, rules, hand, upcard, counts, shoe, handsInSeat });
  const correct = action === expected;
  const table = SECTION_TABLES[advice.section] ?? null;
  const column = valueOf(upcard) === 1 ? 9 : valueOf(upcard) - 2;
  return {
    correct,
    expected,
    expectedName: ACTION_NAMES[expected] ?? String(expected),
    table,
    row: advice.row,
    column,
    message: correct ? '' : `That should have been a ${ACTION_NAMES[expected]}`,
  };
}

/** Compares the insurance decision with the strategy. */
export function checkInsurance({
  strategy,
  counts,
  hand,
  tenSideCount,
  tookInsurance,
}: Parameters<typeof correctInsurance>[0] & { tookInsurance: boolean }): DecisionCheck {
  const expected = correctInsurance({ strategy, counts, hand, tenSideCount });
  return {
    correct: tookInsurance === expected,
    expectedName: expected ? 'Insure' : 'Pass',
    table: null,
    row: -1,
    column: -1,
    message: tookInsurance === expected ? '' : `You should have taken ${expected ? 'insurance' : 'no insurance'}`,
  };
}

/** Compares the amount bet with the player's bet ramp. */
export function checkBet({
  ramp,
  chipValue,
  count,
  betPerHand,
  hands,
}: {
  ramp: Ramp;
  chipValue: number;
  /** The count the ramp is indexed by. */
  count: number;
  betPerHand: number;
  hands: number;
}): { correct: boolean; expected: ExpectedBet; message: string; tooHigh: boolean } {
  const expected = expectedBet({ ramp, chipValue, count });
  const correct = hands === expected.hands && betPerHand === expected.betPerHand;
  let message = '';
  if (!correct) {
    const amount = `$${expected.betPerHand}`;
    message =
      expected.hands > 1 ? `You should have bet ${expected.hands} hands of ${amount}` : `You should have bet ${amount}`;
  }
  return { correct, expected, message, tooHigh: betPerHand * hands > expected.betPerHand * expected.hands };
}

export interface ExpectedBet {
  betPerHand: number;
  hands: number;
  chips: number;
}

/** The bet the ramp calls for at a given count. */
export function expectedBet({ ramp, chipValue, count }: { ramp: Ramp; chipValue: number; count: number }): ExpectedBet {
  const index = Math.min(Math.max(count - ramp.minCount, 0), ramp.rows.length - 1);
  const row = ramp.rows[index] ?? { chips: 1, hands: 1 };
  return { betPerHand: row.chips * chipValue, hands: row.hands, chips: row.chips };
}
