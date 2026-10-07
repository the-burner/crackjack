// Parser for strategy files: the text format that stores a counting system's
// card values, playing-index tables and related parameters.
//
// A file looks like "|<name>|<body>". The body is a run-length encoded list of
// "|"-separated numbers using single-letter shorthands:
//   U = -32000 (never: always the "basic" action is not taken)
//   R =  32000 (always)
//   T =      0
//   S = -32222 (no entry: fall back to the base table)
//   M = 10 x T, Q = 10 x S, P = 10 x R
// Any other text between "|" separators is a literal number.

/** Index value meaning "never take this action". */
export const NEVER = -32000;
/** Index value meaning "always take this action". */
export const ALWAYS = 32000;
/** Index value meaning "no entry here; keep the value from the base table". */
export const NO_ENTRY = -32222;
/** "Below" indices are stored as index - BELOW_OFFSET and mean "act when the count is below the index". */
export const BELOW_OFFSET = 31500;
export const isBelowIndex = (v: number): boolean => v < -31000 && v > NEVER;

/** Number of rule variants stored per file (see VARIANT). */
const VARIANTS = 8;
/** Tables stored per variant (see TABLE); only the first six are used. */
const TABLES_PER_VARIANT = 7;
const ROWS = 11;
const COLUMNS = 11;
/** Extended files store 13 extra columns per row (dealer totals instead of upcards). */
const EXTENDED_COLUMNS = 13;

/** Rule variants of the tables in a file. */
export const VARIANT = {
  base: 0,
  multiDeck: 1,
  hitSoft17: 2,
  hitSoft17MultiDeck: 3,
  doubleAfterSplit: 4,
  doubleAfterSplitMultiDeck: 5,
  noHoleCard: 6,
} as const;
export type Variant = (typeof VARIANT)[keyof typeof VARIANT];

/** Order of the tables inside a variant. */
export const TABLE = {
  split: 0,
  hardStand: 1,
  softDouble: 2,
  hardDouble: 3,
  softStand: 4,
  surrender: 5,
} as const;
export type TableName = keyof typeof TABLE;

export const TABLE_NAMES = Object.keys(TABLE) as TableName[];

/** A table of index values, [row][column]. */
export type Grid = number[][];
/** Tables of a file: [variant][table] (TABLES_PER_VARIANT per variant). */
export type FileTables = Grid[][];

/**
 * A list indexed from 1 (e.g. by card value or deck count). Index 0 is unused
 * and holds undefined, as in the original apps.
 */
export type OneBased = number[];
/** The undefined placeholder at index 0 of a OneBased list (never read). */
export const UNUSED_SLOT = undefined as unknown as number;

/** Which rule variants a file has tables for. */
export interface FileVariants {
  doubleAfterSplit: boolean;
  multiDeck: boolean;
  hitSoft17: boolean;
  noHoleCard: boolean;
  option4: boolean;
}

/** A parsed strategy file. */
export interface StrategyFile {
  name: string;
  tables: FileTables;
  /** Values of A,2..9,T at index 1..10 (index 0 as stored in the file), in tenths. */
  countValues: number[];
  /** A per-deck index, or an INSURANCE code. */
  insuranceCode: number;
  variants: FileVariants;
  /** COUNT_UNIT. */
  trueCountType: number;
  decks: number;
  sideCount: boolean;
  start: number;
  /** Insurance index per deck count 1..8, in tenths. */
  insuranceByDecks: OneBased;
  startAdjust: number;
  insuranceByTotal: number[];
  countValuesBlack: number[];
  /** Per deck count 1..8, at index 0..7. */
  initialRunningCount: number[];
  redBlack: boolean;
  halves: boolean;
  sideCounts: number[];
  /** Group index values per deck count (8 x 5). */
  groups: Grid;
  kiss: boolean;
  extended: boolean;
  earlySurrender: boolean;
  /** Only in extended files. */
  extendedTables?: FileTables;
}

/** Expands the shorthand letters and splits the body into raw string tokens. */
export function tokenize(text: string): { name: string; tokens: string[] } {
  const nameEnd = text.indexOf('|', 1);
  const name = text.slice(1, nameEnd);
  const body = text
    .slice(nameEnd)
    .replaceAll('M', 'TTTTTTTTTT')
    .replaceAll('Q', 'SSSSSSSSSS')
    .replaceAll('P', 'RRRRRRRRRR')
    .replaceAll('X', 'AAAA')
    .replaceAll('U', '|-32000')
    .replaceAll('T', '|0')
    .replaceAll('S', '|-32222')
    .replaceAll('R', '|32000');
  // The body starts with "|" followed by the first token's own "|", so the
  // first value is the third element of the split.
  return { name, tokens: body.split('|').slice(2) };
}

/** Reads tokens sequentially, converting each to the type asked for. */
class TokenReader {
  tokens: string[];
  pos = 0;

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  int(): number {
    return Math.floor(Number(this.tokens[this.pos++]));
  }

  flag(): boolean {
    // A token is "off" when it is numerically zero (including blank text).
    return Number(this.tokens[this.pos++]) !== 0;
  }

  list(count: number): number[] {
    return Array.from({ length: count }, () => this.int());
  }

  flags(count: number): boolean[] {
    return Array.from({ length: count }, () => this.flag());
  }

  grid(rows: number, columns: number): Grid {
    return Array.from({ length: rows }, () => this.list(columns));
  }
}

function readTables(reader: TokenReader, columns: number): FileTables {
  return Array.from({ length: VARIANTS }, () =>
    Array.from({ length: TABLES_PER_VARIANT }, () => reader.grid(ROWS, columns)),
  );
}

/**
 * Parses a strategy file.
 *
 * Returned arrays keep the file's original indexing: `countValues[1..10]` are
 * the values of A,2..9,T (index 0 unused); `insuranceByDecks[1..8]` and
 * `initialRunningCount[0..7]` are per deck count (1..8 decks).
 */
export function parseStrategyFile(text: string): StrategyFile {
  const { name, tokens } = tokenize(text);
  const r = new TokenReader(tokens);
  const tables = readTables(r, COLUMNS);
  const countValues = r.list(11);
  const insuranceCode = r.int();
  const [doubleAfterSplit, multiDeck, hitSoft17, noHoleCard, option4] = r.flags(5);
  // Properties are read in file order.
  const file: StrategyFile = {
    name: name.trim(),
    tables,
    countValues,
    insuranceCode,
    variants: { doubleAfterSplit, multiDeck, hitSoft17, noHoleCard, option4 },
    trueCountType: r.int(),
    decks: r.int(),
    sideCount: r.flag(),
    start: r.int(),
    insuranceByDecks: [UNUSED_SLOT, ...r.list(8)],
    startAdjust: r.int(),
    insuranceByTotal: r.list(10),
    countValuesBlack: r.list(11),
    initialRunningCount: r.list(8),
    redBlack: r.flag(),
    halves: r.flag(),
    sideCounts: r.list(11),
    groups: r.grid(8, 5),
    kiss: r.flag(),
    extended: r.flag(),
    earlySurrender: r.flag(),
  };
  if (file.extended) {
    file.extendedTables = readTables(r, EXTENDED_COLUMNS);
  }
  return file;
}

/** Parses only the four basic-strategy grids layout used for limited indices. */
export function parseBasicStrategyFile(text: string): FileTables {
  const { tokens } = tokenize(text);
  let pos = 0;
  // Basic tables keep the raw token text (compared numerically later).
  return Array.from({ length: VARIANTS }, () =>
    Array.from({ length: TABLES_PER_VARIANT }, () =>
      Array.from({ length: ROWS }, () => Array.from({ length: COLUMNS }, () => Number(tokens[pos++]))),
    ),
  );
}
