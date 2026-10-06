// Covers the advisor paths the recorded fixtures never reach: the special cell
// codes, the early-surrender layout and the insurance variants. Codes that no
// bundled strategy file uses are written straight into a built table cell.

import { describe, it, expect } from 'vitest';
import { buildStrategy, CODE, INSURANCE } from '../../public/src/core/strategy/strategy-tables.js';
import { NEVER, NO_ENTRY } from '../../public/src/core/strategy/strategy-file.js';
import { STRATEGY_FILES } from '../../public/src/data/strategy-files.js';
import { ACTION, SECTION, advisePlay, adviseInsurance } from '../../public/src/core/strategy/advisor.js';

const ALL = { double: true, softDouble: true, split: true, surrender: true };
const SURRENDER_ONLY = { double: false, softDouble: false, split: false, surrender: true };
const PLAY_ONLY = { double: false, softDouble: false, split: false, surrender: false };

function strategy(system, options = {}) {
  return buildStrategy(STRATEGY_FILES[system], {
    decks: 1, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all', ...options,
  });
}

/** A hand; `cards` and `hardTotal` describe hands of more than two cards. */
function hand(card1, card2, { cards = 2, hardTotal, cardIds } = {}) {
  const hard = hardTotal ?? card1 + card2;
  const soft = card1 === 1 || card2 === 1;
  return {
    total: soft && hard + 10 <= 21 ? hard + 10 : hard,
    hardTotal: hard, card1, card2, cardCount: cards, cardIds,
  };
}

function advise(s, h, { upcard, count = 0, ...rest }) {
  return advisePlay(s, h, {
    upcard, dealerTotal: upcard === 1 ? 11 : upcard, dealerHardTotal: upcard,
    trueCount: count, runningCount: count, decks: s.decks, cardsDealt: 0, allowed: ALL, ...rest,
  });
}

describe('count selection', () => {
  // Advanced Omega II stands on 16 vs 10 at a true count of 0 with two decks.
  const sixteenVsTen = () => strategy(7, { decks: 2 });

  it('compares a zero index against the running count when asked to', () => {
    const ctx = { upcard: 10, allowed: PLAY_ONLY, zeroIndexUsesRunningCount: true };
    expect(advise(sixteenVsTen(), hand(6, 10), { ...ctx, trueCount: -3, runningCount: 3 }).action).toBe(ACTION.stand);
    expect(advise(sixteenVsTen(), hand(6, 10), { ...ctx, trueCount: 3, runningCount: -3 }).action).toBe(ACTION.hit);
  });

  it('compares a zero index against the true count otherwise', () => {
    const ctx = { upcard: 10, allowed: PLAY_ONLY };
    expect(advise(sixteenVsTen(), hand(6, 10), { ...ctx, trueCount: -3, runningCount: 3 }).action).toBe(ACTION.hit);
  });

  it('reads a *VR cell as 21 plus three per remaining deck', () => {
    const s = strategy(30, { decks: 6 });
    s.tables.hardStand[1][8] = CODE.plus3PerDeck;
    expect(advise(s, hand(6, 10), { upcard: 10, count: 39, allowed: PLAY_ONLY }).action).toBe(ACTION.stand);
    expect(advise(s, hand(6, 10), { upcard: 10, count: 38, allowed: PLAY_ONLY }).action).toBe(ACTION.hit);
  });

  it('reads a *VP cell as 21 minus seven per remaining deck', () => {
    const s = strategy(30, { decks: 6 });
    s.tables.hardStand[1][8] = CODE.minus7PerDeck;
    expect(advise(s, hand(6, 10), { upcard: 10, count: -21, allowed: PLAY_ONLY }).action).toBe(ACTION.stand);
    expect(advise(s, hand(6, 10), { upcard: 10, count: -22, allowed: PLAY_ONLY }).action).toBe(ACTION.hit);
  });
});

describe('early surrender', () => {
  // No bundled file uses the early-surrender layout, where rows 6..9 hold 8,8
  // and the hard totals 5, 6 and 7.
  function early() {
    const s = strategy(97);
    s.earlySurrender = true;
    return s;
  }

  it('never surrenders a soft hand', () => {
    const s = early();
    s.tables.surrender[6][8] = NEVER;
    const r = advise(s, hand(1, 6), { upcard: 10, allowed: SURRENDER_ONLY });
    expect(r.action).not.toBe(ACTION.surrender);
    expect(r.sectionRows[SECTION.surrender]).toBe(-1);
  });

  it('surrenders 8,8 from its own row', () => {
    const s = early();
    s.tables.surrender[6][8] = 2;
    expect(advise(s, hand(8, 8), { upcard: 10, count: 2, allowed: SURRENDER_ONLY }))
      .toMatchObject({ action: ACTION.surrender, row: 7 });
    expect(advise(s, hand(8, 8), { upcard: 10, count: 1, allowed: SURRENDER_ONLY }).action)
      .not.toBe(ACTION.surrender);
  });

  it('falls back to the hard-total rows when the 8,8 row has no entry', () => {
    const s = early();
    s.tables.surrender[6][8] = NO_ENTRY;
    s.tables.surrender[1][8] = NEVER;
    expect(advise(s, hand(8, 8), { upcard: 10, allowed: SURRENDER_ONLY }))
      .toMatchObject({ action: ACTION.surrender, row: 1 });
  });

  it('reads a hard total of 5 to 7 from the row two below it', () => {
    const s = early();
    s.tables.surrender[7][8] = 1;
    expect(advise(s, hand(2, 3), { upcard: 10, count: 1, allowed: SURRENDER_ONLY }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(2, 3), { upcard: 10, count: 0, allowed: SURRENDER_ONLY }).action).not.toBe(ACTION.surrender);
  });
});

describe('surrender', () => {
  it('surrenders A,7 from its own row', () => {
    // No bundled file gives A,7 a surrender index.
    const s = strategy(97);
    s.tables.surrender[9][8] = 3;
    expect(advise(s, hand(1, 7), { upcard: 10, count: 3 })).toMatchObject({ action: ACTION.surrender, row: 9 });
    expect(advise(s, hand(1, 7), { upcard: 10, count: 2 }).action).not.toBe(ACTION.surrender);
  });

  it('surrenders 9,9 from its own row', () => {
    const s = strategy(97);
    s.tables.surrender[6][8] = 4;
    expect(advise(s, hand(9, 9), { upcard: 10, count: 4 })).toMatchObject({ action: ACTION.surrender, row: 6 });
    const played = advise(s, hand(9, 9), { upcard: 10, count: 3 });
    expect(played.action).not.toBe(ACTION.surrender);
    expect(played.sectionRows[SECTION.split]).toBe(2);
  });

  it('surrenders below a negative index', () => {
    // REKO-T surrenders hard 17 vs an ace only when the count is below -7.
    const s = strategy(97);
    expect(advise(s, hand(7, 10), { upcard: 1, count: -8 }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(7, 10), { upcard: 1, count: -7 }).action).not.toBe(ACTION.surrender);
  });

  it('surrenders only 10,6 at an *A cell', () => {
    // Kiss Stage I marks 16 vs an ace this way.
    const s = strategy(50);
    expect(advise(s, hand(6, 10), { upcard: 1 })).toMatchObject({ action: ACTION.surrender, row: 1 });
    expect(advise(s, hand(7, 9), { upcard: 1 }).action).not.toBe(ACTION.surrender);
  });

  it('surrenders anything but 8,7 at a *B cell', () => {
    const s = strategy(97);
    s.tables.surrender[2][8] = CODE.surrenderExcept87;
    expect(advise(s, hand(6, 9), { upcard: 10 }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(7, 8), { upcard: 10 }).action).not.toBe(ACTION.surrender);
  });

  it('hits an *R3 cell with three or more cards', () => {
    const s = strategy(97);
    s.tables.surrender[1][8] = CODE.surrenderUnless3Cards;
    expect(advise(s, hand(6, 10), { upcard: 10 }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(4, 5, { cards: 3, hardTotal: 16 }), { upcard: 10 }).action).toBe(ACTION.hit);
  });

  it('stands on three or four cards at an *R3* cell', () => {
    const s = strategy(97);
    s.tables.surrender[1][8] = CODE.surrender3Or4Cards;
    const at = cards => advise(s, hand(4, 5, { cards, hardTotal: 16 }), { upcard: 10 }).action;
    expect(advise(s, hand(6, 10), { upcard: 10 }).action).toBe(ACTION.surrender);
    expect(at(3)).toBe(ACTION.stand);
    expect(at(4)).toBe(ACTION.stand);
    expect(at(5)).toBe(ACTION.hit);
  });

  it('hits an *R4 cell with four or more cards', () => {
    // Super Fun 21 marks 16 vs 10 this way.
    const s = strategy(91);
    expect(advise(s, hand(6, 10), { upcard: 10 }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(4, 5, { cards: 4, hardTotal: 16 }), { upcard: 10 }).action).toBe(ACTION.hit);
  });

  it('hits an *Rh cell past the first two cards', () => {
    const s = strategy(97);
    s.tables.surrender[1][8] = CODE.surrenderFirstTwoOnly;
    expect(advise(s, hand(6, 10), { upcard: 10 }).action).toBe(ACTION.surrender);
    expect(advise(s, hand(4, 5, { cards: 3, hardTotal: 16 }), { upcard: 10 }).action).toBe(ACTION.hit);
  });
});

describe('splits', () => {
  it('splits sevens at a *P$ cell unless the two card ids are equal', () => {
    // Spanish 21 marks 7,7 vs 7 this way.
    const s = strategy(90);
    expect(advise(s, hand(7, 7, { cardIds: [7, 20] }), { upcard: 7 }).action).toBe(ACTION.split);
    expect(advise(s, hand(7, 7, { cardIds: [7, 7] }), { upcard: 7 }).action).toBe(ACTION.hit);
  });

  it('puts code 1098 in the split table beyond the reach of any count', () => {
    const s = strategy(30, { decks: 6 });
    s.tables.split[3][8] = 1098;
    for (const count of [-99, 0, 39, 99]) {
      expect(advise(s, hand(8, 8), { upcard: 10, count }).action, String(count)).not.toBe(ACTION.split);
    }
  });
});

describe('doubling', () => {
  it('marks a soft double index in the 900s as "double or less"', () => {
    const s = strategy(2);
    s.tables.softDouble[2][1] = 903;
    expect(advise(s, hand(1, 7), { upcard: 3, count: 3 }))
      .toMatchObject({ action: ACTION.double, threshold: 3, doubleOrLess: true });
    expect(advise(s, hand(1, 7), { upcard: 3, count: 2 }).action).not.toBe(ACTION.double);
  });

  it('marks a hard double index in the 900s as "double or less"', () => {
    const s = strategy(2);
    s.tables.hardDouble[2][1] = 905;
    expect(advise(s, hand(4, 5), { upcard: 3, count: 5 }))
      .toMatchObject({ action: ACTION.double, threshold: 5, doubleOrLess: true });
    expect(advise(s, hand(4, 5), { upcard: 3, count: 4 }).action).not.toBe(ACTION.double);
  });

  it('always doubles an *E cell from a count of 6', () => {
    // Basic Omega II marks hard 8 vs 5 this way.
    const s = strategy(6);
    expect(advise(s, hand(2, 6), { upcard: 5, count: 6 }).action).toBe(ACTION.double);
  });

  it('never doubles an *E cell below -5', () => {
    const s = strategy(6);
    const r = advise(s, hand(3, 5), { upcard: 5, count: -6 });
    expect(r.action).toBe(ACTION.hit);
    expect(r.section).toBe(SECTION.hardStand);
  });

  it('doubles an *E cell in between unless the hand is 6,2', () => {
    const s = strategy(6);
    expect(advise(s, hand(3, 5), { upcard: 5 }).action).toBe(ACTION.double);
    expect(advise(s, hand(2, 6), { upcard: 5 }).action).toBe(ACTION.hit);
  });

  it('refuses to double 2,9 and 3,8 at an *R cell', () => {
    const s = strategy(2);
    s.tables.hardDouble[0][8] = CODE.noDouble29Or38;
    expect(advise(s, hand(2, 9), { upcard: 10 }).action).not.toBe(ACTION.double);
    expect(advise(s, hand(3, 8), { upcard: 10 }).action).not.toBe(ACTION.double);
    expect(advise(s, hand(4, 7), { upcard: 10 }).action).toBe(ACTION.double);
  });
});

describe('soft hit/stand', () => {
  it('marks a soft stand index in the 900s as "double or less"', () => {
    const s = strategy(2);
    s.tables.softStand[2][1] = 905;
    const at = count => advise(s, hand(1, 7), { upcard: 3, count, allowed: { ...ALL, softDouble: false } });
    expect(at(5)).toMatchObject({ action: ACTION.stand, threshold: 5, doubleOrLess: true });
    expect(at(4).action).toBe(ACTION.hit);
  });

  it('reads an *H cell as 0 with one or two decks', () => {
    // Advanced Omega II marks soft 18 vs an ace this way from two decks up.
    const s = strategy(7, { decks: 2 });
    const at = count => advise(s, hand(1, 7), { upcard: 1, count, allowed: PLAY_ONLY }).action;
    expect(at(0)).toBe(ACTION.stand);
    expect(at(-1)).toBe(ACTION.hit);
  });

  it('reads an *H cell as 2 with a shoe', () => {
    const s = strategy(7, { decks: 6 });
    const at = count => advise(s, hand(1, 7), { upcard: 1, count, allowed: PLAY_ONLY }).action;
    expect(at(2)).toBe(ACTION.stand);
    expect(at(1)).toBe(ACTION.hit);
  });
});

describe('hard hit/stand', () => {
  /** Hard 14 vs 10, the cell every 7,7 code sits in. */
  const at = (s, h, count) => advise(s, h, { upcard: 10, count, allowed: PLAY_ONLY }).action;

  it('reads a *C cell as 0 for 7,7 and 13 for any other fourteen', () => {
    const s = strategy(3);
    expect(at(s, hand(7, 7), 0)).toBe(ACTION.stand);
    expect(at(s, hand(7, 7), -1)).toBe(ACTION.hit);
    expect(at(s, hand(4, 10), 13)).toBe(ACTION.stand);
    expect(at(s, hand(4, 10), 12)).toBe(ACTION.hit);
  });

  it('reads an *F cell as 1 for 7,7 and 15 for any other fourteen', () => {
    const s = strategy(7);
    expect(at(s, hand(7, 7), 1)).toBe(ACTION.stand);
    expect(at(s, hand(7, 7), 0)).toBe(ACTION.hit);
    expect(at(s, hand(4, 10), 15)).toBe(ACTION.stand);
    expect(at(s, hand(4, 10), 14)).toBe(ACTION.hit);
  });

  it('hits an *I cell unless the hand is 7,7 and the count is at least -6', () => {
    const s = strategy(6);
    expect(at(s, hand(4, 10), 99)).toBe(ACTION.hit);
    expect(at(s, hand(7, 7), -6)).toBe(ACTION.stand);
    expect(at(s, hand(7, 7), -7)).toBe(ACTION.hit);
  });

  it('hits an *L cell unless the hand is 7,7 and the count is at least -1', () => {
    const s = strategy(6);
    s.tables.hardStand[3][8] = CODE.hitUnless77AtMinus1;
    expect(at(s, hand(4, 10), 99)).toBe(ACTION.hit);
    expect(at(s, hand(7, 7), -1)).toBe(ACTION.stand);
    expect(at(s, hand(7, 7), -2)).toBe(ACTION.hit);
  });

  it('reads a *G cell as 6 for 7,7 with two decks and 11 with a shoe', () => {
    const two = strategy(7, { decks: 2 });
    expect(at(two, hand(7, 7), 6)).toBe(ACTION.stand);
    expect(at(two, hand(7, 7), 5)).toBe(ACTION.hit);
    const six = strategy(7, { decks: 6 });
    expect(at(six, hand(7, 7), 11)).toBe(ACTION.stand);
    expect(at(six, hand(7, 7), 10)).toBe(ACTION.hit);
  });

  it('reads a *G cell as 15 for any other fourteen', () => {
    const s = strategy(7, { decks: 2 });
    expect(at(s, hand(4, 10), 15)).toBe(ACTION.stand);
    expect(at(s, hand(4, 10), 14)).toBe(ACTION.hit);
  });

  it('reads an *N cell as 0 for 7,7 with one deck and 4 with two', () => {
    // Hi-Opt I marks 14 vs 10 this way.
    const one = strategy(20);
    expect(at(one, hand(7, 7), 0)).toBe(ACTION.stand);
    expect(at(one, hand(7, 7), -1)).toBe(ACTION.hit);
    const two = strategy(20, { decks: 2 });
    expect(at(two, hand(7, 7), 4)).toBe(ACTION.stand);
    expect(at(two, hand(7, 7), 3)).toBe(ACTION.hit);
  });

  it('never stands an *N cell on any other fourteen', () => {
    const s = strategy(20);
    expect(at(s, hand(4, 10), 99)).toBe(ACTION.hit);
  });

  it('hits only 10,2 at a *Q cell', () => {
    const s = strategy(2);
    s.tables.hardStand[5][8] = CODE.hit102;
    expect(at(s, hand(2, 10), 99)).toBe(ACTION.hit);
    expect(at(s, hand(4, 8), -99)).toBe(ACTION.stand);
  });

  it('stands at a *D cell only past the first two cards', () => {
    const s = strategy(2);
    s.tables.hardStand[1][8] = CODE.standWith3OrMoreCards;
    expect(advise(s, hand(6, 10), { upcard: 10, allowed: PLAY_ONLY }))
      .toMatchObject({ action: ACTION.hit, standWith3OrMore: false });
    expect(advise(s, hand(4, 5, { cards: 3, hardTotal: 16 }), { upcard: 10, allowed: PLAY_ONLY }))
      .toMatchObject({ action: ACTION.stand, standWith3OrMore: true });
  });

  it('hits an *S4* cell with four or more cards', () => {
    // Spanish 21 marks hard 15 vs 2 this way.
    const s = strategy(90);
    const play = h => advise(s, h, { upcard: 2, allowed: PLAY_ONLY }).action;
    expect(play(hand(5, 10))).toBe(ACTION.stand);
    expect(play(hand(4, 5, { cards: 4, hardTotal: 15 }))).toBe(ACTION.hit);
    expect(play(hand(7, 8))).toBe(ACTION.hit);
  });

  it('hits a spaded-678 cell only when both cards are spades', () => {
    // Spanish 21 marks hard 15 vs 4 this way; ids 1..13 are the spades.
    const s = strategy(90);
    const play = cardIds => advise(s, hand(7, 8, { cardIds }), { upcard: 4, allowed: PLAY_ONLY }).action;
    expect(play([7, 8])).toBe(ACTION.hit);
    expect(play([20, 21])).toBe(ACTION.stand);
  });

  it('does not take a hand without card ids for a pair of spades', () => {
    const s = strategy(90);
    expect(advise(s, hand(7, 8), { upcard: 4, allowed: PLAY_ONLY }).action).toBe(ACTION.stand);
  });
});

describe('adviseInsurance', () => {
  const s = strategy(30, { decks: 6 });

  it('insures on the ten side count when one is kept', () => {
    const ctx = { trueCount: -99, insuranceCount: -99, hardTotal: 12 };
    expect(adviseInsurance(s, { ...ctx, tenSideCount: { tens: 5, decks: 1 } })).toBe(true);
    expect(adviseInsurance(s, { ...ctx, tenSideCount: { tens: 4, decks: 1 } })).toBe(false);
  });

  it('reads the insurance hands table when the strategy uses it', () => {
    const byTotal = { ...s, insurance: INSURANCE.byTotalTable, insuranceByTotal: [10, 20, 20, 20, 30, 30, 30, 30, 30, 30] };
    expect(adviseInsurance(byTotal, { trueCount: 3, insuranceCount: 3, hardTotal: 16 })).toBe(true);
    expect(adviseInsurance(byTotal, { trueCount: 2, insuranceCount: 2, hardTotal: 16 })).toBe(false);
  });

  it('reads the first entry of the insurance hands table below a total of 12', () => {
    const byTotal = { ...s, insurance: INSURANCE.byTotalTable, insuranceByTotal: [10, 90, 90, 90, 90, 90, 90, 90, 90, 90] };
    expect(adviseInsurance(byTotal, { trueCount: 1, insuranceCount: 1, hardTotal: 11 })).toBe(true);
  });

  it('uses the unrounded true count when the insurance hands table has fractions', () => {
    const byTotal = { ...s, insurance: INSURANCE.byTotalTable, insuranceByTotal: [10, 20, 20, 20, 25, 30, 30, 30, 30, 30] };
    expect(adviseInsurance(byTotal, { trueCount: 2.5, insuranceCount: 2, hardTotal: 16 })).toBe(true);
    expect(adviseInsurance(byTotal, { trueCount: 2.4, insuranceCount: 3, hardTotal: 16 })).toBe(false);
  });

  it('uses the unrounded true count when the per-deck insurance table has fractions', () => {
    // Silver Fox insures from 1.9 with one deck.
    const silverFox = strategy(70);
    expect(adviseInsurance(silverFox, { trueCount: 1.9, insuranceCount: 1, hardTotal: 12 })).toBe(true);
    expect(adviseInsurance(silverFox, { trueCount: 1.8, insuranceCount: 2, hardTotal: 12 })).toBe(false);
  });

  it('uses the rounded count otherwise', () => {
    expect(adviseInsurance(s, { trueCount: 2.9, insuranceCount: 2, hardTotal: 12 })).toBe(false);
    expect(adviseInsurance(s, { trueCount: 2.1, insuranceCount: 3, hardTotal: 12 })).toBe(true);
  });
});
