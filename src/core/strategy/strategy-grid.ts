// @ts-nocheck
// Presentation model for the strategy table viewer: which rows and columns a
// table has, what each cell shows, and which colour it gets. Pure functions so
// the rendering rules can be unit tested.

import { NEVER, ALWAYS, NO_ENTRY } from './strategy-file.ts';
import { CODE_DESCRIPTIONS } from './strategy-tables.ts';

/** Cell colours. */
export const GRID_COLOR = {
  /** The table's own action (hit, double, split, play). */
  action: '#00ff00',
  /** The opposite action (stand, no double, no split, surrender). */
  opposite: '#ff0000',
  /** Take the action at or above the index shown. */
  index: '#00ffff',
  /** Take the action *below* the index shown. */
  below: '#0000ff',
  /** Not picked in the mask being edited. */
  unselected: '#c0c0c0',
  /** Error heat map: no errors recorded. */
  noErrors: '#404040',
  /** Error heat map: errors recorded. */
  errors: '#ff0000',
};

/** Lowest and highest value that is shown as a number rather than left blank. */
const MIN_SHOWN = -31000;
const MAX_SHOWN = 31000;
/** "Act below this index" cells are stored offset by -31500. */
const BELOW_OFFSET = 31500;
/** Special codes occupy this range. */
const FIRST_CODE = 1001;
const LAST_CODE = 1099;
/** Undocumented code that reuses the *VR description. */
const CODE_ALIAS = { 1098: 1017 };

/**
 * The seven views of the table picker, in the order the picker lists them.
 * `table` is the strategy table name (null for the counts view); `reversed`
 * means 32000 is the *opposite* action (double/split tables).
 */
export const TABLE_VIEWS = [
  {
    key: 'hardStand',
    label: 'Hard Hit/Stand',
    table: 'hardStand',
    reversed: false,
    below: false,
    rows: 8,
    extendedRows: 10,
    legend: ['Hit', 'Stand', 'Hit < Value', null],
  },
  {
    key: 'softStand',
    label: 'Soft Hit/Stand',
    table: 'softStand',
    reversed: false,
    below: false,
    rows: 8,
    extendedRows: 9,
    legend: ['Hit', 'Stand', 'Hit < Value', null],
  },
  {
    key: 'hardDouble',
    label: 'Hard Double Down',
    table: 'hardDouble',
    reversed: true,
    below: false,
    rows: 7,
    extendedRows: 7,
    legend: ['Double Down', 'No Double Down', 'DD >= Value', null],
  },
  {
    key: 'softDouble',
    label: 'Soft Double Down',
    table: 'softDouble',
    reversed: true,
    below: false,
    rows: 8,
    extendedRows: 9,
    legend: ['Double Down', 'No Double Down', 'DD >= Value', null],
  },
  {
    key: 'split',
    label: 'Split',
    table: 'split',
    reversed: true,
    below: true,
    rows: 10,
    extendedRows: 10,
    legend: ['Split', 'No Split', 'Split >= Value', 'Split < Value'],
  },
  {
    key: 'surrender',
    label: 'Surrender',
    table: 'surrender',
    reversed: false,
    below: true,
    rows: 10,
    extendedRows: 10,
    legend: ['Play', 'Surrender', 'Surr. >= Value', 'Surr. < Value'],
  },
  { key: 'counts', label: 'Insurance/Counts', table: null },
];

export const viewByKey = key => TABLE_VIEWS.find(v => v.key === key) ?? TABLE_VIEWS[0];

/** Number of rows shown for a view. */
export function rowCount(view, { extended = false } = {}) {
  return extended ? view.extendedRows : view.rows;
}

/**
 * Row labels (the left-hand column) for a view.
 * @param {object} view
 * @param {{extended?: boolean, earlySurrender?: boolean}} [o]
 */
export function rowLabels(view, { extended = false, earlySurrender = false } = {}) {
  const n = rowCount(view, { extended });
  switch (view.key) {
    case 'hardStand':
      if (extended) return range(n, i => String(21 - i));
      // 17..11, then one row for every hard total of 10 or less.
      return [...range(7, i => String(17 - i)), '2-10'];
    case 'hardDouble':
      return range(n, i => String(11 - i));
    case 'softStand':
    case 'softDouble':
      return extended ? ['AT', ...range(8, i => `A${9 - i}`)] : range(8, i => `A${9 - i}`);
    case 'split':
      return ['AA', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'];
    case 'surrender':
      return [...range(6, i => String(17 - i)), ...(earlySurrender ? ['88', '5', '6', '7'] : ['99', '88', '77', 'A7'])];
    default:
      return [];
  }
}

/** Column headers (dealer upcards, or player/dealer totals for extended files). */
export function columnLabels({ extended = false } = {}) {
  if (!extended) return ['2', '3', '4', '5', '6', '7', '8', '9', 'X', 'A'];
  return [...range(17, i => String(i + 4)), 'AA', 'A2', 'A3', 'A4', 'A5', 'A6'];
}

/**
 * How one cell of a strategy table is drawn.
 * @param {object} o
 * @param {number} o.value        Raw table value.
 * @param {object} o.view         A TABLE_VIEWS entry.
 * @param {boolean} [o.selected=true]  False greys the cell out (mask editing).
 * @param {number|null} [o.errorCount] When set, draw the error heat map instead.
 * @returns {{text: string, background: string, color: string}}
 */
export function gridCell({ value, view, selected = true, errorCount = null }) {
  if (errorCount !== null) {
    return errorCount > 0
      ? { text: String(errorCount), background: GRID_COLOR.errors, color: '#000' }
      : { text: '', background: GRID_COLOR.noErrors, color: '#fff' };
  }
  const cell = { text: '', background: GRID_COLOR.index, color: '#000' };
  if (value === ALWAYS) cell.background = view.reversed ? GRID_COLOR.opposite : GRID_COLOR.action;
  else if (value === NEVER) cell.background = view.reversed ? GRID_COLOR.action : GRID_COLOR.opposite;
  else {
    if (value > MIN_SHOWN && value < MAX_SHOWN) cell.text = String(value);
    if (view.below && value > NEVER && value < MIN_SHOWN) {
      cell.text = String(value + BELOW_OFFSET);
      cell.background = GRID_COLOR.below;
      cell.color = '#fff';
    }
    const code = specialCode(value);
    if (code !== null) {
      cell.text = codeSymbol(code);
      if (view.below && value === 1098) {
        cell.background = GRID_COLOR.below;
        cell.color = '#fff';
      }
    }
  }
  if (!selected) cell.background = GRID_COLOR.unselected;
  return cell;
}

/** The special code in a cell, or null. */
export function specialCode(value) {
  return value > FIRST_CODE - 1 && value < LAST_CODE + 1 && CODE_DESCRIPTIONS[CODE_ALIAS[value] ?? value]
    ? value
    : null;
}

/** The short symbol shown in a cell for a special code, e.g. 1001 -> "A". */
export function codeSymbol(code) {
  const text = CODE_DESCRIPTIONS[CODE_ALIAS[code] ?? code];
  const head = text.slice(0, 4);
  return (head.endsWith(' -') ? head.slice(0, 2) : head).slice(1).trim();
}

/** The legend row for a special code, e.g. 1001 -> "A - Surrender 10,6 only". */
export function codeDescription(code) {
  return CODE_DESCRIPTIONS[CODE_ALIAS[code] ?? code].slice(1);
}

/**
 * The "Specialty Plays" list for one view: every special code used by the
 * displayed cells, in reading order, without repeats.
 * @returns {string[]}
 */
export function specialtyPlays(table, view, { extended = false, columns = 10 } = {}) {
  const out = [];
  for (let row = 0; row < rowCount(view, { extended }); row++) {
    for (let column = 0; column < columns; column++) {
      const code = specialCode(table[row]?.[column]);
      if (code === null) continue;
      const text = codeDescription(code);
      if (!out.includes(text)) out.push(text);
    }
  }
  return out;
}

/** Insurance codes that replace the per-deck insurance table. */
const INSURANCE_RULES = { 9999: 'Never Insure', '-9999': 'Red Seven Rule', 9998: 'Use Insurance Hand Table' };

/** The sentence describing how the strategy decides on insurance. */
export function insuranceRuleText(insuranceCode) {
  return INSURANCE_RULES[insuranceCode] ?? 'Use Insurance Decks Table';
}

/** True when the per-deck insurance table applies (and so is worth showing). */
export function usesInsuranceDecksTable(insuranceCode) {
  return insuranceCode !== -9999 && insuranceCode < 9999;
}

/** A card value of 10000 means "counts only when the card is red". */
const RED_ONLY = 10000;

/**
 * The four small tables of the Insurance/Counts view.
 * @param {object} strategy  Result of buildStrategy().
 */
export function countsTables(strategy) {
  const { countValues, countValuesBlack, initialRunningCount, insuranceByDecks, insuranceByTotal, kiss, file } =
    strategy;
  const tenth = v => trimNumber(v / 10);
  // A red-only card has no plain point value, so the Red column shows "*".
  const point = (values, red) =>
    range(10, i => {
      if (kiss && i === 9) return `0/${tenth(values[10])}`;
      if (countValues[i + 1] === RED_ONLY) return red ? '*' : tenth(values[i + 1]);
      return tenth(values[i + 1]);
    });
  return {
    pointValues: {
      caption: 'Card Point Values',
      columns: ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'X'],
      rows: [
        { label: 'Red', values: point(countValues, true /* red */) },
        { label: 'Black', values: point(file.redBlack ? countValuesBlack : countValues, false /* red */) },
      ],
    },
    startingCount: {
      caption: 'Starting Count by Decks',
      columns: range(8, i => String(i + 1)),
      rows: [{ values: range(8, i => String(initialRunningCount[i])) }],
    },
    insuranceDecks: usesInsuranceDecksTable(file.insuranceCode)
      ? {
          caption: 'Insurance Decks Table',
          columns: range(8, i => String(i + 1)),
          rows: [{ values: range(8, i => tenth(insuranceByDecks[i + 1])) }],
        }
      : null,
    insuranceHands: {
      caption: 'Insurance Hands Table',
      columns: ['<13', '13', '14', '15', '16', '17', '18', '19', '20', 'BJ'],
      rows: [{ values: range(10, i => tenth(insuranceByTotal[i])) }],
    },
    rule: insuranceRuleText(file.insuranceCode),
  };
}

/** Cells of a view that hold a real index (the ones worth picking in a mask). */
export function isIndexCell(value) {
  return value !== ALWAYS && value !== NEVER && value !== NO_ENTRY;
}

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const trimNumber = n => String(Math.round(n * 1000) / 1000);
