import { describe, it, expect } from 'vitest';
import {
  buildHandList, dealHand, fillHand, handIndex, countForHand, correctPlay, errorCell,
  describeHand, describeEntry, errorCellsAsHands, errorSummary, percent, rowOf, columnOf, upcardOf, SITUATIONS,
  roundRobinEntries, RoundRobin,
} from '../../../public/src/drills/flash/logic.js';
import { buildStrategy } from '../../../public/src/core/strategy/strategy-tables.js';
import { STRATEGY_FILES } from '../../../public/src/data/strategy-files.js';
import { ACTION, SECTION } from '../../../public/src/core/strategy/advisor.js';
import { seededRandom } from '../../../public/src/core/random.js';
import { emptyTallies } from '../../../public/src/services/error-tallies.js';

const ALL_SITUATIONS = Object.fromEntries(SITUATIONS.map(k => [k, true]));
const options = extra => ({ decks: 6, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all', ...extra });
const highLow = buildStrategy(STRATEGY_FILES[30], options());
const basic = buildStrategy(STRATEGY_FILES[5], options());

const emptyMask = () => Object.fromEntries(SITUATIONS.map(k => [k, Array.from({ length: 10 }, () => new Array(10).fill(false))]));

describe('hand lists', () => {
  it('has 127 default hands, weighted by repetition', () => {
    const { entries, error } = buildHandList({ hands: 'default', situations: ALL_SITUATIONS, strategy: highLow });
    expect(error).toBe(null);
    expect(entries).toHaveLength(127);
    // 16 against a ten appears twice, 16 against a seven once.
    const count = (kind, upcard, value) => entries.filter(e => e.kind === kind && e.upcard === upcard && e.value === value).length;
    expect(count('hardStand', 10, 16)).toBe(2);
    expect(count('hardStand', 7, 16)).toBe(1);
    expect(entries.filter(e => e.kind === 'surrender')).toHaveLength(0);
  });

  it('has the 17 Illustrious 18 playing hands', () => {
    const { entries } = buildHandList({ hands: 'illustrious18', situations: ALL_SITUATIONS, strategy: highLow });
    expect(entries).toHaveLength(17);
    expect(entries).toContainEqual({ kind: 'hardStand', upcard: 10, value: 16 });
    expect(entries).toContainEqual({ kind: 'split', upcard: 6, value: 10 });
    expect(entries).toContainEqual({ kind: 'hardDouble', upcard: 1, value: 11 });
  });

  it('builds the index list from cells that hold an index', () => {
    const { entries } = buildHandList({ hands: 'withIndices', situations: { hardStand: true }, strategy: highLow });
    expect(entries.length).toBeGreaterThan(20);
    for (const e of entries) {
      expect(e.kind).toBe('hardStand');
      const cell = highLow.tables.hardStand[rowOf(e)][columnOf(e.upcard)];
      expect(Math.abs(cell)).not.toBe(32000);
    }
  });

  it('reports an empty index list for basic strategy', () => {
    const { entries, error } = buildHandList({ hands: 'withIndices', situations: ALL_SITUATIONS, strategy: basic });
    expect(entries).toHaveLength(0);
    expect(error).toMatch(/INDEXES/);
  });

  it('builds the custom list from the mask and refuses an empty one', () => {
    const mask = emptyMask();
    mask.split[2][5] = true;
    const picked = buildHandList({ hands: 'custom', situations: ALL_SITUATIONS, strategy: highLow, customMask: mask });
    expect(picked.error).toBe(null);
    expect(picked.entries).toEqual([{ kind: 'split', upcard: 7, value: 9 }]);
    const none = buildHandList({ hands: 'custom', situations: ALL_SITUATIONS, strategy: highLow, customMask: emptyMask() });
    expect(none.error).toMatch(/CUSTOM/);
  });

  it('builds the drill-errors list from the tallies', () => {
    const tallies = emptyTallies();
    tallies.hardStand[1][8] = 3;
    const { entries, error } = buildHandList({ hands: 'drillErrors', situations: ALL_SITUATIONS, strategy: highLow, tallies });
    expect(error).toBe(null);
    expect(entries).toEqual([{ kind: 'hardStand', upcard: 10, value: 16 }]);
    const none = buildHandList({ hands: 'drillErrors', situations: ALL_SITUATIONS, strategy: highLow, tallies: emptyTallies() });
    expect(none.error).toMatch(/ERRORS/);
  });

  it('only includes situations that are switched on', () => {
    const { entries } = buildHandList({ hands: 'withIndices', situations: { split: true, surrender: true }, strategy: highLow });
    expect(new Set(entries.map(e => e.kind))).toEqual(new Set(['split', 'surrender']));
  });
});

describe('table coordinates', () => {
  it('maps rows and columns like the strategy tables', () => {
    expect(rowOf({ kind: 'hardStand', value: 17 })).toBe(0);
    expect(rowOf({ kind: 'hardStand', value: 10 })).toBe(7);
    expect(rowOf({ kind: 'hardDouble', value: 11 })).toBe(0);
    expect(rowOf({ kind: 'split', value: 1 })).toBe(0);
    expect(rowOf({ kind: 'split', value: 2 })).toBe(9);
    expect(rowOf({ kind: 'softStand', value: 9 })).toBe(0);
    expect(rowOf({ kind: 'surrender', value: 12 })).toBe(5);
    expect(columnOf(2)).toBe(0);
    expect(columnOf(10)).toBe(8);
    expect(columnOf(1)).toBe(9);
    expect(upcardOf(9)).toBe(1);
    expect(upcardOf(0)).toBe(2);
  });
});

describe('fillHand', () => {
  const random = seededRandom(7);

  it('adds up to the total and never makes 21 or a soft 21', () => {
    for (let i = 0; i < 200; i++) {
      const cards = fillHand(2 + Math.floor(random() * 9), 16, 5, random);
      if (!cards) continue;
      expect(cards.reduce((a, b) => a + b, 0)).toBe(16);
      expect(cards.length).toBeGreaterThanOrEqual(2);
      expect(cards.length).toBeLessThanOrEqual(5);
      expect(cards[cards.length - 1]).toBeLessThanOrEqual(10);
      for (const c of cards) expect(c).toBeGreaterThanOrEqual(1);
    }
  });

  it('makes exactly two cards when only two are allowed', () => {
    expect(fillHand(7, 16, 2, random)).toEqual([7, 9]);
  });

  it('refuses a total it cannot reach', () => {
    expect(fillHand(10, 10, 2, random)).toBe(null);
  });
});

describe('dealHand', () => {
  const list = [{ kind: 'hardStand', upcard: 10, value: 16 }];

  it('deals a hand matching the list entry', () => {
    const random = seededRandom(3);
    for (let i = 0; i < 50; i++) {
      const hand = dealHand(list, { maxCards: 5, doubleAnyCards: false, situations: ALL_SITUATIONS }, random);
      expect(hand.upcard).toBe(10);
      expect(hand.hardTotal).toBe(16);
      expect(hand.cards.reduce((a, b) => a + b, 0)).toBe(16);
      expect(hand.cardIds).toHaveLength(hand.cardCount);
      for (const id of hand.cardIds) expect(id).toBeGreaterThanOrEqual(1);
      for (const id of hand.cardIds) expect(id).toBeLessThanOrEqual(52);
    }
  });

  it('deals pairs for split entries and aces for soft entries', () => {
    const random = seededRandom(11);
    const pair = dealHand([{ kind: 'split', upcard: 5, value: 10 }], { maxCards: 5, situations: ALL_SITUATIONS }, random);
    expect(pair.cards).toEqual([10, 10]);
    expect(pair.cardIds[0]).not.toBe(pair.cardIds[1]);
    const soft = dealHand([{ kind: 'softStand', upcard: 10, value: 7 }], { maxCards: 2, situations: ALL_SITUATIONS }, random);
    expect(soft.cards).toContain(1);
    expect(soft.total).toBe(18);
    expect(soft.soft).toBe(true);
  });

  it('puts face cards in every suit, not only spades', () => {
    const random = seededRandom(5);
    const suits = new Set();
    for (let i = 0; i < 400; i++) {
      const hand = dealHand([{ kind: 'split', upcard: 5, value: 10 }], { maxCards: 2, situations: ALL_SITUATIONS }, random);
      for (const id of hand.cardIds) if (((id - 1) % 13) + 1 > 10) suits.add(Math.floor((id - 1) / 13));
    }
    expect(suits.size).toBe(4);
  });

  it('gives up when the situation of the only entry is switched off', () => {
    const random = seededRandom(1);
    expect(dealHand(list, { maxCards: 5, situations: { hardStand: false } }, random)).toBe(null);
  });
});

describe('the count shown with a hand', () => {
  it('is zero, the fixed value, or near the own index of the hand', () => {
    const random = seededRandom(2);
    expect(countForHand({ countMode: 'zero', fixedCount: 7, index: 4 }, random)).toBe(0);
    expect(countForHand({ countMode: 'fixed', fixedCount: 7, index: 4 }, random)).toBe(7);
    for (let i = 0; i < 200; i++) {
      const n = countForHand({ countMode: 'random', fixedCount: 0, index: 4 }, random);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
});

describe('handIndex', () => {
  it('finds the own playing index of the hand', () => {
    const hand = { kind: 'hardStand', cards: [10, 6], cardIds: [10, 19], total: 16, hardTotal: 16, soft: false, cardCount: 2, upcard: 10 };
    expect(handIndex(highLow, hand, ALL_SITUATIONS)).toBe(highLow.tables.hardStand[1][8]);
  });

  it('has no index for a basic-strategy hand, so the count is centred on zero', () => {
    const hand = { kind: 'hardStand', cards: [10, 7], cardIds: [10, 20], total: 17, hardTotal: 17, soft: false, cardCount: 2, upcard: 6 };
    expect(handIndex(basic, hand, ALL_SITUATIONS)).toBe(null);
    expect(countForHand({ countMode: 'random', fixedCount: 0, index: null }, seededRandom(1))).toBeTypeOf('number');
  });
});

describe('the correct play', () => {
  const hand = (cards, upcard, extra = {}) => {
    const hardTotal = cards.reduce((a, b) => a + b, 0);
    const soft = cards.includes(1) && hardTotal + 10 <= 21;
    return { cards, cardIds: cards.map(c => c), total: soft ? hardTotal + 10 : hardTotal, hardTotal, soft, cardCount: cards.length, upcard, ...extra };
  };

  it('says split 8,8 against a five, and stand when splits are off', () => {
    const on = correctPlay(highLow, hand([8, 8], 5), { count: 0, situations: ALL_SITUATIONS, doubleAnyCards: false });
    expect(on.action).toBe(ACTION.split);
    const off = correctPlay(highLow, hand([8, 8], 5), { count: 0, situations: { ...ALL_SITUATIONS, split: false }, doubleAnyCards: false });
    expect(off.action).toBe(ACTION.stand);
  });

  it('follows the index: stand 16 v 10 at a positive count, hit below it', () => {
    const noSurrender = { ...ALL_SITUATIONS, surrender: false };
    const stand = correctPlay(highLow, hand([10, 6], 10), { count: 2, situations: noSurrender, doubleAnyCards: false });
    const hit = correctPlay(highLow, hand([10, 6], 10), { count: -2, situations: noSurrender, doubleAnyCards: false });
    expect([stand.action, hit.action]).toEqual([ACTION.stand, ACTION.hit]);
  });

  it('does not allow doubling a three-card hand unless the rules do', () => {
    const three = hand([3, 3, 5], 5);
    expect(correctPlay(highLow, three, { count: 0, situations: ALL_SITUATIONS, doubleAnyCards: false }).action).toBe(ACTION.hit);
    expect(correctPlay(highLow, three, { count: 0, situations: ALL_SITUATIONS, doubleAnyCards: true }).action).toBe(ACTION.double);
  });

  it('reduces a multi-card soft hand to an ace plus the rest', () => {
    const play = correctPlay(highLow, hand([1, 2, 5], 5), { count: 0, situations: ALL_SITUATIONS, doubleAnyCards: false });
    expect(play.section).toBe(SECTION.softStand);
  });
});

describe('errorCell', () => {
  const soft18 = { cards: [1, 7], cardIds: [1, 7], total: 18, hardTotal: 8, soft: true, cardCount: 2, upcard: 5, kind: 'softDouble' };

  it('files the error under the earlier of the two tables', () => {
    const play = correctPlay(highLow, soft18, { count: 0, situations: { ...Object.fromEntries(SITUATIONS.map(k => [k, true])) }, doubleAnyCards: false });
    expect(play.action).toBe(ACTION.double);
    // The player surrendered, which is decided earlier than the soft-double table.
    expect(errorCell(play, ACTION.surrender, soft18)).toEqual({ table: 'surrender', row: 9, column: 3 });
  });

  it('files a timeout under the table that decided', () => {
    const play = correctPlay(highLow, soft18, { count: 0, situations: ALL_SITUATIONS, doubleAnyCards: false });
    expect(errorCell(play, null, soft18)).toEqual({ table: 'softDouble', row: 2, column: 3 });
  });
});

describe('descriptions', () => {
  it('names hands and list entries', () => {
    expect(describeHand({ soft: true, total: 18, cardCount: 2, cards: [1, 7] })).toBe('Soft 18 (Ace, 7)');
    expect(describeHand({ soft: false, total: 16, cardCount: 2, cards: [8, 8] })).toBe('Hard 16 (Pair of 8s)');
    expect(describeHand({ soft: false, total: 15, cardCount: 3, cards: [5, 5, 5] })).toBe('Hard 15');
    expect(describeEntry({ kind: 'hardStand', upcard: 10, value: 16 })).toBe('Hard H/S 16 v T');
    expect(describeEntry({ kind: 'split', upcard: 1, value: 8 })).toBe('Split Pair of 8s v A');
    expect(describeEntry({ kind: 'softDouble', upcard: 5, value: 7 })).toBe('Soft DD A,7 v 5');
  });

  it('turns tallied cells into hand-list entries', () => {
    expect(errorCellsAsHands([{ table: 'hardStand', row: 1, column: 8, count: 4 }]))
      .toEqual([{ kind: 'hardStand', upcard: 10, value: 16, count: 4 }]);
  });

  it('sums errors by hand and by situation, with the share of each', () => {
    const summary = errorSummary([
      { table: 'hardStand', row: 1, column: 8, count: 6 },
      { table: 'hardStand', row: 2, column: 8, count: 2 },
      { table: 'split', row: 6, column: 9, count: 2 },
    ]);
    expect(summary.total).toBe(10);
    expect(summary.hands.map(x => [describeEntry(x.entry), x.count, x.share])).toEqual([
      ['Hard H/S 16 v T', 6, 0.6], ['Hard H/S 15 v T', 2, 0.2], [describeEntry(summary.hands[2].entry), 2, 0.2],
    ]);
    expect(summary.situations.map(x => [x.label, x.count, x.share])).toEqual([['Hard H/S', 8, 0.8], ['Split', 2, 0.2]]);
  });

  it('is empty when nothing has been recorded', () => {
    expect(errorSummary([])).toEqual({ total: 0, hands: [], situations: [] });
  });

  it('writes shares as whole percentages', () => {
    expect([0, 0.004, 0.2, 0.666, 1].map(percent)).toEqual(['0%', '<1%', '20%', '67%', '100%']);
  });
});

describe('Round Robin', () => {
  const all = Object.fromEntries(SITUATIONS.map(kind => [kind, true]));
  const key = e => `${e.kind} ${e.value} v ${e.upcard}`;

  it('lists each player hand once per dealer card, merging situations that share it', () => {
    const entries = roundRobinEntries(all);
    // Hard 5-17, soft 2-9 (A,2 to A,9) and ten pairs, against ten dealer cards.
    expect(entries.length).toBe((13 + 8 + 10) * 10);
    const hardTenVsTen = entries.filter(e => e.upcard === 10 && e.value === 10 && e.kinds.includes('hardStand'));
    expect(hardTenVsTen).toHaveLength(1);
    expect(hardTenVsTen[0].kinds).toEqual(['hardStand', 'hardDouble']);
    // A pair is a hand of its own: 5,5 v 10 is not hard 10 v 10.
    expect(entries.filter(e => e.upcard === 10 && e.value === 5 && e.kinds.includes('split'))).toHaveLength(1);
  });

  it('covers only the selected situations', () => {
    const entries = roundRobinEntries({ ...Object.fromEntries(SITUATIONS.map(k => [k, false])), softDouble: true });
    expect(entries.length).toBe(8 * 10);
    expect(entries.every(e => e.kinds.join() === 'softDouble')).toBe(true);
  });

  it('deals every hand once before any hand repeats', () => {
    const entries = roundRobinEntries(all);
    const robin = new RoundRobin(entries, seededRandom(3));
    for (let round = 0; round < 3; round++) {
      const dealt = Array.from({ length: entries.length }, () => robin.next());
      expect(new Set(dealt).size).toBe(entries.length);
    }
  });

  it('marks the last hand of each round', () => {
    const entries = roundRobinEntries(all);
    const robin = new RoundRobin(entries, seededRandom(5));
    expect(robin.endsRound).toBe(false);
    for (let round = 0; round < 2; round++) {
      for (let i = 1; i <= entries.length; i++) {
        robin.next();
        expect(robin.endsRound).toBe(i === entries.length);
      }
    }
  });

  it('never starts a new round with the hand the last one ended on', () => {
    const entries = roundRobinEntries({ ...Object.fromEntries(SITUATIONS.map(k => [k, false])), surrender: true });
    for (let seed = 1; seed <= 40; seed++) {
      const robin = new RoundRobin(entries, seededRandom(seed));
      let last = null;
      for (let i = 0; i < entries.length * 3; i++) {
        const next = robin.next();
        expect(next).not.toBe(last);
        last = next;
      }
    }
  });

  it('deals a merged hand as one of the selected situations only', () => {
    const entries = roundRobinEntries(all);
    const hardTenVsTen = entries.find(e => e.upcard === 10 && e.value === 10 && e.kinds.includes('hardDouble'));
    const onlyDoubles = { ...Object.fromEntries(SITUATIONS.map(k => [k, false])), hardDouble: true };
    const random = seededRandom(9);
    for (let i = 0; i < 30; i++) {
      const hand = dealHand([hardTenVsTen], { situations: onlyDoubles, maxCards: 4, doubleAnyCards: false }, random);
      expect(hand.kind).toBe('hardDouble');
      expect(hand.total).toBe(10);
      expect(hand.soft).toBe(false);
      // Hard doubles are two-card hands unless doubling after any number of cards is allowed.
      expect(hand.cardCount).toBe(2);
    }
  });

  it('makes the same hand from different cards', () => {
    const entries = roundRobinEntries(all);
    const hardFourteen = entries.find(e => e.upcard === 10 && e.value === 14 && e.kinds.includes('hardStand'));
    const random = seededRandom(5);
    const makes = new Set();
    for (let i = 0; i < 60; i++) {
      const hand = dealHand([hardFourteen], { situations: all, maxCards: 3, doubleAnyCards: false }, random);
      expect(hand.total).toBe(14);
      makes.add(hand.cards.join('+'));
    }
    expect(makes.size).toBeGreaterThan(3);
  });
});

