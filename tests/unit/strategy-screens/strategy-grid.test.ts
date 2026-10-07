import { describe, it, expect } from 'vitest';
import { buildStrategy, CODE } from '@/core/strategy/strategy-tables';
import type { Strategy, TableOptions } from '@/core/strategy/strategy-tables';
import type { OneBased } from '@/core/strategy/strategy-file';
import { NEVER, ALWAYS, NO_ENTRY } from '@/core/strategy/strategy-file';
import { STRATEGY_FILES } from '@/data/strategy-files';
import {
  GRID_COLOR,
  TABLE_VIEWS,
  codeDescription,
  codeSymbol,
  columnLabels,
  countsTables,
  gridCell,
  insuranceRuleText,
  rowCount,
  rowLabels,
  specialCode,
  specialtyPlays,
  viewByKey,
} from '@/core/strategy/strategy-grid';
import type { TableGridView } from '@/core/strategy/strategy-grid';

// Every key used below names a grid view, not the counts view.
const view = (key: string) => viewByKey(key) as TableGridView;
const OPTIONS: TableOptions = {
  decks: 6,
  hitSoft17: false,
  doubleAfterSplit: false,
  noHoleCard: false,
  indexSet: 'all',
  rangeHigh: 99,
  rangeLow: -99,
};
const highLow = buildStrategy(STRATEGY_FILES[30], OPTIONS);
// The settings the reference screenshots were taken with (the game's defaults).
const SCREENSHOT: TableOptions = { ...OPTIONS, hitSoft17: true, doubleAfterSplit: true };

describe('views', () => {
  it('lists the seven tables in the original order', () => {
    expect(TABLE_VIEWS.map(v => v.label)).toEqual([
      'Hard Hit/Stand',
      'Soft Hit/Stand',
      'Hard Double Down',
      'Soft Double Down',
      'Split',
      'Surrender',
      'Insurance/Counts',
    ]);
  });

  it('falls back to the first view for an unknown key', () => {
    expect(viewByKey('nope').key).toBe('hardStand');
  });
});

describe('row and column labels', () => {
  it('labels hard hit/stand rows 17 down to 11 plus a catch-all row', () => {
    expect(rowLabels(view('hardStand'))).toEqual(['17', '16', '15', '14', '13', '12', '11', '2-10']);
  });

  it('labels hard hit/stand rows by player total for extended strategies', () => {
    expect(rowLabels(view('hardStand'), { extended: true })).toEqual([
      '21',
      '20',
      '19',
      '18',
      '17',
      '16',
      '15',
      '14',
      '13',
      '12',
    ]);
  });

  it('labels soft rows A9 down to A2, with AT added for extended strategies', () => {
    expect(rowLabels(view('softStand'))).toEqual(['A9', 'A8', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2']);
    expect(rowLabels(view('softDouble'), { extended: true })[0]).toBe('AT');
  });

  it('labels hard double rows 11 down to 5', () => {
    expect(rowLabels(view('hardDouble'))).toEqual(['11', '10', '9', '8', '7', '6', '5']);
  });

  it('labels split rows by pair', () => {
    expect(rowLabels(view('split'))).toEqual(['AA', 'TT', '99', '88', '77', '66', '55', '44', '33', '22']);
  });

  it('labels the last four surrender rows differently with early surrender', () => {
    expect(rowLabels(view('surrender')).slice(6)).toEqual(['99', '88', '77', 'A7']);
    expect(rowLabels(view('surrender'), { earlySurrender: true }).slice(6)).toEqual(['88', '5', '6', '7']);
  });

  it('heads the columns with the dealer upcards', () => {
    expect(columnLabels()).toEqual(['2', '3', '4', '5', '6', '7', '8', '9', 'X', 'A']);
  });

  it('heads the columns with dealer totals for extended strategies', () => {
    const labels = columnLabels({ extended: true });
    expect(labels).toHaveLength(23);
    expect(labels.slice(0, 2)).toEqual(['4', '5']);
    expect(labels.slice(-6)).toEqual(['AA', 'A2', 'A3', 'A4', 'A5', 'A6']);
  });

  it('shows one row per label', () => {
    for (const v of TABLE_VIEWS.filter((x): x is TableGridView => x.table !== null)) {
      expect(rowLabels(v).length, v.key).toBe(rowCount(v));
      expect(rowLabels(v, { extended: true }).length, v.key).toBe(rowCount(v, { extended: true }));
    }
  });
});

describe('gridCell', () => {
  it("paints the table's own action green and the other one red", () => {
    expect(gridCell({ value: ALWAYS, view: view('hardStand') })).toEqual({
      text: '',
      background: GRID_COLOR.action,
      color: '#000',
    });
    expect(gridCell({ value: NEVER, view: view('hardStand') })).toEqual({
      text: '',
      background: GRID_COLOR.opposite,
      color: '#000',
    });
  });

  it('reverses the colours on the double and split tables', () => {
    for (const key of ['hardDouble', 'softDouble', 'split']) {
      expect(gridCell({ value: ALWAYS, view: view(key) }).background, key).toBe(GRID_COLOR.opposite);
      expect(gridCell({ value: NEVER, view: view(key) }).background, key).toBe(GRID_COLOR.action);
    }
  });

  it('keeps the surrender table unreversed', () => {
    expect(gridCell({ value: ALWAYS, view: view('surrender') }).background).toBe(GRID_COLOR.action);
  });

  it('shows an index on cyan', () => {
    expect(gridCell({ value: -3, view: view('hardStand') })).toEqual({
      text: '-3',
      background: GRID_COLOR.index,
      color: '#000',
    });
    expect(gridCell({ value: 0, view: view('split') }).text).toBe('0');
  });

  it('leaves "not applicable" cells blank', () => {
    expect(gridCell({ value: NO_ENTRY, view: view('hardStand') }).text).toBe('');
  });

  it('shows "act below" indices on blue with white text, on the split and surrender tables', () => {
    expect(gridCell({ value: -31492, view: view('split') })).toEqual({
      text: '8',
      background: GRID_COLOR.below,
      color: '#fff',
    });
    expect(gridCell({ value: -31492, view: view('surrender') }).background).toBe(GRID_COLOR.below);
    // Other tables have no "below" encoding; the raw value is simply blank.
    expect(gridCell({ value: -31492, view: view('hardStand') })).toEqual({
      text: '',
      background: GRID_COLOR.index,
      color: '#000',
    });
  });

  it('shows a special code as its symbol', () => {
    expect(gridCell({ value: CODE.standWith3OrMoreCards, view: view('hardStand') })).toEqual({
      text: 'D',
      background: GRID_COLOR.index,
      color: '#000',
    });
  });

  it('puts code 1098 on blue in the split and surrender tables', () => {
    expect(gridCell({ value: 1098, view: view('split') })).toEqual({
      text: 'VR',
      background: GRID_COLOR.below,
      color: '#fff',
    });
    expect(gridCell({ value: 1098, view: view('hardStand') }).background).toBe(GRID_COLOR.index);
  });

  it('greys out cells that are not picked in a mask', () => {
    expect(gridCell({ value: -3, view: view('hardStand'), selected: false }).background).toBe(GRID_COLOR.unselected);
    expect(gridCell({ value: ALWAYS, view: view('split'), selected: false }).background).toBe(GRID_COLOR.unselected);
  });

  it('shades error counts instead of the strategy', () => {
    expect(gridCell({ value: ALWAYS, view: view('hardStand'), errorCount: 0 })).toEqual({
      text: '',
      background: GRID_COLOR.noErrors,
      color: '#fff',
    });
    expect(gridCell({ value: ALWAYS, view: view('hardStand'), errorCount: 3 })).toEqual({
      text: '3',
      background: GRID_COLOR.errors,
      color: '#000',
    });
  });
});

describe('special codes', () => {
  it('recognises codes but not indices', () => {
    expect(specialCode(CODE.pivot)).toBe(CODE.pivot);
    expect(specialCode(12)).toBeNull();
    expect(specialCode(ALWAYS)).toBeNull();
    expect(specialCode(1050)).toBeNull();
  });

  it('takes the symbol from the start of the description', () => {
    expect(codeSymbol(CODE.surrender10v6Only)).toBe('A');
    expect(codeSymbol(CODE.plus3PerDeck)).toBe('VR');
    expect(codeSymbol(CODE.standUnless3Cards)).toBe('S3');
    expect(codeSymbol(CODE.surrender3Or4Cards)).toBe('R3*');
    expect(codeSymbol(CODE.standUnless5CardsOrSuited678)).toBe("S5'");
    expect(codeSymbol(CODE.splitUnlessSuitedSevens)).toBe('P$');
    expect(codeSymbol(1098)).toBe('VR');
  });

  it('drops the leading asterisk from the legend text', () => {
    expect(codeDescription(CODE.pivot)).toBe('J - Pivot');
  });

  it('lists every code a table uses once, in reading order', () => {
    const table = [
      [CODE.pivot, 0, CODE.standWith3OrMoreCards],
      [CODE.pivot, ALWAYS, NEVER],
    ];
    expect(specialtyPlays(table, { ...view('split'), rows: 2, extendedRows: 2 }, { columns: 3 })).toEqual([
      'J - Pivot',
      'D - Stand with 3 or more cards',
    ]);
  });

  it('returns no plays for a table without special codes', () => {
    expect(specialtyPlays(highLow.tables.hardStand, view('hardStand'))).toEqual([]);
  });
});

describe('insurance and counts', () => {
  it('names the insurance rule', () => {
    expect(insuranceRuleText(30)).toBe('Use Insurance Decks Table');
    expect(insuranceRuleText(9999)).toBe('Never Insure');
    expect(insuranceRuleText(-9999)).toBe('Red Seven Rule');
    expect(insuranceRuleText(9998)).toBe('Use Insurance Hand Table');
  });

  it('builds the four small tables for High-Low', () => {
    const counts = countsTables(highLow);
    expect(counts.pointValues.columns).toEqual(['A', '2', '3', '4', '5', '6', '7', '8', '9', 'X']);
    expect(counts.pointValues.rows[0]).toEqual({
      label: 'Red',
      values: ['-1', '1', '1', '1', '1', '1', '0', '0', '0', '-1'],
    });
    expect(counts.pointValues.rows[1].values).toEqual(counts.pointValues.rows[0].values);
    expect(counts.startingCount.rows[0].values).toEqual(['0', '0', '0', '0', '0', '0', '0', '0']);
    expect(counts.insuranceDecks!.rows[0].values).toEqual(['1', '2', '3', '3', '3', '3', '3', '3']);
    expect(counts.insuranceHands.columns).toEqual(['<13', '13', '14', '15', '16', '17', '18', '19', '20', 'BJ']);
    expect(counts.rule).toBe('Use Insurance Decks Table');
  });

  it('gives a red/black strategy two different rows', () => {
    const red7 = buildStrategy(STRATEGY_FILES[80], { ...OPTIONS, decks: 2 });
    const counts = countsTables(red7);
    expect(counts.pointValues.rows[0].values[6]).toBe('1');
    expect(counts.pointValues.rows[1].values[6]).toBe('0');
  });

  it('marks a card that only counts when red with a star', () => {
    const redOnly: Strategy = { ...highLow, countValues: [undefined, ...highLow.countValues.slice(1)] as OneBased };
    redOnly.countValues[7] = 10000;
    redOnly.countValuesBlack = redOnly.countValues.slice();
    redOnly.countValuesBlack[7] = 0;
    redOnly.file = { ...highLow.file, redBlack: true };
    expect(countsTables(redOnly).pointValues.rows[0].values[6]).toBe('*');
    expect(countsTables(redOnly).pointValues.rows[1].values[6]).toBe('0');
  });

  it('shows the KISS tens column as "0/x"', () => {
    const kiss = buildStrategy(STRATEGY_FILES[50], { ...OPTIONS, decks: 2 });
    expect(countsTables(kiss).pointValues.rows[0].values[9]).toBe('0/-1');
  });

  it('hides the per-deck insurance table when the strategy never insures', () => {
    const ko = buildStrategy(STRATEGY_FILES[73], OPTIONS);
    expect(countsTables(ko).insuranceDecks).toBeNull();
    expect(countsTables(ko).rule).toBe('Never Insure');
  });
});

describe('High-Low hard hit/stand grid', () => {
  // The cells the original app showed for this table.
  const table = buildStrategy(STRATEGY_FILES[30], SCREENSHOT).tables.hardStand;
  const v = view('hardStand');

  it('matches the screenshot', () => {
    const texts = rowLabels(v).map((_, r) =>
      columnLabels().map((__, c) => gridCell({ value: table[r][c], view: v }).text),
    );
    expect(texts[0]).toEqual(['', '', '', '', '', '', '', '', '', '-6']);
    expect(texts[1]).toEqual(['-8', '-10', '', '', '', '9', '7', '5', '0', '3']);
    expect(texts[2]).toEqual(['-5', '-6', '-7', '-9', '-9', '10', '10', '8', '4', '5']);
    expect(texts[5]).toEqual(['3', '2', '0', '-1', '-3', '', '', '', '', '']);
    expect(texts[6]).toEqual(['', '', '', '', '', '', '', '', '', '']);
  });

  it('paints stand red and hit green', () => {
    expect(gridCell({ value: table[0][0], view: v }).background).toBe(GRID_COLOR.opposite);
    expect(gridCell({ value: table[6][0], view: v }).background).toBe(GRID_COLOR.action);
  });
});
