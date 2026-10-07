import { describe, it, expect } from 'vitest';
import {
  FLASH_SIZES,
  maxFlashSize,
  flashSize,
  cardsUntilTest,
  flashRotated,
  flashLayout,
  flashPositions,
  countAnswer,
  halfSteps,
  answerIndex,
  aceDrillSuits,
  isAceCountDrill,
} from '../../../src/drills/count/logic.ts';
import { drillCounts, isAceNeutral } from '../../../src/drills/shared/count-answers.ts';
import { DrillShoe } from '../../../src/drills/shared/shoe.ts';
import { countGrid, countWindow, halfStepLabel, INITIAL_WINDOW } from '../../../src/drills/shared/count-grid.ts';
import { buildStrategy } from '../../../src/core/strategy/strategy-tables.ts';
import type { Strategy, TableOptions } from '../../../src/core/strategy/strategy-tables.ts';
import type { CounterSettings } from '../../../src/core/counting.ts';
import type { Bias } from '../../../src/drills/shared/shoe.ts';
import { STRATEGY_FILES } from '../../../src/data/strategy-files.ts';
import { seededRandom } from '../../../src/core/random.ts';

const options: TableOptions = {
  decks: 6,
  hitSoft17: false,
  doubleAfterSplit: false,
  noHoleCard: false,
  indexSet: 'all',
};
const highLow = buildStrategy(STRATEGY_FILES[30], options);
const hiOptI = buildStrategy(STRATEGY_FILES[20], options);
const tc: CounterSettings = { division: 0, lastDeck: 1, rounding: 0 };

describe('flashes', () => {
  it('knows how many cards a flash may hold', () => {
    expect(FLASH_SIZES['1-3']).toEqual([1, 2, 3]);
    expect(maxFlashSize('1-4')).toBe(4);
    expect(maxFlashSize('3')).toBe(3);
  });

  it('picks a size from the option', () => {
    const random = seededRandom(3);
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(flashSize('1-3', random));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(flashSize('2', random)).toBe(2);
  });

  it('spaces tests around the chosen average', () => {
    const random = seededRandom(8);
    expect(cardsUntilTest('everyCard', random)).toBe(1);
    expect(cardsUntilTest('never', random)).toBe(Infinity);
    const gaps = Array.from({ length: 200 }, () => cardsUntilTest('about8', random));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(11);
  });

  it('turns and arranges flashes according to the options', () => {
    const random = seededRandom(2);
    expect(flashRotated('vertical', random)).toBe(false);
    expect(flashRotated('horizontal', random)).toBe(true);
    const turns = new Set(Array.from({ length: 50 }, () => flashRotated('mixed', random)));
    expect(turns).toEqual(new Set([true, false]));
    expect(flashLayout('diagonal', random)).toBe('diagonal');
    const layouts = new Set(Array.from({ length: 80 }, () => flashLayout('mixed', random)));
    expect(layouts).toEqual(new Set(['vertical', 'horizontal', 'diagonal']));
  });
});

describe('flashPositions', () => {
  const box = { width: 300, height: 400, maxCards: 2 };

  it('stacks a vertical flash downwards, centred', () => {
    const { cards, cardWidth, cardHeight } = flashPositions({ ...box, layout: 'vertical', rotated: false, cards: 2 });
    expect(cardHeight).toBe(Math.floor(400 * 0.82));
    expect(cardWidth).toBe(Math.floor((cardHeight * 150) / 215));
    expect(cards[0]).toEqual({ x: (300 - cardWidth) / 2, y: 0 });
    expect(cards[1].y).toBe(400 - cardHeight);
    expect(cards[1].x).toBe(cards[0].x);
  });

  it('lays a horizontal flash left to right, centred', () => {
    const { cards, cardWidth, cardHeight } = flashPositions({ ...box, layout: 'horizontal', rotated: false, cards: 2 });
    expect(cards[0]).toEqual({ x: 0, y: (400 - cardHeight) / 2 });
    expect(cards[1].x).toBe(300 - cardWidth);
  });

  it('runs a diagonal flash from the bottom left upwards', () => {
    const { cards, cardHeight } = flashPositions({ ...box, layout: 'diagonal', rotated: false, cards: 2 });
    expect(cards[0].y).toBe(400 - cardHeight);
    expect(cards[1].y).toBe(0);
    expect(cards[1].x).toBeGreaterThan(cards[0].x);
  });

  it('swaps the axes for a rotated flash', () => {
    const upright = flashPositions({ ...box, layout: 'vertical', rotated: false, cards: 2 });
    const turned = flashPositions({ ...box, layout: 'vertical', rotated: true, cards: 2 });
    expect(turned.cardHeight).toBe(Math.floor(300 * 0.82));
    expect(turned.cardHeight).not.toBe(upright.cardHeight);
  });

  it('centres a single card when only one is ever shown', () => {
    const { cards, cardWidth, cardHeight } = flashPositions({
      width: 300,
      height: 400,
      maxCards: 1,
      layout: 'diagonal',
      rotated: false,
      cards: 1,
    });
    expect(cardHeight).toBe(400);
    expect(cards).toEqual([{ x: (300 - cardWidth) / 2, y: 0 }]);
  });
});

describe('the answer grid window', () => {
  it('starts with zero in the middle row', () => {
    const grid = countGrid(INITIAL_WINDOW);
    expect(grid.cells.filter(c => c.row === 2).map(c => c.label)).toEqual(['-8', '-7', '-6', '-5', '-4', '-3']);
    expect(grid.cells.filter(c => c.row === 1).map(c => c.label)).toEqual(['-2', '-1', '0', '1', '2', '3']);
    expect(grid.cells.filter(c => c.row === 0).map(c => c.label)).toEqual(['4', '5', '6', '7', '8', '9']);
  });

  it('jumps by nine and stays where it landed', () => {
    expect(countWindow(5, INITIAL_WINDOW)).toBe(INITIAL_WINDOW);
    expect(countWindow(12, INITIAL_WINDOW)).toBe(1);
    expect(countWindow(-10, INITIAL_WINDOW)).toBe(-17);
    expect(countWindow(0, 1)).toBe(-8);
  });

  it('writes half steps as halves', () => {
    expect([5, -1, 4, -5].map(halfStepLabel)).toEqual(['2½', '-½', '2', '-2½']);
  });
});

describe('countAnswer', () => {
  const counts = {
    runningCount: 3,
    trueCount: 1,
    acesLeft: 20,
    aces: 4,
    betCount: 2,
    playCount: -1,
    insureCount: 0,
    tens: 7,
  };

  it('reads the value of the chosen drill', () => {
    expect(countAnswer('runningCount', counts)).toBe(3);
    expect(countAnswer('trueCount', counts)).toBe(1);
    expect(countAnswer('acesLeft', counts)).toBe(20);
    expect(countAnswer('acesDealt', counts)).toBe(4);
    expect(countAnswer('aceBetCount', counts)).toBe(2);
    expect(countAnswer('acePlayCount', counts)).toBe(-1);
    expect(countAnswer('aceInsureCount', counts)).toBe(0);
    expect(countAnswer('tenSideCount', counts)).toBe(7);
  });

  it('uses half steps only for the running count of a half-point system', () => {
    expect(halfSteps('runningCount', { halves: true })).toBe(true);
    expect(halfSteps('trueCount', { halves: true })).toBe(false);
    expect(halfSteps('runningCount', { halves: false })).toBe(false);
    expect(answerIndex(2.5, true)).toBe(5);
    expect(answerIndex(3, false)).toBe(3);
  });

  it('knows the drills that end with the last ace', () => {
    expect(isAceCountDrill('acesLeft')).toBe(true);
    expect(isAceCountDrill('acesDealt')).toBe(true);
    expect(isAceCountDrill('runningCount')).toBe(false);
  });
});

describe('ace drills and the counting system', () => {
  it('offers the bet count only where aces carry no value', () => {
    expect(isAceNeutral(hiOptI)).toBe(true);
    expect(isAceNeutral(highLow)).toBe(false);
    expect(aceDrillSuits('aceBetCount', hiOptI)).toBe(true);
    expect(aceDrillSuits('aceBetCount', highLow)).toBe(false);
    expect(aceDrillSuits('acePlayCount', highLow)).toBe(true);
    expect(aceDrillSuits('acePlayCount', hiOptI)).toBe(false);
    expect(aceDrillSuits('runningCount', hiOptI)).toBe(true);
  });
});

describe('drillCounts', () => {
  const shoeFor = (strategy: Strategy, seed: number) =>
    new DrillShoe({ decks: 6, strategy, trueCountSettings: tc, random: seededRandom(seed) });

  it('is whole numbers, so every answer lands on a grid cell', () => {
    for (const strategy of [highLow, hiOptI]) {
      const shoe = shoeFor(strategy, 21);
      for (let i = 0; i < 100; i++) {
        shoe.deal();
        const counts = drillCounts(shoe);
        for (const key of ['trueCount', 'betCount', 'playCount', 'insureCount'] as const) {
          expect(Number.isInteger(counts[key]), `${key} = ${counts[key]}`).toBe(true);
        }
      }
    }
  });

  it('counts aces and tens, and leaves the other counts alone for a balanced system', () => {
    const shoe = shoeFor(highLow, 5);
    for (let i = 0; i < 52; i++) shoe.deal();
    const counts = drillCounts(shoe);
    expect(counts.aces + counts.acesLeft).toBe(24);
    expect(counts.betCount).toBe(counts.trueCount);
    // An ace-reckoned system adjusts the play and insurance counts instead.
    expect(counts.runningCount).toBe(shoe.counter.running);
  });

  it('adjusts the bet count for missing aces in an ace-neutral system', () => {
    const shoe = shoeFor(hiOptI, 7);
    for (let i = 0; i < 100; i++) shoe.deal();
    const counts = drillCounts(shoe);
    expect(counts.playCount).toBe(counts.trueCount);
    expect(counts.insureCount).toBe(counts.trueCount);
    expect(typeof counts.betCount).toBe('number');
  });

  it('never divides by less than a quarter of a deck', () => {
    const shoe = shoeFor(highLow, 9);
    while (shoe.remaining > 1) shoe.deal();
    const counts = drillCounts(shoe);
    expect(Number.isFinite(counts.trueCount)).toBe(true);
  });
});

describe('shoe bias', () => {
  it('pushes back cards of the unwanted sign in the first half of the shoe', () => {
    const tally = (bias: Bias) => {
      const shoe = new DrillShoe({ decks: 2, strategy: highLow, trueCountSettings: tc, random: seededRandom(31) });
      for (let i = 0; i < 40; i++) {
        shoe.biasNext(bias);
        shoe.deal();
      }
      return shoe.counter.running;
    };
    expect(tally('negative')).toBeLessThan(tally('none'));
    expect(tally('positive')).toBeGreaterThan(tally('none'));
  });

  it('does nothing once half the shoe is gone', () => {
    const shoe = new DrillShoe({ decks: 1, strategy: highLow, trueCountSettings: tc, random: seededRandom(2) });
    for (let i = 0; i < 30; i++) shoe.deal();
    const before = shoe.cards.slice(shoe.dealt);
    shoe.biasNext('positive');
    expect(shoe.cards.slice(shoe.dealt)).toEqual(before);
  });
});
