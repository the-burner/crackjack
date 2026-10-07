// The grid of answer buttons the Depth, Count and Full drills use, drawn on a
// canvas as rounded tiles.
//
// A grid is a list of cells; each cell has a label, a position (row, column)
// and the answer it stands for. Cells with no label are gaps.

import { setupCanvas } from '@/ui/card-sprites';
import { cssVar } from '@/ui/theme';

export type CellState = 'idle' | 'correct' | 'close' | 'wrong';

export interface GridCell {
  row: number;
  column: number;
  /** Shifts the cell sideways by part of a column. */
  offset?: number;
  label: string;
  value: number;
}

type ColorVar = readonly [name: string, fallback: string];

/** Cell states and their colors. */
const COLORS: Record<CellState, { fill: ColorVar; text: ColorVar }> = {
  idle: { fill: ['--tile-bg', '#0000c4'], text: ['--tile-text', '#ffffff'] },
  correct: { fill: ['--tile-good', '#00ff00'], text: ['--tile-mark-text', '#000000'] },
  close: { fill: ['--tile-close', '#ffff00'], text: ['--tile-mark-text', '#000000'] },
  wrong: { fill: ['--tile-bad', '#ff0000'], text: ['--tile-mark-text', '#000000'] },
};

interface TileColors {
  fill: string;
  text: string;
}

const resolve = ([name, fallback]: ColorVar): string => cssVar(name, fallback);

export class AnswerGrid {
  cells: GridCell[];
  rows: number;
  columns: number;
  states = new Map<GridCell, CellState>();

  constructor({ cells, rows, columns }: { cells: GridCell[]; rows: number; columns: number }) {
    this.cells = cells;
    this.rows = rows;
    this.columns = columns;
  }

  /** The cell standing for `value`, or null. */
  cellFor(value: number): GridCell | null {
    return this.cells.find(c => c.value === value) ?? null;
  }

  /** The cell at a pixel position inside a box of `width` x `height`, or null. */
  cellAt(x: number, y: number, width: number, height: number): GridCell | null {
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

  /** Marks a cell; marking no cell does nothing. */
  mark(cell: GridCell | null, state: CellState): void {
    if (cell) this.states.set(cell, state);
  }

  clearMarks(): void {
    this.states.clear();
  }

  /** Draws the grid, sizing the canvas for the device pixel ratio. */
  draw(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    { smallText = false }: { smallText?: boolean } = {},
  ): CanvasRenderingContext2D {
    const ctx = setupCanvas(canvas, width, height);
    const cellWidth = width / this.columns;
    const cellHeight = height / this.rows;
    ctx.clearRect(0, 0, width, height);
    ctx.font = `600 ${smallText ? 18 : 24}px ${cssVar('--font', 'Helvetica, Arial, sans-serif')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tile = (state: CellState): TileColors => ({
      fill: resolve(COLORS[state].fill),
      text: resolve(COLORS[state].text),
    });
    const colors: Record<CellState, TileColors> = {
      idle: tile('idle'),
      correct: tile('correct'),
      close: tile('close'),
      wrong: tile('wrong'),
    };
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
const cellLeft = (cell: GridCell): number => cell.column + (cell.offset ?? 0);

/** One answer button: a rounded tile with centred text. */
function drawTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  { fill, text }: TileColors,
): void {
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
 * @param o.lowest   Value of the bottom-left cell.
 * @param o.include  Cells to leave blank.
 */
export function numberGrid({
  rows,
  columns,
  lowest,
  format = String,
  include = () => true,
}: {
  rows: number;
  columns: number;
  lowest: number;
  format?: (value: number) => string;
  include?: (value: number) => boolean;
}): AnswerGrid {
  const cells: GridCell[] = [];
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
 * @returns the new lowest value of the window
 */
export function windowContaining(answer: number, lowest: number, size: number): number {
  const step = Math.floor(size / 2);
  let low = lowest;
  while (answer < low) low -= step;
  while (answer > low + size - 1) low += step;
  return low;
}

/** Draws a grid so it fills its wrapper element. */
export function drawGridIn(
  grid: AnswerGrid,
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  { smallText }: { smallText?: boolean } = {},
): void {
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  if (width < 2 || height < 2) return;
  grid.draw(canvas, width, height, { smallText: smallText ?? width < 400 });
}
