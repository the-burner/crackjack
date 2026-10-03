// Checks the player's decisions against their chosen strategy, and their bet
// against their bet ramp.

import { advisePlay, adviseInsurance, ACTION as ADVICE, SECTION } from '../core/strategy/advisor.js';
import { ACTION } from './engine/game.js';
import { valueOf } from '../core/cards.js';
import { doubleAllowed, splitAllowed, surrenderAllowed } from './engine/rules.js';

/** Which strategy table a decision belongs to; also the error-tally table name. */
const SECTION_TABLES = {
  [SECTION.surrender]: 'surrender',
  [SECTION.split]: 'split',
  [SECTION.softDouble]: 'softDouble',
  [SECTION.hardDouble]: 'hardDouble',
  [SECTION.softStand]: 'softStand',
  [SECTION.hardStand]: 'hardStand',
};

const ACTION_NAMES = {
  [ACTION.hit]: 'Hit', [ACTION.stand]: 'Stand', [ACTION.double]: 'Double',
  [ACTION.split]: 'Split', [ACTION.surrender]: 'Surrender',
};

const ADVICE_TO_ACTION = {
  [ADVICE.hit]: ACTION.hit, [ADVICE.stand]: ACTION.stand, [ADVICE.double]: ACTION.double,
  [ADVICE.split]: ACTION.split, [ADVICE.surrender]: ACTION.surrender,
};

/**
 * The strategy-correct action for a hand.
 * @param {object} o
 * @param {object} o.strategy  Built strategy.
 * @param {object} o.rules
 * @param {import('./engine/hand.js').Hand} o.hand
 * @param {number} o.upcard
 * @param {object} o.counts    {trueCount, runningCount}
 * @param {object} o.shoe      {decks, dealt}
 * @param {number} o.handsInSeat
 */
export function correctPlay({ strategy, rules, hand, upcard, counts, shoe, handsInSeat }) {
  const { total, hardTotal } = hand.totals();
  const advice = advisePlay(strategy, {
    total, hardTotal, card1: valueOf(hand.cards[0]), card2: valueOf(hand.cards[1] ?? hand.cards[0]),
    cardCount: hand.cardCount, cardIds: hand.cards.slice(0, 2),
  }, {
    upcard: valueOf(upcard), dealerTotal: valueOf(upcard) === 1 ? 11 : valueOf(upcard), dealerHardTotal: valueOf(upcard),
    trueCount: counts.trueCount, runningCount: counts.runningCount,
    decks: shoe.decks, cardsDealt: shoe.dealt,
    allowed: {
      double: doubleAllowed(rules, hand),
      softDouble: doubleAllowed(rules, hand),
      split: splitAllowed(rules, hand, handsInSeat),
      surrender: surrenderAllowed(rules, hand),
    },
  });
  return { action: ADVICE_TO_ACTION[advice.action], advice };
}

/** Whether taking insurance is correct for the current count. */
export function correctInsurance({ strategy, counts, hand, tenSideCount }) {
  return adviseInsurance(strategy, {
    trueCount: counts.exactTrueCount ?? counts.trueCount,
    insuranceCount: counts.trueCount,
    hardTotal: hand?.hardTotal ?? 12,
    tenSideCount,
  });
}

/**
 * Compares what the player did with what the strategy says.
 * @returns {{correct: boolean, expected: string, expectedName: string, table: string|null, row: number, column: number, message: string}}
 */
export function checkPlay({ strategy, rules, hand, upcard, counts, shoe, handsInSeat, action }) {
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
export function checkInsurance({ strategy, counts, hand, tenSideCount, tookInsurance }) {
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

/**
 * Compares the amount bet with the player's bet ramp.
 * @param {object} o
 * @param {{minCount: number, rows: {chips: number, hands: number}[]}} o.ramp
 * @param {number} o.chipValue
 * @param {number} o.count       The count the ramp is indexed by.
 * @param {number} o.betPerHand
 * @param {number} o.hands
 */
export function checkBet({ ramp, chipValue, count, betPerHand, hands }) {
  const expected = expectedBet({ ramp, chipValue, count });
  const correct = hands === expected.hands && betPerHand === expected.betPerHand;
  let message = '';
  if (!correct) {
    const amount = `$${expected.betPerHand}`;
    message = expected.hands > 1 ? `You should have bet ${expected.hands} hands of ${amount}` : `You should have bet ${amount}`;
  }
  return { correct, expected, message, tooHigh: betPerHand * hands > expected.betPerHand * expected.hands };
}

/** The bet the ramp calls for at a given count. */
export function expectedBet({ ramp, chipValue, count }) {
  const index = Math.min(Math.max(count - ramp.minCount, 0), ramp.rows.length - 1);
  const row = ramp.rows[index] ?? { chips: 1, hands: 1 };
  return { betPerHand: row.chips * chipValue, hands: row.hands, chips: row.chips };
}
