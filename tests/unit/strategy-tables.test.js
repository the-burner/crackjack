import { describe, it, expect } from 'vitest';
import { buildStrategy, INDEX_SETS } from '../../src/core/strategy/strategy-tables.js';
import { STRATEGY_FILES } from '../../src/data/strategy-files.js';
import { loadFixture } from '../support/fixtures.js';

const toNumbers = table => table.map(row => row.map(v => (v === null || v === undefined ? v : Number(v))));

function optionsFromFixture(c) {
  return {
    decks: c.decks, hitSoft17: c.h17, doubleAfterSplit: c.das, noHoleCard: c.noHoleCard,
    indexSet: INDEX_SETS[c.indexSet], rangeHigh: c.rangeHigh, rangeLow: c.rangeLow,
    forcedInitialRunningCount: c.forceRC ? c.forceRCValue : null,
  };
}

describe('buildStrategy matches the recorded strategy tables', () => {
  // Strategy 35 is never offered in the app (its file is malformed), so it is not ported.
  const records = loadFixture('strategy-tables.game').filter(r => r.config.system !== 35);
  it.each(records.map(r => [`${r.name} ${JSON.stringify(r.config)}`, r]))('%s', (_, r) => {
    const s = buildStrategy(STRATEGY_FILES[r.config.system], optionsFromFixture(r.config));
    expect(s.name).toBe(r.name);
    for (const [name, table] of Object.entries(r.tables)) {
      const cols = table[0].length;
      expect(toNumbers(s.tables[name].map(row => row.slice(0, cols))), name).toEqual(toNumbers(table));
    }
    expect(s.countValues.slice(1)).toEqual(r.countValues);
    expect(s.countValuesBlack.slice(1)).toEqual(r.countValuesBlack);
    expect(s.insurance).toBe(r.insurance);
    expect(s.insuranceByTotal).toEqual(r.insuranceByTotal);
    expect(s.trueCountType).toBe(r.trueCountType);
    expect(s.pivot).toBe(r.pivot);
    expect(s.realPivot).toBe(r.realPivot);
    expect(s.ircAdjust).toBe(r.ircAdjust);
    expect(s.initialRunningCount).toEqual(r.initialRunningCount);
    expect(s.insuranceByDecks.slice(1)).toEqual(r.insuranceByDecks);
    expect(s.sideCounts).toEqual(r.sideCounts);
    expect(s.kiss).toBe(r.flags.kiss);
    expect(s.earlySurrender).toBe(r.flags.earlySurrender);
    expect(s.extended).toBe(r.flags.extended);
    expect(s.unbalanced).toBe(r.flags.unbalanced);
  });
});
