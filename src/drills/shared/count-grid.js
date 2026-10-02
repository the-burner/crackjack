// The 3 x 6 answer grid the Flash index test, the Count drill and the Full
// table drill share.
//
// The grid shows 18 consecutive *answer indices*. For most drills an index is
// the answer itself; for half-point counting systems one index is half a point,
// so the labels show halves and the "within 1" tolerance means within half a
// point — exactly as the original did.

import { numberGrid, windowContaining } from './answer-grid.js';
import { mixedNumber } from './format.js';

export const GRID_ROWS = 3;
export const GRID_COLUMNS = 6;
export const GRID_SIZE = GRID_ROWS * GRID_COLUMNS;
/** Where the window starts: zero sits in the middle row, as it did originally. */
export const INITIAL_WINDOW = -8;

/** A grid of the 18 indices starting at `lowest`, lowest at the bottom left. */
export function countGrid(lowest, format = String) {
  return numberGrid({ rows: GRID_ROWS, columns: GRID_COLUMNS, lowest, format });
}

/**
 * Moves the visible window (in steps of 9) until it contains `index`.
 * The window keeps its new position for later tests.
 */
export function countWindow(index, lowest) {
  return windowContaining(index, lowest, GRID_SIZE);
}

/** Label for an index that counts half a point: 5 -> "2½", -1 -> "-½". */
export const halfStepLabel = index => mixedNumber(index / 2);
