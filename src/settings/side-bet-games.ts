// Decoder for side-bet / bonus game definitions.
//
// A definition is one string: a leading `|`, the game name, then a long run of
// `|`-separated fields in which `(`, `)`, `[`, `]`, `#`, `~` and `@` stand for
// common field runs. This module expands the shorthand and reads the fields, in
// order, into a structured game definition.

/** Number of bonus/side-bet rules in every definition. */
export const RULE_COUNT = 20;

/** Rule index at which `forcedSideBet` has not been set by the definition. */
const DEFAULT_FORCED_SIDE_BET = 11;

/** The game name stored in a definition string. */
export function sideBetGameName(definition: string): string {
  const end = definition.indexOf('|', 1);
  return (end === -1 ? definition.slice(1) : definition.slice(1, end)).trim();
}

/** Expands the shorthand characters and splits the definition into raw fields. */
function fields(definition: string): string[] {
  const start = definition.indexOf('|', 1);
  if (start === -1) throw new Error('Side-bet definition has no field list');
  // The replacement order matters: `)` expands to text containing `#`, and both
  // `)` and `(` expand to `@`, which only becomes a field in the last step.
  const expanded = definition
    .slice(start)
    .replaceAll(')', '@@#')
    .replaceAll('(', '@'.repeat(10))
    .replaceAll(']', '|-1')
    .replaceAll('[', '|-99')
    .replaceAll('#', '|10')
    .replaceAll('~', '|10')
    .replaceAll('@', '|0');
  // Reading starts at index 2: field 0 is the text before the leading
  // `|` (empty) and field 1 is a separator left over from the name.
  return expanded.split('|').slice(2);
}

/** Sequential reader over the raw fields. */
function reader(raw: string[]) {
  let at = 0;
  const next = (): string | undefined => raw[at++];
  return {
    flag: () => Number(next()) !== 0,
    int: () => Math.floor(Number(next()) || 0),
    number: () => Number(next()) || 0,
    text: () => String(next() ?? '').trim(),
    /** Reads `rows` x `cols` values with `read`, returning one array per row. */
    grid: <T>(rows: number, cols: number, read: () => T): T[][] =>
      Array.from({ length: rows }, () => Array.from({ length: cols }, read)),
    column: <T>(rows: number, read: () => T): T[] => Array.from({ length: rows }, read),
  };
}

/** A single bonus or side-bet rule. */
export interface SideBetRule {
  enabled: boolean;
  /** Pay the rule when the true count is above `trueCountThreshold` instead of below. */
  aboveThreshold: boolean;
  /** [player cards, dealer cards, pattern]; see the spec for the codes. */
  mixMatch: number[];
  /** Card count / total / suit conditions and five unused slots. */
  playerCombo: number[];
  allowedAfterSplit: boolean;
  winRequired: boolean;
  allowedAfterDouble: boolean;
  acesCountOne: boolean;
  /** Payout multiplier in tenths (x:1 = payTenths / 10). */
  payTenths: number;
  /** Flat amount added to a win. */
  payFixed: number;
  trueCountThreshold: number;
  /** Dealer card count / total / suit conditions. */
  dealerCombo: number[];
  /** Six player ranks, six dealer ranks, then up / hole / last card. */
  exactCards: number[];
  twentyOneAlwaysWins: boolean;
  streakLength: number;
  /** Two-character label shown on the table ('' when unused). */
  sideBetId: string;
  sideBetDealerLimit: number;
  sideBetMinLimit: number;
}

/** A decoded game: its rules plus the flags that apply to the whole game. */
export interface SideBetGame {
  name: string;
  /** Always `RULE_COUNT` long. */
  rules: SideBetRule[];
  /** Evaluate only the player's first two cards. */
  firstTwoCardsOnly: boolean;
  /** Merge the two side-bet spots into one. */
  merge: boolean;
  /** Accumulate every matching rule instead of stopping at the first. */
  nonAdditive: boolean;
  /** Rules from this index on are side bets, not hand bonuses. */
  forcedSideBet: number;
  /** Resolve side bets at settlement instead of right after the deal. */
  delayed: boolean;
}

/** Decodes a side-bet / bonus game definition string. */
export function decodeSideBetGame(definition: string): SideBetGame {
  const r = reader(fields(definition));
  const aboveThreshold = r.column(RULE_COUNT, r.flag);
  const mixMatch = r.grid(RULE_COUNT, 3, r.int);
  const playerCombo = r.grid(RULE_COUNT, 9, r.int);
  const checks = r.grid(RULE_COUNT, 5, r.flag);
  const pay = r.grid(RULE_COUNT, 5, r.int);
  const dealerCombo = r.grid(RULE_COUNT, 4, r.int);
  const exactCards = r.grid(RULE_COUNT, 15, r.int);
  const twentyOneAlwaysWins = r.column(RULE_COUNT, r.flag);
  const streakLength = r.column(RULE_COUNT, r.int);
  const sideBetId = r.column(RULE_COUNT, r.text);
  const sideBetDealerLimit = r.column(RULE_COUNT, r.int);
  const sideBetMinLimit = r.column(RULE_COUNT, r.number);
  const firstTwoCardsOnly = r.flag();
  const merge = r.flag();
  const nonAdditive = r.flag();
  const forcedSideBet = r.int();
  const delayed = r.flag();

  const rules = Array.from({ length: RULE_COUNT }, (_, i): SideBetRule => ({
    enabled: checks[i][0],
    aboveThreshold: aboveThreshold[i],
    mixMatch: mixMatch[i],
    playerCombo: playerCombo[i],
    allowedAfterSplit: checks[i][1],
    winRequired: checks[i][2],
    allowedAfterDouble: checks[i][3],
    acesCountOne: checks[i][4],
    payTenths: pay[i][0],
    payFixed: pay[i][1],
    trueCountThreshold: pay[i][2],
    dealerCombo: dealerCombo[i],
    exactCards: exactCards[i],
    twentyOneAlwaysWins: twentyOneAlwaysWins[i],
    streakLength: streakLength[i],
    sideBetId: sideBetId[i],
    sideBetDealerLimit: sideBetDealerLimit[i],
    sideBetMinLimit: sideBetMinLimit[i],
  }));

  return {
    name: sideBetGameName(definition),
    rules,
    firstTwoCardsOnly,
    merge,
    nonAdditive,
    forcedSideBet: forcedSideBet || DEFAULT_FORCED_SIDE_BET,
    delayed,
  };
}
