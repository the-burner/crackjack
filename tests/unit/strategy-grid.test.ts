import { describe, it, expect } from 'vitest';
import { comparableCounts, comparableTables, countsTables, sameCell, TABLE_VIEWS } from '@/core/strategy/strategy-grid';
import type { TableGridView } from '@/core/strategy/strategy-grid';
import { StrategyLibrary } from '@/settings/strategies';
import type { TableOptions } from '@/core/strategy/strategy-tables';

const OPTIONS: TableOptions = {
  decks: 6,
  hitSoft17: true,
  doubleAfterSplit: true,
  noHoleCard: false,
  indexSet: 'all',
  customMask: null,
  rangeLow: -99,
  rangeHigh: 99,
  forcedInitialRunningCount: null,
};
const library = new StrategyLibrary();
const build = (id: number) => library.build(id, OPTIONS);
const view = (key: string) => TABLE_VIEWS.find(v => v.key === key) as TableGridView;

describe('comparing two strategies', () => {
  it('reads two cells as the same only with the same play and index', () => {
    const cell = { text: '0', background: 'green', color: 'black' };
    expect(sameCell(cell, { ...cell })).toBe(true);
    expect(sameCell(cell, { ...cell, text: '1' })).toBe(false);
    expect(sameCell(cell, { ...cell, background: 'red' })).toBe(false);
  });

  it('lays tables over each other only where they cover the same hands', () => {
    expect(comparableTables(view('hardStand'), build(30), build(5))).toBe(true);
    // Double Exposure's tables run over player and dealer totals.
    expect(comparableTables(view('hardStand'), build(30), build(92))).toBe(false);
  });

  it('lays counts tables over each other only with the same rows and columns', () => {
    const highLow = countsTables(build(30));
    const ko = countsTables(build(73));
    expect(comparableCounts(highLow.startingCount, ko.startingCount)).toBe(true);
    expect(comparableCounts(highLow.pointValues, null)).toBe(false);
    expect(comparableCounts(highLow.pointValues, highLow.insuranceHands)).toBe(false);
  });
});
