import { describe, it, expect } from 'vitest';
import {
  depthGrid,
  depthLabel,
  generateDepthTest,
  trueCountFor,
  trayStyleFor,
  isTrueCountDrill,
  RESOLUTION_STEPS,
} from '../../../src/drills/depth/logic.ts';
import type { DepthTestOptions, TrueCountOptions } from '../../../src/drills/depth/logic.ts';
import type { AnswerGrid } from '../../../src/drills/shared/answer-grid.ts';
import type { CounterSettings } from '../../../src/core/counting.ts';
import { buildStrategy } from '../../../src/core/strategy/strategy-tables.ts';
import { STRATEGY_FILES } from '../../../src/data/strategy-files.ts';
import { seededRandom } from '../../../src/core/random.ts';

const highLow = buildStrategy(STRATEGY_FILES[30], {
  decks: 6,
  hitSoft17: false,
  doubleAfterSplit: false,
  noHoleCard: false,
  indexSet: 'all',
});
const tc: CounterSettings = { division: 0, lastDeck: 1, rounding: 0 };

/** The labels of a grid, row by row from the top. */
function rows(grid: AnswerGrid) {
  return Array.from({ length: grid.rows }, (_, row) =>
    Array.from(
      { length: grid.columns },
      (_, column) => grid.cells.find(c => c.row === row && c.column === column)?.label ?? '',
    ),
  );
}

describe('depth answer grid', () => {
  it('puts six decks at full resolution in one row, omitting zero', () => {
    const grid = depthGrid({ drill: 'decksLeft', decks: 6, resolution: 'full', askInTray: false });
    expect(grid.rows).toBe(1);
    expect(rows(grid)).toEqual([['', '1', '2', '3', '4', '5']]);
  });

  it('stacks the halves straight above the whole decks, with no row between', () => {
    const grid = depthGrid({ drill: 'decksLeft', decks: 3, resolution: 'half', askInTray: false });
    expect(grid.rows).toBe(2);
    expect(rows(grid)).toEqual([
      ['½', '1½', '2½'],
      ['', '1', '2'],
    ]);
  });

  it('offsets the whole decks half a column, so they sit between the fractions', () => {
    const grid = depthGrid({ drill: 'decksLeft', decks: 3, resolution: 'half', askInTray: false });
    const offsets = (label: string) => grid.cells.filter(c => c.label === label).map(c => c.offset);
    expect(offsets('1')).toEqual([-0.5]);
    expect(offsets('2')).toEqual([-0.5]);
    expect(offsets('½')).toEqual([0]);
    expect(offsets('1½')).toEqual([0]);
    // Zero is never asked, so no key is left empty on the bottom row.
    expect(grid.cells.every(c => c.label !== '')).toBe(true);
  });

  it('shows two decks at quarter resolution as quarters', () => {
    const grid = depthGrid({ drill: 'decksLeft', decks: 2, resolution: 'quarter', askInTray: false });
    expect(rows(grid)).toEqual([
      ['¾', '1¾'],
      ['½', '1½'],
      ['¼', '1¼'],
      ['', '1'],
    ]);
  });

  it('counts half decks, quarter decks and aces', () => {
    const half = depthGrid({ drill: 'halfDecksLeft', decks: 6, resolution: 'half', askInTray: false });
    expect(rows(half)[0].slice(0, 3)).toEqual(['1', '3', '5']);
    expect(rows(half)[1].slice(0, 3)).toEqual(['', '2', '4']);
    const quarter = depthGrid({ drill: 'quarterDecksLeft', decks: 2, resolution: 'quarter', askInTray: false });
    expect(rows(quarter).map(r => r[0])).toEqual(['3', '2', '1', '']);
    const aces = depthGrid({ drill: 'acesLeft', decks: 2, resolution: 'full', askInTray: false });
    expect(rows(aces)).toEqual([['', '4']]);
  });

  it('counts what is in the tray instead, when asked', () => {
    const grid = depthGrid({ drill: 'decksLeft', decks: 6, resolution: 'full', askInTray: true });
    expect(rows(grid)).toEqual([['', '5', '4', '3', '2', '1']]);
    const half = depthGrid({ drill: 'halfDecksLeft', decks: 2, resolution: 'quarter', askInTray: true });
    expect(rows(half)).toEqual([
      ['2½', '½'],
      ['3', '1'],
      ['3½', '1½'],
      ['', '2'],
    ]);
  });

  it('uses a fixed 8 x 4 grid of -14..16 for the true-count drills', () => {
    const grid = depthGrid({ drill: 'trueCount', decks: 6, resolution: 'half', askInTray: false });
    expect([grid.rows, grid.columns]).toEqual([4, 8]);
    expect(rows(grid)[0]).toEqual(['-12', '-8', '-4', '0', '4', '8', '12', '16']);
    expect(rows(grid)[3]).toEqual(['', '-11', '-7', '-3', '1', '5', '9', '13']);
    expect(grid.cellFor(-15)!.label).toBe('');
  });
});

describe('depthLabel', () => {
  it('writes quarters as fractions', () => {
    expect(depthLabel(1.25, { drill: 'decksLeft', decks: 6, askInTray: false })).toBe('1¼');
    expect(depthLabel(0.5, { drill: 'halfDecksLeft', decks: 6, askInTray: false })).toBe('1');
    expect(depthLabel(0.25, { drill: 'halfDecksLeft', decks: 6, askInTray: false })).toBe('½');
    expect(depthLabel(1.5, { drill: 'acesLeft', decks: 6, askInTray: false })).toBe('6');
  });
});

describe('generateDepthTest', () => {
  const base: Omit<DepthTestOptions, 'random'> = {
    decks: 6,
    resolution: 'half',
    drill: 'halfDecksLeft',
    askInTray: false,
    trayStyle: 'sixDeckFront',
    countRange: { min: -10, max: 15 },
    strategy: highLow,
    trueCountSettings: tc,
    previousAnswer: null,
  };

  it('never asks for an empty or a full shoe', () => {
    const random = seededRandom(4);
    for (let i = 0; i < 300; i++) {
      const test = generateDepthTest({ ...base, random });
      if (!test) continue;
      expect(test.answer).toBeGreaterThanOrEqual(1);
      expect(test.answer).toBeLessThanOrEqual(base.decks * RESOLUTION_STEPS.half - 1);
      expect(test.decksLeft + test.decksInTray).toBe(base.decks);
      expect(test.tray.src).toMatch(/assets\/trays\/drill\/\d+\.jpg/);
      expect(test.panel).toBe('');
    }
  });

  it('never repeats the previous answer', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 200; i++) {
      const test = generateDepthTest({ ...base, previousAnswer: 5, random });
      if (test) expect(test.answer).not.toBe(5);
    }
  });

  it('refuses a depth the tray cannot show', () => {
    // An eight-deck tray photo cannot show 7.5 decks or more in the tray.
    const random = () => 0;
    expect(generateDepthTest({ ...base, decks: 8, resolution: 'quarter', trayStyle: 'eightDeckFront', random })).toBe(
      null,
    );
  });

  it('asks for a true count inside the grid, with the running count on the panel', () => {
    const random = seededRandom(12);
    let found = 0;
    for (let i = 0; i < 400; i++) {
      const test = generateDepthTest({ ...base, drill: 'trueCount', random });
      if (!test) continue;
      found += 1;
      expect(test.runningCount).toBeGreaterThanOrEqual(-10);
      expect(test.runningCount).toBeLessThan(15);
      expect(test.answer).toBeGreaterThanOrEqual(-14);
      expect(test.answer).toBeLessThanOrEqual(16);
      expect(test.panel).toMatch(/^RC: -?\d+ Decks: /);
      expect(test.answer).toBe(trueCountFor(test.runningCount!, test.decksInTray, { ...base }));
    }
    expect(found).toBeGreaterThan(50);
  });

  it('shows only the running count for the TC-and-decks drill', () => {
    const random = seededRandom(13);
    for (let i = 0; i < 100; i++) {
      const test = generateDepthTest({ ...base, drill: 'trueCountAndDecks', random });
      if (test) expect(test.panel).toMatch(/^RC: -?\d+$/);
    }
  });

  it('gives up when the count range holds no running count', () => {
    const random = seededRandom(1);
    expect(generateDepthTest({ ...base, drill: 'trueCount', countRange: { min: 5, max: 5 }, random })).toBe(null);
  });

  it('gives up when the count range holds no whole running count', () => {
    const random = seededRandom(2);
    expect(generateDepthTest({ ...base, drill: 'trueCount', countRange: { min: 0.2, max: 0.8 }, random })).toBe(null);
  });

  it('never repeats the previous true count', () => {
    const random = seededRandom(13);
    let found = 0;
    for (let i = 0; i < 400; i++) {
      const test = generateDepthTest({ ...base, drill: 'trueCount', previousAnswer: 2, random });
      if (!test) continue;
      found += 1;
      expect(test.answer).not.toBe(2);
    }
    expect(found).toBeGreaterThan(50);
  });
});

describe('trueCountFor', () => {
  it('divides the running count by the decks left, rounded by the settings', () => {
    const o: TrueCountOptions = { decks: 6, strategy: highLow, trueCountSettings: tc };
    // 4 decks left (full-deck resolution), running count 8 -> +2.
    expect(trueCountFor(8, 2, o)).toBe(2);
    expect(trueCountFor(-8, 2, o)).toBe(-2);
    expect(trueCountFor(5, 2, o)).toBe(1);
    expect(trueCountFor(5, 2, { ...o, trueCountSettings: { ...tc, rounding: 2 } })).toBe(1);
  });

  it('divides by half decks for a system counted per half deck', () => {
    const o: TrueCountOptions = { decks: 6, strategy: { trueCountType: 0 }, trueCountSettings: tc };
    expect(trueCountFor(8, 2, o)).toBe(1);
  });

  it('returns the running count for a system with no true count', () => {
    const o: TrueCountOptions = { decks: 6, strategy: { trueCountType: 2 }, trueCountSettings: tc };
    expect(trueCountFor(7, 2, o)).toBe(7);
  });
});

describe('tray styles', () => {
  it('moves up to a tray that holds the decks in play', () => {
    expect(trayStyleFor('doubleDeckFront', 2)).toBe('doubleDeckFront');
    expect(trayStyleFor('doubleDeckFront', 6)).toBe('sixDeckFront');
    expect(trayStyleFor('doubleDeckRear', 6)).toBe('sixDeckRear');
    expect(trayStyleFor('sixDeckFront', 8)).toBe('eightDeckFront');
    expect(trayStyleFor('doubleDeckFront', 8)).toBe('eightDeckFront');
  });
});

describe('isTrueCountDrill', () => {
  it('knows the two conversion drills', () => {
    expect(['trueCount', 'trueCountAndDecks'].every(isTrueCountDrill)).toBe(true);
    expect(['decksLeft', 'acesLeft'].some(isTrueCountDrill)).toBe(false);
  });
});
