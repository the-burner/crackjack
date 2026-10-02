// Depth drills: a photo of a discard tray is shown and the player says how
// deep the shoe is (or converts a running count to a true count).

import { decksRemaining, roundTrueCount, COUNT_UNIT } from '../../core/counting.js';
import { CARDS_PER_DECK } from '../../core/cards.js';
import { AnswerGrid } from '../shared/answer-grid.js';
import { trayImage } from '../shared/discard-tray.js';
import { mixedNumber } from '../shared/format.js';

/** Steps per deck the chosen resolution asks about. */
export const RESOLUTION_STEPS = { full: 1, half: 2, quarter: 4 };

/** What each drill asks for, as a multiple of the decks it is about. */
const DRILL_UNITS = { decksLeft: 1, halfDecksLeft: 2, quarterDecksLeft: 4, acesLeft: 4 };

export const DRILL_LABELS = {
  decksLeft: 'Decks Left', halfDecksLeft: 'Half Decks Left', quarterDecksLeft: 'Quarter Decks Left',
  acesLeft: 'Aces Left', trueCount: 'TC Conversion', trueCountAndDecks: 'TC Conv. & Decks',
};

/** The two drills that ask for a true count rather than a depth. */
export const isTrueCountDrill = drill => drill === 'trueCount' || drill === 'trueCountAndDecks';

/** Running counts the true-count drills draw from, and the answers they accept. */
const RUNNING_COUNT_RANGE = { low: -35, high: 65 };
const TRUE_COUNT_ANSWERS = { low: -14, high: 16 };
const TC_COLUMNS = 8;
const TC_ROWS = 4;
/** The bottom-left cell of the true-count grid stands for -15, which is never asked. */
const TC_LOWEST = TRUE_COUNT_ANSWERS.low - 1;

/**
 * The answer grid: one column per whole deck, that deck's steps stacked upwards.
 * A cell's value is the number of steps left, so "within 1" means one step.
 * @param {object} o
 * @param {string} o.drill
 * @param {number} o.decks
 * @param {string} o.resolution  full | half | quarter
 * @param {boolean} o.askInTray  Ask about the cards in the tray instead of those left.
 */
export function depthGrid({ drill, decks, resolution, askInTray }) {
  if (isTrueCountDrill(drill)) return trueCountGrid();
  const steps = RESOLUTION_STEPS[resolution];
  // Cells sit on quarter-deck lines; full resolution uses only the whole-deck
  // line and half resolution leaves the quarter lines empty.
  const quartersPerStep = 4 / steps;
  const rows = { 1: 1, 2: 3, 4: 4 }[steps];
  const topQuarter = 4 - rows;
  const cells = [];
  for (let left = 0; left < decks * steps; left++) {
    const column = Math.floor(left / steps);
    const quarters = (left % steps) * quartersPerStep;
    cells.push({
      row: 3 - quarters - topQuarter,
      column,
      value: left,
      label: left === 0 ? '' : depthLabel(left / steps, { drill, decks, askInTray }),
    });
  }
  return new AnswerGrid({ cells, rows, columns: decks });
}

function trueCountGrid() {
  const cells = [];
  for (let column = 0; column < TC_COLUMNS; column++) {
    for (let quarters = 0; quarters < TC_ROWS; quarters++) {
      const value = TC_LOWEST + 4 * column + quarters;
      cells.push({ row: 3 - quarters, column, value, label: value < TRUE_COUNT_ANSWERS.low ? '' : String(value) });
    }
  }
  return new AnswerGrid({ cells, rows: TC_ROWS, columns: TC_COLUMNS });
}

/** The label of a cell: the depth the drill asks about, in its own units. */
export function depthLabel(decksLeft, { drill, decks, askInTray }) {
  const depth = askInTray ? decks - decksLeft : decksLeft;
  return mixedNumber(depth * DRILL_UNITS[drill]);
}

/**
 * One depth test.
 * @param {object} o
 * @param {number} o.decks
 * @param {string} o.resolution
 * @param {string} o.drill
 * @param {boolean} o.askInTray
 * @param {string} o.trayStyle
 * @param {{min: number, max: number}} o.countRange  Running counts the TC drills use.
 * @param {object} o.strategy
 * @param {object} o.trueCountSettings
 * @param {number|null} o.previousAnswer  Never asked twice in a row.
 * @param {() => number} o.random
 * @returns {object|null} the test, or null when this draw is unusable
 */
export function generateDepthTest(o) {
  const steps = RESOLUTION_STEPS[o.resolution];
  const total = o.decks * steps;
  // Never the full shoe and never an empty one.
  const left = Math.floor(o.random() * (total - 1)) + 1;
  const decksLeft = left / steps;
  const decksInTray = o.decks - decksLeft;
  const tray = trayImage(decksInTray, o.trayStyle);
  if (!tray) return null;
  const test = { decksLeft, decksInTray, tray, panel: '' };

  if (!isTrueCountDrill(o.drill)) {
    // No two tests in a row share an answer - unless there is only one to give.
    if (total > 2 && left === o.previousAnswer) return null;
    return { ...test, answer: left };
  }

  const runningCount = drawRunningCount(o.countRange, o.random);
  if (runningCount === null) return null;
  const answer = trueCountFor(runningCount, decksInTray, o);
  if (answer < TRUE_COUNT_ANSWERS.low || answer > TRUE_COUNT_ANSWERS.high) return null;
  if (answer === o.previousAnswer) return null;
  const panel = o.drill === 'trueCount'
    ? `RC: ${runningCount} Decks: ${mixedNumber(decksInTray)}`
    : `RC: ${runningCount}`;
  return { ...test, answer, runningCount, panel };
}

/** A running count inside the user's range; null when the range holds none. */
function drawRunningCount({ min, max }, random) {
  const low = Math.max(min, RUNNING_COUNT_RANGE.low);
  const high = Math.min(max, RUNNING_COUNT_RANGE.high);
  if (low >= high) return null;
  const span = RUNNING_COUNT_RANGE.high - RUNNING_COUNT_RANGE.low;
  for (let attempt = 0; attempt < 500; attempt++) {
    const count = Math.floor(random() * span) + RUNNING_COUNT_RANGE.low;
    if (count >= min && count < max) return count;
  }
  return null;
}

const UNITS_PER_DECK = { [COUNT_UNIT.halfDeck]: 2, [COUNT_UNIT.quarterDeck]: 4, [COUNT_UNIT.deck]: 1 };

/** The true count the user should work out from the running count and the tray. */
export function trueCountFor(runningCount, decksInTray, { decks, strategy, trueCountSettings }) {
  const unitsPerDeck = UNITS_PER_DECK[strategy.trueCountType];
  if (!unitsPerDeck) return runningCount;
  const divisor = decksRemaining({
    decks,
    cardsGone: decksInTray * CARDS_PER_DECK,
    countUnit: strategy.trueCountType,
    division: trueCountSettings.division,
    lastDeck: trueCountSettings.lastDeck,
  });
  return roundTrueCount(runningCount / (divisor * unitsPerDeck), trueCountSettings.rounding);
}

/** The deepest deck count each tray style can show. */
export const TRAY_CAPACITY = {
  eightDeckFront: 8, sixDeckFront: 6, doubleDeckFront: 2, sixDeckRear: 6, doubleDeckRear: 2,
};

/**
 * A tray style that can hold `decks` decks: the chosen one when it fits, else
 * the next bigger one (what the original silently switched to).
 */
export function trayStyleFor(style, decks) {
  if (TRAY_CAPACITY[style] >= decks) return style;
  if (decks <= 6) return style.endsWith('Rear') ? 'sixDeckRear' : 'sixDeckFront';
  return 'eightDeckFront';
}
