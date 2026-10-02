// The grid of answer buttons the Depth, Count and Full drills use, drawn on a
// canvas with the original bevelled look.
//
// A grid is a list of cells; each cell has a label, a position (row, column)
// and the answer it stands for. Cells with no label are gaps.

import { setupCanvas } from '../../ui/card-sprites.js';

/** Cell states and their colors. */
const COLORS = {
  idle: { fill: '#0000c4', text: '#ffffff' },
  correct: { fill: '#00ff00', text: '#000000' },
  close: { fill: '#ffff00', text: '#000000' },
  wrong: { fill: '#ff0000', text: '#000000' },
};

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
    const column = Math.floor((x / width) * this.columns);
    const row = Math.floor((y / height) * this.rows);
    return this.cells.find(c => c.row === row && c.column === column && c.label !== '') ?? null;
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
    ctx.font = `bold ${smallText ? 18 : 26}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const cell of this.cells) {
      if (cell.label === '') continue;
      drawBevelledButton(ctx, cell.column * cellWidth, cell.row * cellHeight, cellWidth, cellHeight,
        cell.label, COLORS[this.states.get(cell) ?? 'idle']);
    }
    return ctx;
  }
}

/** One answer button: a 3-D bevel around a filled rectangle with centred text. */
function drawBevelledButton(ctx, x, y, width, height, label, { fill, text }) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + height - 1.5);
  ctx.lineTo(x + 1.5, y + 1.5);
  ctx.lineTo(x + width - 1.5, y + 1.5);
  ctx.stroke();
  ctx.strokeStyle = '#808080';
  ctx.beginPath();
  ctx.moveTo(x + width - 1.5, y + 1.5);
  ctx.lineTo(x + width - 1.5, y + height - 1.5);
  ctx.lineTo(x + 1.5, y + height - 1.5);
  ctx.stroke();
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
 * The original moved the window by half its size at a time and kept the new
 * position for later tests.
 * @returns {number} the new lowest value of the window
 */
export function windowContaining(answer, lowest, size) {
  const step = Math.floor(size / 2);
  let low = lowest;
  while (answer < low) low -= step;
  while (answer > low + size - 1) low += step;
  return low;
}
