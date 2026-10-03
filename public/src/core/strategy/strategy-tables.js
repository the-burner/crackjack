// Builds the effective playing tables for a strategy file under a given set of
// table rules, index limits and count adjustments.
//
// Every table is indexed [row][column]. Columns 0..9 are the dealer upcard
// 2,3,...,9,T,A. Extended strategies add columns 10..22 for dealer totals.
// Cells hold either an index number (take the action when the count is at or
// above it), NEVER/ALWAYS, or a special code from SPECIAL_CODES.

import { NEVER, ALWAYS, NO_ENTRY, VARIANT, TABLE_NAMES, parseStrategyFile, parseBasicStrategyFile } from './strategy-file.js';
import { BASIC_STRATEGY_FILE } from '../../data/strategy-files.js';

export const INDEX_SETS = ['all', 'illustrious18', 'sweet16', 'catch20', 'none', 'custom'];

/** Special cell codes. Some are resolved while building tables, the rest by the advisor. */
export const CODE = {
  surrender10v6Only: 1001,
  surrenderExcept87: 1002,
  sevenSevenHitBelow0Else13: 1003,
  standWith3OrMoreCards: 1004,
  doubleUnless62: 1005,
  sevenSevenHitBelow1Else15: 1006,
  sevenSevenByDecks: 1007,
  hitBelow2ShoeElse0: 1008,
  hitUnless77AtMinus6: 1009,
  pivot: 1010,
  pivotPlus2: 1011,
  hitUnless77AtMinus1: 1012,
  ninefiveRule: 1013,
  sevenSevenByDecksElseHit: 1014,
  insuranceIndex: 1015,
  negativeInsuranceIndex: 1016,
  plus3PerDeck: 1017,
  minus7PerDeck: 1018,
  hit102: 1019,
  noDouble29Or38: 1020,
  standUnless3Cards: 1021,
  standUnless4Cards: 1022,
  standUnless5Cards: 1023,
  standUnless6Cards: 1024,
  doubleUnless3Cards: 1025,
  doubleUnless4Cards: 1026,
  doubleUnless5Cards: 1027,
  doubleUnless6Cards: 1028,
  surrenderUnless3Cards: 1029,
  surrender3Or4Cards: 1030,
  surrenderUnless4Cards: 1031,
  surrenderFirstTwoOnly: 1032,
  standUnless4CardsOr678: 1033,
  standUnless5CardsOr678: 1034,
  standUnless5CardsOrSuited678: 1035,
  standUnless5CardsOrSpaded678: 1036,
  standUnless6CardsOrSpaded678: 1037,
  splitUnlessSuitedSevens: 1038,
  quarterCountByDecks: 1039,
  keyCount: 1040,
  startingCount: 1041,
  realPivot: 1042,
  group1: 1043,
  group2: 1044,
  group3: 1045,
  group4: 1046,
  group5: 1047,
};

/** Display text for special codes, shown in the strategy table viewer. */
export const CODE_DESCRIPTIONS = {
  1001: '*A - Surrender 10,6 only',
  1002: '*B - Surrender except for 8,7',
  1003: '*C - 7,7 Hit < 0; else Hit < 13',
  1004: '*D - Stand with 3 or more cards',
  1005: '*E - <-5 Hit; >=6 Double; else Double if not 6,2',
  1006: '*F - 7,7 Hit < 1; else Hit < 15',
  1007: '*G - 7,7 Hit < 6 with 2-deck; Hit < 11 with shoe',
  1008: '*H - Hit < 2 with shoe; else Hit < 0',
  1009: '*I - Hit unless 7,7 vs. 10 and >= -6',
  1010: '*J - Pivot',
  1011: '*K - Pivot+2',
  1012: '*L - Hit unless 7,7 vs. 10 and >= -1',
  1013: '*M - If 9,5 then 6 else 5',
  1014: '*N - If 7,7: 0 for 1 deck or 4 for 2 deck; else hit',
  1015: '*O - Use Insurance Table',
  1016: '*P - Use Negative of Insurance Table',
  1017: '*VR - 21 + 3 * remaining decks',
  1018: '*VP - 21 - 7 * remaining decks',
  1019: '*Q - Hit 10,2',
  1020: "*R - Don't Double 2,9 and 3,8",
  1021: '*S3 - Stand, except hit with 3 or more cards',
  1022: '*S4 - Stand, except hit with 4 or more cards',
  1023: '*S5 - Stand, except hit with 5 or more cards',
  1024: '*S6 - Stand, except hit with 6 or more cards',
  1025: '*D3 - Double, except hit with 3 or more cards',
  1026: '*D4 - Double, except hit with 4 or more cards',
  1027: '*D5 - Double, except hit with 5 or more cards',
  1028: '*D6 - Double, except hit with 6 or more cards',
  1029: '*R3 - Surrender, except hit with 3 or more cards',
  1030: '*R3* - Stand with 3 or 4 cards and hit with 5 cards',
  1031: '*R4 - Surrender, except hit with 4 or more cards',
  1032: '*Rh - Surrender on first two cards, otherwise hit',
  1033: '*S4* - Hit with 4 or more cards or any 678 possible',
  1034: '*S5* - Hit with 5 or more cards or any 678 possible',
  1035: "*S5' - Hit with 5 or more cards or suited 678 possible",
  1036: '*S5" - Hit with 5 or more cards or spaded 678 possible',
  1037: '*S6" - Hit with 6 or more cards or spaded 678 possible',
  1038: '*P$ - Split, except hit when two sevens are suited',
  1039: '*QC - for 1, 2, 4, 6 & 8 decks - 2, 0, -3, -6 & -10',
  1040: '*KC - Key Count',
  1041: '*SC - Starting Count',
  1042: '*RP - Real Pivot',
  1043: '*G1 - Group I',
  1044: '*G2 - Group II',
  1045: '*G3 - Group III',
  1046: '*G4 - Group IV',
  1047: '*G5 - Group V',
};

/** Insurance codes that replace the per-deck insurance index. */
export const INSURANCE = { byTotalTable: 9998, never: 9999, pivot: -9999 };

/** Cells that the Illustrious 18 / Sweet 16 / Catch 20 index sets keep. */
const ILLUSTRIOUS_18_SPLITS = [[1, 3], [1, 4]];
const ILLUSTRIOUS_18_HARD_STANDS = [[1, 7], [1, 8], [2, 8], [4, 0], [4, 1], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4]];
const ILLUSTRIOUS_18_HARD_DOUBLES = [[0, 9], [1, 8], [1, 9], [2, 0], [2, 5]];
const CATCH_20_SOFT_DOUBLES = [[1, 3], [1, 4]];
const CATCH_20_EXTRA_HARD_DOUBLES = [[3, 3], [3, 4]];
const FAB_4_SURRENDERS = [[2, 7], [2, 8], [2, 9], [3, 8]];

const QUARTER_COUNT_BY_DECKS = { 1: 2, 2: 0, 3: -2, 4: -3, 5: -5, 6: -6, 7: -8, 8: -10 };

const ROWS = 10;
const BASE_COLUMNS = 10;
const EXTENDED_COLUMNS = 23;

const contains = (cells, k, l) => cells.some(([r, c]) => r === k && c === l);

/** Rounds like VBScript CInt (banker's rounding). */
function roundHalfEven(n) {
  const i = Math.floor(n);
  const d = n - i - 0.5;
  if (d === 0) return i % 2 === 0 ? i : i + 1;
  return d > 0 ? i + 1 : i;
}

let cachedBasic = null;
function basicTemplate() {
  cachedBasic ??= parseBasicStrategyFile(BASIC_STRATEGY_FILE);
  return cachedBasic;
}

/**
 * @typedef {object} TableOptions
 * @property {number} decks              Number of decks in play (1-8).
 * @property {boolean} hitSoft17          Dealer hits soft 17.
 * @property {boolean} doubleAfterSplit
 * @property {boolean} noHoleCard
 * @property {string}  indexSet           One of INDEX_SETS.
 * @property {boolean} [fab4]             Keep the "Fab 4" surrender indices when limiting indices.
 * @property {object}  [customMask]       For indexSet 'custom': {split, hardStand, ...} boolean grids; true keeps the index.
 * @property {number}  [rangeHigh=99]     Indices above this become ALWAYS.
 * @property {number}  [rangeLow=-99]     Indices below this become NEVER.
 * @property {number|null} [forcedInitialRunningCount] Adjust indices to start every count at this value.
 */

/**
 * Builds the tables and count parameters for a strategy.
 * @param {string|object} file  Strategy file text, or an already parsed file.
 * @param {TableOptions} options
 */
export function buildStrategy(file, options) {
  const f = typeof file === 'string' ? parseStrategyFile(file) : structuredClone(file);
  const {
    decks, hitSoft17, doubleAfterSplit, noHoleCard, fab4 = false, customMask = null,
    forcedInitialRunningCount = null,
  } = options;
  let { indexSet = 'all', rangeHigh = 99, rangeLow = -99 } = options;
  const basic = structuredClone(basicTemplate());
  const columns = f.extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const multiDeck = decks > f.decks + 1;

  if (f.extended) {
    // Extended strategies always use their full index set.
    rangeHigh = 99;
    rangeLow = -99;
    if (indexSet !== 'none') indexSet = 'all';
  }

  const fileCell = (variant, table, k, l) =>
    l >= BASE_COLUMNS ? f.extendedTables[variant][table][k][l - BASE_COLUMNS] : f.tables[variant][table][k][l];
  const emptyTables = () => Object.fromEntries(TABLE_NAMES.map(n => [n, Array.from({ length: ROWS }, () => new Array(columns))]));
  const tables = emptyTables();
  const eachCell = (cols, fn) => {
    for (let k = 0; k < ROWS; k++) for (let l = 0; l < cols; l++) fn(k, l);
  };

  // Count values (index 1..10 = A,2..9,T).
  const countValues = f.countValues.slice();
  const countValuesBlack = f.redBlack ? f.countValuesBlack.slice() : f.countValues.slice();
  countValues[0] = undefined;
  countValuesBlack[0] = undefined;

  let ircAdjust = 0;
  const insuranceByDecks = f.insuranceByDecks.slice();
  const initialRunningCount = f.initialRunningCount.slice();
  if (forcedInitialRunningCount !== null) {
    ircAdjust = forcedInitialRunningCount - initialRunningCount[decks - 1];
    for (let i = 0; i < 8; i++) {
      insuranceByDecks[i + 1] += (forcedInitialRunningCount - initialRunningCount[i]) * 10;
      initialRunningCount[i] = forcedInitialRunningCount;
    }
  }

  // 1. Start from the variant matching the deck count and soft-17 rule.
  let variant = VARIANT.base;
  if (multiDeck && hitSoft17 && f.variants.multiDeck && f.variants.hitSoft17) variant = VARIANT.hitSoft17MultiDeck;
  else if (multiDeck && f.variants.multiDeck) variant = VARIANT.multiDeck;
  else if (hitSoft17 && f.variants.hitSoft17) variant = VARIANT.hitSoft17;
  eachCell(columns, (k, l) => TABLE_NAMES.forEach((name, t) => { tables[name][k][l] = fileCell(variant, t, k, l); }));

  // 2. Overlay double-after-split entries.
  if (f.variants.doubleAfterSplit && doubleAfterSplit) {
    variant = multiDeck && f.variants.multiDeck ? VARIANT.doubleAfterSplitMultiDeck : VARIANT.doubleAfterSplit;
    eachCell(columns, (k, l) => {
      const split = fileCell(variant, 0, k, l);
      if (split > NO_ENTRY) tables.split[k][l] = split;
      const v = tables.split[k][l];
      // Packed "soft17/hard17" split indices: the hundreds part applies here.
      if (v > -20000 && v < -10201) tables.split[k][l] = Math.floor((v + 20000) / 100) - 50;
      if (!f.extended) {
        TABLE_NAMES.slice(1).forEach((name, i) => {
          const x = fileCell(variant, i + 1, k, l);
          if (x > NO_ENTRY) tables[name][k][l] = x;
        });
      }
    });
  }

  // 3. Overlay no-hole-card entries.
  if (f.variants.noHoleCard && noHoleCard) {
    variant = VARIANT.noHoleCard;
    eachCell(columns, (k, l) => {
      TABLE_NAMES.forEach((name, t) => {
        const x = fileCell(variant, t, k, l);
        if (x > NO_ENTRY) tables[name][k][l] = x;
      });
    });
  }

  // Basic-strategy fallback tables for the same rules.
  {
    let v = VARIANT.base;
    if (decks > 1 && hitSoft17) v = VARIANT.hitSoft17MultiDeck;
    else if (multiDeck) v = VARIANT.multiDeck;
    else if (hitSoft17) v = VARIANT.hitSoft17;
    for (let t = 0; t < 6; t++) eachCell(BASE_COLUMNS, (k, l) => { basic[0][t][k][l] = basic[v][t][k][l]; });
    const overlay = from => {
      for (let t = 0; t < 6; t++) eachCell(BASE_COLUMNS, (k, l) => { if (basic[from][t][k][l] > NO_ENTRY) basic[0][t][k][l] = basic[from][t][k][l]; });
    };
    if (doubleAfterSplit) overlay(decks > 1 ? VARIANT.doubleAfterSplitMultiDeck : VARIANT.doubleAfterSplit);
    if (noHoleCard) overlay(VARIANT.noHoleCard);
  }
  const basicTables = Object.fromEntries(TABLE_NAMES.map((name, t) => [name, basic[0][t].slice(0, ROWS).map(r => r.slice(0, BASE_COLUMNS))]));

  // 4. Resolve pivot-based codes for running-count (unbalanced) systems.
  const pivotSum = () => {
    let p = 0;
    for (let i = 1; i <= 9; i++) p += countValues[i] === 10000 ? 5 : countValues[i];
    for (let i = 1; i <= 9; i++) p += countValuesBlack[i];
    return 4 * (p / 2 + 4 * countValues[10]);
  };
  const unbalanced = pivotSum() !== 0;
  let pivot = 1;
  let realPivot = 0;
  if (f.trueCountType === 2) {
    pivot = (pivotSum() * decks) / 10;
    realPivot = pivot + initialRunningCount[decks - 1];
    const insuranceIndex = insuranceByDecks[decks] / 10;
    eachCell(columns, (k, l) => {
      for (const name of TABLE_NAMES) {
        const v = tables[name][k][l];
        if (v === CODE.insuranceIndex) tables[name][k][l] = insuranceIndex;
        else if (v === CODE.negativeInsuranceIndex) tables[name][k][l] = -insuranceIndex + (name === 'hardStand' ? 1 : 0);
        else if (v === CODE.pivot) tables[name][k][l] = pivot;
        else if (v === CODE.realPivot) tables[name][k][l] = realPivot;
        else if (v === CODE.pivotPlus2) tables[name][k][l] = pivot + 2;
      }
    });
  }

  // 5. Group codes take their value from the per-deck group table.
  const groups = f.groups[decks - 1];
  eachCell(columns, (k, l) => {
    for (const name of TABLE_NAMES) {
      const v = tables[name][k][l];
      if (v >= CODE.group1 && v <= CODE.group5) tables[name][k][l] = groups[v - CODE.group1];
    }
  });

  // Insurance decision parameter.
  let insurance = [INSURANCE.never, INSURANCE.pivot, INSURANCE.byTotalTable].includes(f.insuranceCode)
    ? f.insuranceCode
    : insuranceByDecks[decks];
  if (f.insuranceCode === INSURANCE.pivot) {
    insurance = pivot * 10;
    if (decks > 2) insurance += 20;
  }

  // 6. Limit the index set by reverting cells to basic strategy.
  const useBasic = (name, k, l) => { tables[name][k][l] = basic[0][TABLE_NAMES.indexOf(name)][k][l]; };
  if (indexSet === 'none') {
    eachCell(BASE_COLUMNS, (k, l) => TABLE_NAMES.forEach(name => useBasic(name, k, l)));
  }
  const sweet16 = indexSet === 'sweet16' || indexSet === 'catch20';
  const catch20 = indexSet === 'catch20' && !f.extended;
  if (indexSet === 'illustrious18' || sweet16) {
    eachCell(BASE_COLUMNS, (k, l) => {
      if (sweet16 || !contains(ILLUSTRIOUS_18_SPLITS, k, l)) useBasic('split', k, l);
      if (!contains(ILLUSTRIOUS_18_HARD_STANDS, k, l)) useBasic('hardStand', k, l);
      if (!(catch20 && contains(CATCH_20_SOFT_DOUBLES, k, l))) useBasic('softDouble', k, l);
      if (!contains(ILLUSTRIOUS_18_HARD_DOUBLES, k, l) && !(catch20 && contains(CATCH_20_EXTRA_HARD_DOUBLES, k, l))) useBasic('hardDouble', k, l);
      useBasic('softStand', k, l);
      if (!(fab4 && contains(FAB_4_SURRENDERS, k, l))) useBasic('surrender', k, l);
    });
  }
  if (indexSet === 'custom' && customMask) {
    applyCustomMask(tables, basic, customMask, { decks, fileDecks: f.decks, doubleAfterSplit, noHoleCard, fileDoubleAfterSplit: f.variants.doubleAfterSplit, earlySurrender: f.earlySurrender });
  }

  // 7. Index range, deck-dependent codes and initial running count adjustment.
  const limitRange = rangeHigh < 99 || rangeLow > -99;
  eachCell(columns, (k, l) => {
    for (const name of TABLE_NAMES) {
      let v = tables[name][k][l];
      if (limitRange) v = limitToRange(v, rangeLow, rangeHigh);
      if (v === CODE.quarterCountByDecks) v = QUARTER_COUNT_BY_DECKS[decks];
      if (v >= -99 && v <= 99) v = roundHalfEven(v) + roundHalfEven(ircAdjust);
      tables[name][k][l] = v;
    }
  });

  let halves = false;
  for (let i = 1; i <= 9; i++) if ([5, 15, -5].includes(countValues[i])) halves = true;

  return {
    name: f.name,
    file: f,
    decks,
    tables,
    basicTables,
    countValues,
    countValuesBlack,
    kiss: f.kiss,
    halves,
    unbalanced,
    trueCountType: f.trueCountType,
    insurance,
    insuranceByTotal: f.insuranceByTotal.slice(),
    insuranceByDecks,
    initialRunningCount,
    ircAdjust,
    pivot,
    realPivot,
    groups: f.groups,
    sideCounts: f.sideCounts.slice(),
    extended: f.extended,
    earlySurrender: f.earlySurrender,
  };
}

/** Applies the index range limit to one cell. */
function limitToRange(v, low, high) {
  if (v < -31000 && v > NEVER) {
    // "Below" indices are stored offset by -31500.
    return Math.abs(v + 31500) > high ? NEVER : v;
  }
  let out = v;
  if (v > high && v < 1000) out = ALWAYS;
  if (v < low) out = NEVER;
  return out;
}

/** Custom index set: cells not selected in the mask revert to basic strategy. */
function applyCustomMask(tables, basic, mask, { decks, fileDecks, doubleAfterSplit, noHoleCard, fileDoubleAfterSplit, earlySurrender }) {
  const masks = TABLE_NAMES.map(name => mask[name]);
  for (let k = 0; k < ROWS; k++) {
    for (let l = 0; l < BASE_COLUMNS; l++) {
      for (let t = 0; t < 5; t++) if (!masks[t][k][l]) tables[TABLE_NAMES[t]][k][l] = basic[0][t][k][l];
      if (!masks[5][k][l]) {
        // With early surrender the mask's row 8 maps onto surrender row 6.
        const row = earlySurrender && k === 8 ? 6 : k;
        tables.surrender[row][l] = basic[0][5][k][l];
      }
    }
  }
  const overlay = from => {
    for (let k = 0; k < ROWS; k++) for (let l = 0; l < BASE_COLUMNS; l++) {
      for (let t = 0; t < 6; t++) {
        if (basic[from][t][k][l] > NO_ENTRY && !masks[t][k][l]) tables[TABLE_NAMES[t]][k][l] = basic[from][t][k][l];
      }
    }
  };
  if (fileDoubleAfterSplit && doubleAfterSplit) overlay(decks > fileDecks + 1 ? VARIANT.doubleAfterSplitMultiDeck : VARIANT.doubleAfterSplit);
  if (noHoleCard) overlay(VARIANT.noHoleCard);
}
