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
};

/** Order of the tables inside a variant. */
export const TABLE = {
  split: 0,
  hardStand: 1,
  softDouble: 2,
  hardDouble: 3,
  softStand: 4,
  surrender: 5,
};

export const TABLE_NAMES = Object.keys(TABLE);

/** Expands the shorthand letters and splits the body into raw string tokens. */
export function tokenize(text) {
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
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  int() {
    return Math.floor(this.tokens[this.pos++]);
  }

  flag() {
    // A token is "off" when it is numerically zero (including blank text).
    return this.tokens[this.pos++] != 0; // eslint-disable-line eqeqeq
  }

  list(count) {
    return Array.from({ length: count }, () => this.int());
  }

  flags(count) {
    return Array.from({ length: count }, () => this.flag());
  }

  grid(rows, columns) {
    return Array.from({ length: rows }, () => this.list(columns));
  }
}

function readTables(reader, columns) {
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
export function parseStrategyFile(text) {
  const { name, tokens } = tokenize(text);
  const r = new TokenReader(tokens);
  const file = { name: name.trim() };
  file.tables = readTables(r, COLUMNS);
  file.countValues = r.list(11);
  file.insuranceCode = r.int();
  const [doubleAfterSplit, multiDeck, hitSoft17, noHoleCard, option4] = r.flags(5);
  file.variants = { doubleAfterSplit, multiDeck, hitSoft17, noHoleCard, option4 };
  file.trueCountType = r.int();
  file.decks = r.int();
  file.sideCount = r.flag();
  file.start = r.int();
  file.insuranceByDecks = [undefined, ...r.list(8)];
  file.startAdjust = r.int();
  file.insuranceByTotal = r.list(10);
  file.countValuesBlack = r.list(11);
  file.initialRunningCount = r.list(8);
  file.redBlack = r.flag();
  file.halves = r.flag();
  file.sideCounts = r.list(11);
  file.groups = r.grid(8, 5);
  file.kiss = r.flag();
  file.extended = r.flag();
  file.earlySurrender = r.flag();
  if (file.extended) {
    file.extendedTables = readTables(r, EXTENDED_COLUMNS);
  }
  return file;
}

/** Parses only the four basic-strategy grids layout used for limited indices. */
export function parseBasicStrategyFile(text) {
  const { tokens } = tokenize(text);
  let pos = 0;
  // Basic tables keep the raw token text (compared numerically later).
  return Array.from({ length: VARIANTS }, () =>
    Array.from({ length: TABLES_PER_VARIANT }, () =>
      Array.from({ length: ROWS }, () => Array.from({ length: COLUMNS }, () => Number(tokens[pos++]))),
    ),
  );
}
