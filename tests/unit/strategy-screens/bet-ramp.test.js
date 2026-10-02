import { describe, it, expect } from 'vitest';
import {
  CHIP_CHOICES, MAX_CHIPS, MAX_ROWS, checkBet, countLabels, decodeRow, encodeRow,
  formatRow, fromLegacyRamp, maxChipsForHands, normalizeRamp, rowCounts,
  rowForCount, setRow, setRowCount, toLegacyRamp,
} from '../../../src/settings/bet-ramp.js';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.js';

const DEFAULT_RAMP = SETTINGS_SCHEMA['betting.ramp'].default;
/** The original app's fresh-install values for the three bet-table counters. */
const LEGACY_DEFAULT = {
  sscntstart: -1,
  bbscntcheat: 1,
  sscntstop: 4,
  scbt: [1, 2, 5, 10, 15, ...new Array(17).fill(0)],
  schd: new Array(22).fill(1),
};

describe('normalizeRamp', () => {
  it('leaves a valid ramp alone', () => {
    expect(normalizeRamp(DEFAULT_RAMP)).toEqual(DEFAULT_RAMP);
  });

  it('gives an empty row one chip on one hand, as FillBA did', () => {
    expect(normalizeRamp({ minCount: 0, rows: [{ chips: 0, hands: 0 }] }))
      .toEqual({ minCount: 0, rows: [{ chips: 1, hands: 1 }] });
  });

  it('keeps chips x hands within the 200 chip limit', () => {
    expect(normalizeRamp({ minCount: 0, rows: [{ chips: 200, hands: 6 }] }).rows[0])
      .toEqual({ chips: 33, hands: 6 });
  });

  it('clamps the number of rows', () => {
    expect(normalizeRamp({ minCount: 0, rows: [] }).rows).toHaveLength(1);
    expect(normalizeRamp({ minCount: 0, rows: new Array(30).fill({ chips: 1, hands: 1 }) }).rows).toHaveLength(MAX_ROWS);
  });
});

describe('setRowCount', () => {
  it('repeats the last row when growing', () => {
    expect(setRowCount(DEFAULT_RAMP, 7).rows.map(r => r.chips)).toEqual([1, 2, 5, 10, 15, 15, 15]);
  });

  it('drops rows from the end when shrinking', () => {
    expect(setRowCount(DEFAULT_RAMP, 2).rows.map(r => r.chips)).toEqual([1, 2]);
  });
});

describe('setRow', () => {
  it('replaces one row', () => {
    expect(setRow(DEFAULT_RAMP, 2, { chips: 4, hands: 3 }).rows[2]).toEqual({ chips: 4, hands: 3 });
  });

  it('ignores an out-of-range index', () => {
    expect(setRow(DEFAULT_RAMP, 9, { chips: 4, hands: 3 }).rows).toEqual(DEFAULT_RAMP.rows);
  });
});

describe('row labels', () => {
  it('numbers the counts, bracketing the first and last row', () => {
    expect(countLabels(DEFAULT_RAMP)).toEqual(['<=0', '1', '2', '3', '>=4']);
  });

  it('follows minCount', () => {
    expect(countLabels({ ...DEFAULT_RAMP, minCount: -2 })).toEqual(['<=-2', '-1', '0', '1', '>=2']);
  });

  it('shows dashes when betting errors are not checked', () => {
    expect(countLabels(DEFAULT_RAMP, { showCounts: false })).toEqual(['-', '-', '-', '-', '-']);
  });

  it('leaves a single row unlabelled', () => {
    expect(countLabels({ minCount: 3, rows: [{ chips: 1, hands: 1 }] })).toEqual(['']);
  });

  it('counts the rows from minCount', () => {
    expect(rowCounts({ ...DEFAULT_RAMP, minCount: 1 })).toEqual([1, 2, 3, 4, 5]);
  });

  it('writes multi-hand bets as hands x chips', () => {
    expect(formatRow({ chips: 10, hands: 1 })).toBe('10');
    expect(formatRow({ chips: 10, hands: 3 })).toBe('3x10');
  });
});

describe('rowForCount', () => {
  const ramp = { minCount: 0, rows: [{ chips: 1, hands: 1 }, { chips: 2, hands: 1 }, { chips: 5, hands: 2 }] };

  it('uses the first row below the table', () => {
    expect(rowForCount(ramp, -8)).toEqual({ chips: 1, hands: 1 });
  });

  it('indexes rows by count - minCount', () => {
    expect(rowForCount(ramp, 1)).toEqual({ chips: 2, hands: 1 });
  });

  it('uses the last row above the table', () => {
    expect(rowForCount(ramp, 20)).toEqual({ chips: 5, hands: 2 });
  });
});

describe('checkBet', () => {
  const ramp = { minCount: 0, rows: [{ chips: 1, hands: 1 }, { chips: 4, hands: 2 }] };

  it('accepts the expected bet', () => {
    expect(checkBet({ ramp, count: 1, chipValue: 5, hands: 2, total: 40 }).ok).toBe(true);
  });

  it('rejects the wrong number of hands', () => {
    expect(checkBet({ ramp, count: 1, chipValue: 5, hands: 1, total: 20 }).ok).toBe(false);
  });

  it('reports betting too much', () => {
    const result = checkBet({ ramp, count: 0, chipValue: 5, hands: 1, total: 25 });
    expect(result).toMatchObject({ ok: false, tooMuch: true, expectedPerHand: 5 });
  });

  it('reports betting too little', () => {
    expect(checkBet({ ramp, count: 1, chipValue: 5, hands: 2, total: 20 })).toMatchObject({ ok: false, tooMuch: false });
  });
});

describe('legacy encoding', () => {
  it('round-trips the fresh-install bet table', () => {
    expect(fromLegacyRamp(LEGACY_DEFAULT)).toEqual(DEFAULT_RAMP);
    expect(toLegacyRamp(DEFAULT_RAMP)).toEqual(LEGACY_DEFAULT);
  });

  it('puts the minimum count in bbscntcheat', () => {
    const legacy = toLegacyRamp({ minCount: 3, rows: [{ chips: 1, hands: 1 }, { chips: 2, hands: 1 }] });
    expect(legacy).toMatchObject({ sscntstart: -1, bbscntcheat: 4, sscntstop: 4 });
    expect(fromLegacyRamp(legacy)).toEqual({ minCount: 3, rows: [{ chips: 1, hands: 1 }, { chips: 2, hands: 1 }] });
  });

  it('round-trips ramps through the bbvals cell encoding', () => {
    for (const hands of [1, 2, 6]) {
      for (const chips of CHIP_CHOICES.filter(c => c * hands <= MAX_CHIPS)) {
        expect(decodeRow(encodeRow({ chips, hands }))).toEqual({ chips, hands });
      }
    }
  });

  it('encodes a multi-hand bet the way DoConv did', () => {
    // DoConv read "3x10" as 10 + 3 * 1000 - 1000.
    expect(encodeRow({ chips: 10, hands: 3 })).toBe(10 + 3 * 1000 - 1000);
  });

  it('limits chips by the number of hands', () => {
    expect(maxChipsForHands(1)).toBe(200);
    expect(maxChipsForHands(6)).toBe(33);
  });
});
