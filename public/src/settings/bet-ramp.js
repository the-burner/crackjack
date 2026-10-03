// The bet ramp: how many chips on how many hands to bet at each count.
//
// `betting.ramp` is `{ minCount, rows: [{chips, hands}, ...] }`. Row 0 applies
// at `minCount` "or less", the last row at `minCount + rows.length - 1` "or
// more". The same table can also be held as a packed form: three counters
// (`offset`, `base`, `top`) plus two fixed-length arrays (`chipCounts`,
// `handCounts`); the conversions below translate between the two.

/** Chip counts offered on the bet-select screen. */
export const CHIP_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 50, 100, 200];
/** Numbers of hands offered on the bet-select screen. */
export const HAND_CHOICES = [1, 2, 3, 4, 5, 6];
/** Largest total number of chips (chips x hands) on one bet. */
export const MAX_CHIPS = 200;
/** Allowed number of rows in the table. */
export const MIN_ROWS = 1;
export const MAX_ROWS = 18;
/** Length of the packed form's arrays. */
const PACKED_ROWS = 22;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Most chips that may be bet on `hands` hands. */
export const maxChipsForHands = hands => Math.floor(MAX_CHIPS / Math.max(1, hands));

/** A ramp with its values brought back into range (empty rows bet one chip). */
export function normalizeRamp({ minCount = 0, rows = [] } = {}) {
  const count = clamp(rows.length || MIN_ROWS, MIN_ROWS, MAX_ROWS);
  const out = [];
  for (let i = 0; i < count; i++) {
    const hands = clamp(Math.round(rows[i]?.hands ?? 1) || 1, 1, HAND_CHOICES.length);
    const chips = clamp(Math.round(rows[i]?.chips ?? 1) || 1, 1, maxChipsForHands(hands));
    out.push({ chips, hands });
  }
  return { minCount: Math.round(minCount) || 0, rows: out };
}

/** Grows or shrinks the table to `count` rows, repeating the last row. */
export function setRowCount(ramp, count) {
  const { minCount, rows } = normalizeRamp(ramp);
  const n = clamp(Math.round(count), MIN_ROWS, MAX_ROWS);
  const out = rows.slice(0, n);
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return { minCount, rows: out };
}

/** Replaces one row. */
export function setRow(ramp, index, { chips, hands }) {
  const { minCount, rows } = normalizeRamp(ramp);
  if (index < 0 || index >= rows.length) return { minCount, rows };
  const next = rows.slice();
  next[index] = { chips, hands };
  return normalizeRamp({ minCount, rows: next });
}

/** The count each row applies at. */
export const rowCounts = ramp => normalizeRamp(ramp).rows.map((_, i) => ramp.minCount + i);

/**
 * The text of the "Count" column. A single row has no count at all; otherwise
 * the first row reads "<=n" and the last ">=n". With counts hidden every row
 * shows "-".
 * @param {object} ramp
 * @param {{showCounts?: boolean}} [o]
 */
export function countLabels(ramp, { showCounts = true } = {}) {
  const { minCount, rows } = normalizeRamp(ramp);
  if (!showCounts) return rows.map(() => '-');
  if (rows.length === 1) return [''];
  return rows.map((_, i) => {
    const count = minCount + i;
    if (i === 0) return `<=${count}`;
    if (i === rows.length - 1) return `>=${count}`;
    return String(count);
  });
}

/** The text of the "Hands x Chips" column, e.g. "10" or "3x10". */
export const formatRow = ({ chips, hands }) => (hands > 1 ? `${hands}x${chips}` : String(chips));

/**
 * The row that applies at `count`: counts below the table use the first row,
 * counts above it the last one.
 */
export function rowForCount(ramp, count) {
  const { minCount, rows } = normalizeRamp(ramp);
  return rows[clamp(Math.round(count) - minCount, 0, rows.length - 1)];
}

/**
 * Checks a placed bet against the ramp.
 * @param {object} o
 * @param {object} o.ramp
 * @param {number} o.count       The count the ramp is indexed by.
 * @param {number} o.chipValue   Dollar value of one chip.
 * @param {number} o.hands       Number of hands the player bet on.
 * @param {number} o.total       Total amount bet across those hands.
 * @returns {{ok: boolean, tooMuch: boolean, expected: {chips: number, hands: number}, expectedPerHand: number}}
 */
export function checkBet({ ramp, count, chipValue, hands, total }) {
  const expected = rowForCount(ramp, count);
  const expectedPerHand = expected.chips * chipValue;
  const perHand = hands > 0 ? total / hands : 0;
  return {
    ok: hands === expected.hands && perHand === expectedPerHand,
    tooMuch: perHand > expectedPerHand,
    expected,
    expectedPerHand,
  };
}

/** One row encoded as a single number: chips plus 1000 per extra hand. */
export const encodeRow = ({ chips, hands }) => chips + (hands - 1) * 1000;

/** Inverse of encodeRow. */
export function decodeRow(value) {
  return { chips: value % 1000, hands: Math.floor(value / 1000) + 1 };
}

/**
 * The packed form of a ramp: three counters and two arrays.
 * @returns {{offset: number, base: number, top: number, chipCounts: number[], handCounts: number[]}}
 */
export function toPackedRamp(ramp) {
  const { minCount, rows } = normalizeRamp(ramp);
  const chipCounts = new Array(PACKED_ROWS).fill(0);
  const handCounts = new Array(PACKED_ROWS).fill(1);
  rows.forEach(({ chips, hands }, i) => { chipCounts[i] = chips; handCounts[i] = hands; });
  // The offset is always -1, so the minimum count is carried by `base`.
  return { offset: -1, base: minCount + 1, top: minCount + rows.length - 1, chipCounts, handCounts };
}

/** Reads a ramp out of its packed form. */
export function fromPackedRamp({ offset, base, top, chipCounts, handCounts }) {
  const minCount = offset + base;
  const count = top - base + 2;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const slot = offset + 1 + i;
    rows.push({ chips: chipCounts[slot], hands: handCounts[slot] });
  }
  return normalizeRamp({ minCount, rows });
}
