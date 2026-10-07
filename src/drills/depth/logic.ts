// Depth drills: a photo of a discard tray is shown and the player says how
// deep the shoe is (or converts a running count to a true count).

import { decksRemaining, roundTrueCount } from '@/core/counting';
import type { CounterSettings } from '@/core/counting';
import { CARDS_PER_DECK } from '@/core/cards';
import type { Random } from '@/core/random';
import type { Strategy } from '@/core/strategy/strategy-tables';
import { AnswerGrid } from '@/drills/shared/answer-grid';
import type { GridCell } from '@/drills/shared/answer-grid';
import { UNITS_PER_DECK } from '@/drills/shared/count-answers';
import { trayImage } from '@/drills/shared/discard-tray';
import type { TrayPhoto } from '@/drills/shared/discard-tray';
import { mixedNumber } from '@/drills/shared/format';

export type DepthDrill =
  'decksLeft' | 'halfDecksLeft' | 'quarterDecksLeft' | 'acesLeft' | 'trueCount' | 'trueCountAndDecks';
export type Resolution = 'full' | 'half' | 'quarter';
type TrueCountDrill = 'trueCount' | 'trueCountAndDecks';

/** Steps per deck the chosen resolution asks about. */
export const RESOLUTION_STEPS: Readonly<Record<Resolution, number>> = { full: 1, half: 2, quarter: 4 };

/** What each drill asks for, as a multiple of the decks it is about. */
const DRILL_UNITS: Readonly<Record<Exclude<DepthDrill, TrueCountDrill>, number>> = {
  decksLeft: 1,
  halfDecksLeft: 2,
  quarterDecksLeft: 4,
  acesLeft: 4,
};

export const DRILL_LABELS: Readonly<Record<DepthDrill, string>> = {
  decksLeft: 'Decks Left',
  halfDecksLeft: 'Half Decks Left',
  quarterDecksLeft: 'Quarter Decks Left',
  acesLeft: 'Aces Left',
  trueCount: 'TC Conversion',
  trueCountAndDecks: 'TC Conv. & Decks',
};

/** The two drills that ask for a true count rather than a depth. */
export const isTrueCountDrill = (drill: string): drill is TrueCountDrill =>
  drill === 'trueCount' || drill === 'trueCountAndDecks';

/** Running counts the true-count drills draw from, and the answers they accept. */
const RUNNING_COUNT_RANGE = { low: -35, high: 65 };
const TRUE_COUNT_ANSWERS = { low: -14, high: 16 };
const TC_COLUMNS = 8;
const TC_ROWS = 4;
/** The bottom-left cell of the true-count grid stands for -15, which is never asked. */
const TC_LOWEST = TRUE_COUNT_ANSWERS.low - 1;

export interface DepthGridOptions {
  drill: DepthDrill;
  decks: number;
  resolution: Resolution;
  /** Ask about the cards in the tray instead of those left. */
  askInTray: boolean;
}

/**
 * The answer grid: one column per whole deck, that deck's steps stacked upwards
 * with the whole decks along the bottom. A cell's value is the number of steps
 * left, so "within 1" means one step.
 *
 * The bottom row is offset half a column, so each whole deck sits between the
 * fractions either side of it, like a piano's black keys, and reading the rows
 * in a zig-zag gives the depths in order.
 */
export function depthGrid({ drill, decks, resolution, askInTray }: DepthGridOptions): AnswerGrid {
  if (isTrueCountDrill(drill)) return trueCountGrid();
  const steps = RESOLUTION_STEPS[resolution];
  const cells: GridCell[] = [];
  // Zero is never asked, so the bottom row starts at one whole deck.
  for (let left = 1; left < decks * steps; left++) {
    const step = left % steps;
    cells.push({
      row: steps - 1 - step,
      column: Math.floor(left / steps),
      offset: step === 0 ? -0.5 : 0,
      value: left,
      label: depthLabel(left / steps, { drill, decks, askInTray }),
    });
  }
  // A single deck has no whole-deck key, so the grid is only as tall as the
  // fractions it does show.
  const rows = cells.length ? Math.max(...cells.map(c => c.row)) + 1 : 1;
  return new AnswerGrid({ cells, rows, columns: decks });
}

function trueCountGrid(): AnswerGrid {
  const cells: GridCell[] = [];
  for (let column = 0; column < TC_COLUMNS; column++) {
    for (let quarters = 0; quarters < TC_ROWS; quarters++) {
      const value = TC_LOWEST + 4 * column + quarters;
      cells.push({ row: 3 - quarters, column, value, label: value < TRUE_COUNT_ANSWERS.low ? '' : String(value) });
    }
  }
  return new AnswerGrid({ cells, rows: TC_ROWS, columns: TC_COLUMNS });
}

/** The label of a cell: the depth the drill asks about, in its own units. */
export function depthLabel(
  decksLeft: number,
  { drill, decks, askInTray }: { drill: Exclude<DepthDrill, TrueCountDrill>; decks: number; askInTray: boolean },
): string {
  const depth = askInTray ? decks - decksLeft : decksLeft;
  return mixedNumber(depth * DRILL_UNITS[drill]);
}

export interface DepthTestOptions extends TrueCountOptions {
  resolution: Resolution;
  drill: DepthDrill;
  askInTray: boolean;
  trayStyle: string;
  /** Running counts the TC drills use. */
  countRange: CountRange;
  /** Never asked twice in a row. */
  previousAnswer: number | null;
  random: Random;
}

/** What `trueCountFor` needs to know about the shoe and the count. */
export interface TrueCountOptions {
  decks: number;
  strategy: Pick<Strategy, 'trueCountType'>;
  trueCountSettings: Pick<CounterSettings, 'division' | 'lastDeck' | 'rounding'>;
}

interface CountRange {
  min: number;
  max: number;
}

/** One question: a tray photo, the text over it and the answer. */
export interface DepthTest {
  decksLeft: number;
  decksInTray: number;
  tray: TrayPhoto;
  /** Shown above the tray (the running count, for the TC drills). */
  panel: string;
  /** The answer's value in the grid. */
  answer: number;
  runningCount?: number;
}

/**
 * One depth test.
 * @returns the test, or null when this draw is unusable
 */
export function generateDepthTest(o: DepthTestOptions): DepthTest | null {
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
  const panel =
    o.drill === 'trueCount' ? `RC: ${runningCount} Decks: ${mixedNumber(decksInTray)}` : `RC: ${runningCount}`;
  return { ...test, answer, runningCount, panel };
}

/** A running count inside the user's range; null when the range holds none. */
function drawRunningCount({ min, max }: CountRange, random: Random): number | null {
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

/** The true count the user should work out from the running count and the tray. */
export function trueCountFor(
  runningCount: number,
  decksInTray: number,
  { decks, strategy, trueCountSettings }: TrueCountOptions,
): number {
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
export const TRAY_CAPACITY: Readonly<Record<string, number>> = {
  eightDeckFront: 8,
  sixDeckFront: 6,
  doubleDeckFront: 2,
  sixDeckRear: 6,
  doubleDeckRear: 2,
};

/**
 * A tray style that can hold `decks` decks: the chosen one when it fits, else
 * the next bigger one.
 */
export function trayStyleFor(style: string, decks: number): string {
  if (TRAY_CAPACITY[style] >= decks) return style;
  if (decks <= 6) return style.endsWith('Rear') ? 'sixDeckRear' : 'sixDeckFront';
  return 'eightDeckFront';
}
