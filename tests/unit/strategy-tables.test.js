import { describe, it, expect } from 'vitest';
import { buildStrategy, CODE, INDEX_SETS, INSURANCE } from '../../public/src/core/strategy/strategy-tables.js';
import { TABLE, TABLE_NAMES, VARIANT, parseStrategyFile } from '../../public/src/core/strategy/strategy-file.js';
import { STRATEGY_FILES } from '../../public/src/data/strategy-files.js';
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

const RULES = { decks: 1, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all' };

/** Builds from a parsed file, so a single cell or parameter can be changed first. */
function fromFile(system, options = {}, patch) {
  const file = parseStrategyFile(STRATEGY_FILES[system]);
  patch?.(file);
  return buildStrategy(file, { ...RULES, ...options });
}

/** Writes a value into the same cell of every rule variant. */
const everyVariant = (file, table, row, column, value) =>
  file.tables.forEach(variant => { variant[table][row][column] = value; });

/** A custom index mask with every cell set the same way. */
const maskOf = fill => Object.fromEntries(TABLE_NAMES.map(name =>
  [name, Array.from({ length: 10 }, () => new Array(10).fill(fill))]));

describe('buildStrategy index arithmetic', () => {
  it('rounds a fractional index half to even', () => {
    const s = fromFile(2, {}, f => {
      const row = f.tables[VARIANT.base][TABLE.hardStand][0];
      [2.5, 3.5, -2.5, 2.25, 2.75].forEach((v, i) => { row[i] = v; });
    });
    expect(s.tables.hardStand[0].slice(0, 5)).toEqual([2, 4, -2, 2, 3]);
  });

  it('resolves a *QC cell from the deck count', () => {
    const at = decks => fromFile(2, { decks }, f => everyVariant(f, TABLE.hardStand, 0, 0, CODE.quarterCountByDecks))
      .tables.hardStand[0][0];
    expect(at(1)).toBe(2);
    expect(at(6)).toBe(-6);
  });
});

describe('buildStrategy rule overlays', () => {
  it('unpacks a packed double-after-split split index', () => {
    const s = fromFile(2, { doubleAfterSplit: true }, f => {
      f.tables[VARIANT.doubleAfterSplit][TABLE.split][0][0] = -14500;
    });
    expect(s.tables.split[0][0]).toBe(5);
  });

  it('overlays the other tables from the double-after-split variant', () => {
    const s = fromFile(2, { doubleAfterSplit: true }, f => {
      f.tables[VARIANT.doubleAfterSplit][TABLE.hardStand][0][0] = 7;
    });
    expect(s.tables.hardStand[0][0]).toBe(7);
  });

  it('overlays only the split table for an extended strategy', () => {
    const rules = { ...RULES, decks: 6 };
    const off = buildStrategy(STRATEGY_FILES[92], rules);
    const on = buildStrategy(STRATEGY_FILES[92], { ...rules, doubleAfterSplit: true });
    expect(on.tables.split).not.toEqual(off.tables.split);
    for (const name of TABLE_NAMES.slice(1)) expect(on.tables[name], name).toEqual(off.tables[name]);
  });
});

describe('buildStrategy unbalanced systems', () => {
  // REKO-F counts towards a pivot, so its files may refer to one by code.
  it('resolves the pivot and insurance codes', () => {
    const s = fromFile(24, {}, f => {
      everyVariant(f, TABLE.hardStand, 0, 0, CODE.insuranceIndex);
      everyVariant(f, TABLE.hardStand, 0, 1, CODE.negativeInsuranceIndex);
      everyVariant(f, TABLE.hardStand, 0, 2, CODE.pivot);
      everyVariant(f, TABLE.hardStand, 0, 3, CODE.realPivot);
      everyVariant(f, TABLE.hardStand, 0, 4, CODE.pivotPlus2);
      everyVariant(f, TABLE.split, 0, 0, CODE.negativeInsuranceIndex);
    });
    expect(s.pivot).toBe(4);
    expect(s.realPivot).toBe(3);
    // The one-deck insurance index is 2; the hard hit/stand table negates it to -1, not -2.
    expect(s.tables.hardStand[0].slice(0, 5)).toEqual([2, -1, 4, 3, 6]);
    expect(s.tables.split[0][0]).toBe(-2);
  });

  it('counts a card that only counts when red as 5 in the pivot sum', () => {
    const redOnly = fromFile(50, { decks: 2 }, f => { f.countValues[2] = 10000; });
    const asFive = fromFile(50, { decks: 2 }, f => { f.countValues[2] = 5; });
    expect(redOnly.pivot).toBe(asFive.pivot);
    expect(redOnly.unbalanced).toBe(asFive.unbalanced);
  });

  it('takes the insurance index from the pivot when the file asks for it', () => {
    const one = fromFile(24, {}, f => { f.insuranceCode = INSURANCE.pivot; });
    expect(one.insurance).toBe(40);
    // A shoe adds two tenths.
    const six = fromFile(24, { decks: 6 }, f => { f.insuranceCode = INSURANCE.pivot; });
    expect(six.insurance).toBe(260);
  });
});

describe('buildStrategy index sets', () => {
  const SHOE = { ...RULES, decks: 6 };
  const all = buildStrategy(STRATEGY_FILES[30], SHOE);
  const none = buildStrategy(STRATEGY_FILES[30], { ...SHOE, indexSet: 'none' });

  it('keeps the Fab 4 surrender indices alongside the Illustrious 18', () => {
    const limited = buildStrategy(STRATEGY_FILES[30], { ...SHOE, indexSet: 'illustrious18' });
    const fab4 = buildStrategy(STRATEGY_FILES[30], { ...SHOE, indexSet: 'illustrious18', fab4: true });
    // 15 vs 9, 10 and an ace, and 14 vs 10.
    for (const [row, column] of [[2, 7], [2, 8], [2, 9], [3, 8]]) {
      expect(fab4.tables.surrender[row][column]).toBe(all.tables.surrender[row][column]);
      expect(limited.tables.surrender[row][column]).not.toBe(all.tables.surrender[row][column]);
    }
  });

  it('keeps every index when the custom mask selects every cell', () => {
    const custom = buildStrategy(STRATEGY_FILES[30], { ...SHOE, indexSet: 'custom', customMask: maskOf(true) });
    expect(custom.tables).toEqual(all.tables);
  });

  it.each([1, 6])('reverts every table to basic strategy when the custom mask selects nothing (%i deck)', decks => {
    const rules = { ...RULES, decks, doubleAfterSplit: true, noHoleCard: true };
    const custom = buildStrategy(STRATEGY_FILES[30], { ...rules, indexSet: 'custom', customMask: maskOf(false) });
    expect(custom.tables).toEqual(buildStrategy(STRATEGY_FILES[30], { ...rules, indexSet: 'none' }).tables);
  });

  it('falls back to basic strategy for an extended strategy without indices', () => {
    const extended = buildStrategy(STRATEGY_FILES[92], { ...SHOE, indexSet: 'none' });
    for (const name of TABLE_NAMES) {
      expect(extended.tables[name].map(row => row.slice(0, 10)), name).toEqual(extended.basicTables[name]);
    }
  });

  it('reverts only the cells the custom mask leaves out', () => {
    const mask = maskOf(false);
    mask.hardStand[1][8] = true;
    const custom = buildStrategy(STRATEGY_FILES[30], { ...SHOE, indexSet: 'custom', customMask: mask });
    expect(custom.tables.hardStand[1][8]).toBe(all.tables.hardStand[1][8]);
    expect(custom.tables.hardStand[1][7]).toBe(none.tables.hardStand[1][7]);
  });

  it('maps the custom mask row 8 onto the early-surrender row', () => {
    const mask = maskOf(true);
    mask.surrender[8] = new Array(10).fill(false);
    const rules = { ...RULES, indexSet: 'custom', customMask: mask };
    const custom = fromFile(97, rules, f => { f.earlySurrender = true; });
    const basic = buildStrategy(STRATEGY_FILES[97], { ...RULES, indexSet: 'none' });
    expect(custom.tables.surrender[6]).toEqual(basic.tables.surrender[8]);
    expect(custom.tables.surrender[8]).toEqual(buildStrategy(STRATEGY_FILES[97], RULES).tables.surrender[8]);
  });
});
