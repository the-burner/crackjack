// The grid of answer buttons the Depth, Count and Full drills use, drawn on a
// canvas as rounded tiles.
//
// A grid is a list of cells; each cell has a label, a position (row, column)
// and the answer it stands for. Cells with no label are gaps.

import { setupCanvas } from '../../ui/card-sprites.js';
import { cssVar } from '../../ui/theme.js';

/** Cell states and their colors. */
const COLORS = {
  idle: { fill: ['--tile-bg', '#0000c4'], text: ['--tile-text', '#ffffff'] },
  correct: { fill: ['--tile-good', '#00ff00'], text: ['--tile-mark-text', '#000000'] },
  close: { fill: ['--tile-close', '#ffff00'], text: ['--tile-mark-text', '#000000'] },
  wrong: { fill: ['--tile-bad', '#ff0000'], text: ['--tile-mark-text', '#000000'] },
};

const resolve = ([name, fallback]) => cssVar(name, fallback);

export class AnswerGrid {
  /**
   * @param {object} o
   * @param {{row: number, column: number, label: string, value: *}[]} o.cells
   * @param {number} o.rows
   * @param {number} o.columns
   */
  constructor({ cells, rows, columns }) {
    this.cells = cells;
    this.rows = rows;
    this.columns = columns;
    this.states = new Map();
  }

  /** The cell standing for `value`, or null. */
  cellFor(value) {
    return this.cells.find(c => c.value === value) ?? null;
  }

  /** The cell at a pixel position inside a box of `width` x `height`, or null. */
  cellAt(x, y, width, height) {
    const cellWidth = width / this.columns;
    const row = Math.floor((y / height) * this.rows);
    return (
      this.cells.find(cell => {
        if (cell.row !== row || cell.label === '') return false;
        const left = cellLeft(cell) * cellWidth;
        return x >= left && x < left + cellWidth;
      }) ?? null
    );
  }

  mark(cell, state) {
    this.states.set(cell, state);
  }

  clearMarks() {
    this.states.clear();
  }

  /** Draws the grid, sizing the canvas for the device pixel ratio. */
  draw(canvas, width, height, { smallText = false } = {}) {
    const ctx = setupCanvas(canvas, width, height);
    const cellWidth = width / this.columns;
    const cellHeight = height / this.rows;
    ctx.clearRect(0, 0, width, height);
    ctx.font = `600 ${smallText ? 18 : 24}px ${cssVar('--font', 'Helvetica, Arial, sans-serif')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const colors = Object.fromEntries(
      Object.entries(COLORS).map(([state, { fill, text }]) => [state, { fill: resolve(fill), text: resolve(text) }]),
    );
    for (const cell of this.cells) {
      if (cell.label === '') continue;
      drawTile(
        ctx,
        cellLeft(cell) * cellWidth,
        cell.row * cellHeight,
        cellWidth,
        cellHeight,
        cell.label,
        colors[this.states.get(cell) ?? 'idle'],
      );
    }
    return ctx;
  }
}

/** A cell's left edge in columns; `offset` shifts a row sideways by part of a cell. */
const cellLeft = cell => cell.column + (cell.offset ?? 0);

/** One answer button: a rounded tile with centred text. */
function drawTile(ctx, x, y, width, height, label, { fill, text }) {
  const gap = 2;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x + gap, y + gap, width - 2 * gap, height - 2 * gap, 8);
  ctx.fill();
  ctx.fillStyle = text;
  ctx.fillText(label, x + width / 2, y + height / 2);
}

/**
 * A grid of consecutive numbers, lowest at the bottom left, increasing to the
 * right and upwards (the layout the Count, Full and index-test drills use).
 * @param {object} o
 * @param {number} o.rows
 * @param {number} o.columns
 * @param {number} o.lowest     Value of the bottom-left cell.
 * @param {(value: number) => string} [o.format]
 * @param {(value: number) => boolean} [o.include]  Cells to leave blank.
 */
export function numberGrid({ rows, columns, lowest, format = String, include = () => true }) {
  const cells = [];
  for (let i = 0; i < rows * columns; i++) {
    const value = lowest + i;
    const row = rows - 1 - Math.floor(i / columns);
    const column = i % columns;
    cells.push({ row, column, value, label: include(value) ? format(value) : '' });
  }
  return new AnswerGrid({ cells, rows, columns });
}

/**
 * Shifts a window of consecutive values so it contains `answer`.
 * The window moves by half its size at a time and keeps the new position for
 * later tests.
 * @returns {number} the new lowest value of the window
 */
export function windowContaining(answer, lowest, size) {
  const step = Math.floor(size / 2);
  let low = lowest;
  while (answer < low) low -= step;
  while (answer > low + size - 1) low += step;
  return low;
}

/**
 * Draws a grid so it fills its wrapper element.
 * @param {AnswerGrid} grid
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} wrap
 */
export function drawGridIn(grid, canvas, wrap, { smallText } = {}) {
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  if (width < 2 || height < 2) return;
  grid.draw(canvas, width, height, { smallText: smallText ?? width < 400 });
}
