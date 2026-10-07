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

/** One row of the table: `chips` chips on each of `hands` hands. */
export interface RampRow {
  chips: number;
  hands: number;
}

/** A `betting.ramp` value. */
export interface Ramp {
  minCount: number;
  rows: RampRow[];
}

/** The packed form of a ramp. */
export interface PackedRamp {
  offset: number;
  base: number;
  top: number;
  chipCounts: number[];
  handCounts: number[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRow = (row: unknown): row is RampRow =>
  isRecord(row) && typeof row.chips === 'number' && typeof row.hands === 'number';

/** Whether a saved value is a ramp (of any number of rows, in range or not). */
export const isRamp = (value: unknown): value is Ramp =>
  isRecord(value) && typeof value.minCount === 'number' && Array.isArray(value.rows) && value.rows.every(isRow);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Most chips that may be bet on `hands` hands. */
export const maxChipsForHands = (hands: number) => Math.floor(MAX_CHIPS / Math.max(1, hands));

/** A ramp with its values brought back into range (empty rows bet one chip). */
export function normalizeRamp({ minCount = 0, rows = [] }: Partial<Ramp> = {}): Ramp {
  const count = clamp(rows.length || MIN_ROWS, MIN_ROWS, MAX_ROWS);
  const out: RampRow[] = [];
  for (let i = 0; i < count; i++) {
    const hands = clamp(Math.round(rows[i]?.hands ?? 1) || 1, 1, HAND_CHOICES.length);
    const chips = clamp(Math.round(rows[i]?.chips ?? 1) || 1, 1, maxChipsForHands(hands));
    out.push({ chips, hands });
  }
  return { minCount: Math.round(minCount) || 0, rows: out };
}

/** Grows or shrinks the table to `count` rows, repeating the last row. */
export function setRowCount(ramp: Partial<Ramp>, count: number): Ramp {
  const { minCount, rows } = normalizeRamp(ramp);
  const n = clamp(Math.round(count), MIN_ROWS, MAX_ROWS);
  const out = rows.slice(0, n);
  while (out.length < n) out.push({ ...out[out.length - 1] });
  return { minCount, rows: out };
}

/** Replaces one row. */
export function setRow(ramp: Partial<Ramp>, index: number, { chips, hands }: RampRow): Ramp {
  const { minCount, rows } = normalizeRamp(ramp);
  if (index < 0 || index >= rows.length) return { minCount, rows };
  const next = rows.slice();
  next[index] = { chips, hands };
  return normalizeRamp({ minCount, rows: next });
}

/** The count each row applies at. */
export function rowCounts(ramp: Partial<Ramp>): number[] {
  const { minCount, rows } = normalizeRamp(ramp);
  return rows.map((_, i) => minCount + i);
}

/** The ramp brought back into range when it is not already there, otherwise null. */
export function rampToSave(ramp: Partial<Ramp>): Ramp | null {
  const tidy = normalizeRamp(ramp);
  const rows = ramp?.rows;
  const inRange =
    ramp?.minCount === tidy.minCount &&
    Array.isArray(rows) &&
    rows.length === tidy.rows.length &&
    tidy.rows.every(({ chips, hands }, i) => rows[i]?.chips === chips && rows[i]?.hands === hands);
  return inRange ? null : tidy;
}

/**
 * The text of the "Count" column. A single row has no count at all; otherwise
 * the first row reads "<=n" and the last ">=n". With counts hidden every row
 * shows "-".
 */
export function countLabels(ramp: Partial<Ramp>, { showCounts = true }: { showCounts?: boolean } = {}): string[] {
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
export const formatRow = ({ chips, hands }: RampRow) => (hands > 1 ? `${hands}x${chips}` : String(chips));

/**
 * The row that applies at `count`: counts below the table use the first row,
 * counts above it the last one.
 */
export function rowForCount(ramp: Partial<Ramp>, count: number): RampRow {
  const { minCount, rows } = normalizeRamp(ramp);
  return rows[clamp(Math.round(count) - minCount, 0, rows.length - 1)];
}

/** Checks a placed bet against the ramp. */
export function checkBet({
  ramp,
  count,
  chipValue,
  hands,
  total,
}: {
  ramp: Partial<Ramp>;
  /** The count the ramp is indexed by. */
  count: number;
  /** Dollar value of one chip. */
  chipValue: number;
  /** Number of hands the player bet on. */
  hands: number;
  /** Total amount bet across those hands. */
  total: number;
}): { ok: boolean; tooMuch: boolean; expected: RampRow; expectedPerHand: number } {
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
export const encodeRow = ({ chips, hands }: RampRow) => chips + (hands - 1) * 1000;

/** Inverse of encodeRow. */
export function decodeRow(value: number): RampRow {
  return { chips: value % 1000, hands: Math.floor(value / 1000) + 1 };
}

/** The packed form of a ramp: three counters and two arrays. */
export function toPackedRamp(ramp: Partial<Ramp>): PackedRamp {
  const { minCount, rows } = normalizeRamp(ramp);
  const chipCounts = new Array<number>(PACKED_ROWS).fill(0);
  const handCounts = new Array<number>(PACKED_ROWS).fill(1);
  rows.forEach(({ chips, hands }, i) => {
    chipCounts[i] = chips;
    handCounts[i] = hands;
  });
  // The offset is always -1, so the minimum count is carried by `base`.
  return { offset: -1, base: minCount + 1, top: minCount + rows.length - 1, chipCounts, handCounts };
}

/** Reads a ramp out of its packed form. */
export function fromPackedRamp({ offset, base, top, chipCounts, handCounts }: PackedRamp): Ramp {
  const minCount = offset + base;
  const count = top - base + 2;
  const rows: RampRow[] = [];
  for (let i = 0; i < count; i++) {
    const slot = offset + 1 + i;
    rows.push({ chips: chipCounts[slot], hands: handCounts[slot] });
  }
  return normalizeRamp({ minCount, rows });
}
