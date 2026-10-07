// @ts-nocheck
// The canvas grid of bet buttons: a 6 x 3 block of tiles, one per bet
// the player's ramp allows, plus the drawing and hit-testing it needs.

import { normalizeRamp } from '../../settings/bet-ramp.ts';
import { cssVar } from '../../ui/theme.ts';

export const COLUMNS = 6;
export const ROWS = 3;
/** Space between a tile and its cell edge, so neighbouring tiles sit 2 x TILE_GAP apart. */
export const TILE_GAP = 2;
/** Tile colours: custom property and Classic fallback. */
export const TILE = {
  normal: ['--tile-bg', '#0000c4'],
  single: ['--tile-good', '#00ff00'],
  previous: ['--tile-previous', '#dc780c'],
  selected: ['--tile-bad', '#ff0000'],
};

/**
 * The bets the ramp offers, one per tile. Rows that repeat the row before them
 * collapse into one tile, so a flat ramp shows a single bet.
 * @param {object} o
 * @param {object} o.ramp        A betting.ramp value.
 * @param {number} o.chipValue
 * @returns {{chips: number, hands: number, amount: number, label: string}[]}
 */
export function betCells({ ramp, chipValue }) {
  const { rows } = normalizeRamp(ramp);
  const cells = [];
  for (const row of rows) {
    const last = cells[cells.length - 1];
    if (last && last.chips === row.chips && last.hands === row.hands) continue;
    const amount = row.chips * chipValue;
    cells.push({ chips: row.chips, hands: row.hands, amount, label: betLabel(amount, row.hands) });
  }
  return cells.slice(0, COLUMNS * ROWS);
}

/** "25", "2x25" for two hands, "1.5K" for a thousand or more. */
export function betLabel(amount, hands = 1) {
  const text = amount > 999 ? `${amount / 1000}K` : String(amount);
  return hands > 1 ? `${hands}x${text}` : text;
}

/**
 * Tile rectangles for a grid of `count` cells filling `width` x `height`.
 * @returns {{tileWidth: number, tileHeight: number, columns: number, rows: number, rects: {x: number, y: number, width: number, height: number}[]}}
 */
export function gridGeometry({ width, height, count, columns = COLUMNS, rows = ROWS }) {
  const used = Math.min(count, columns * rows);
  const usedRows = Math.max(1, Math.ceil(used / columns));
  const tileWidth = Math.floor((width - 1) / columns);
  const tileHeight = Math.floor((height - 1) / rows);
  const rects = [];
  for (let i = 0; i < used; i++) {
    rects.push({
      x: (i % columns) * tileWidth + 1,
      y: Math.floor(i / columns) * tileHeight + 1,
      width: tileWidth,
      height: tileHeight,
    });
  }
  return { tileWidth, tileHeight, columns, rows: usedRows, rects };
}

/** The cell a point falls in, or -1. */
export function cellIndexAt({ x, y }, geometry) {
  const column = Math.floor(x / geometry.tileWidth);
  const row = Math.floor(y / geometry.tileHeight);
  if (column < 0 || column >= geometry.columns || row < 0) return -1;
  const index = row * geometry.columns + column;
  return index < geometry.rects.length ? index : -1;
}

/** Draws one bet tile: a rounded, coloured face with a centred label. */
export function drawTile(ctx, { x, y, width, height, label, color, font }) {
  const gap = TILE_GAP;
  ctx.fillStyle = cssVar(...color);
  ctx.beginPath();
  ctx.roundRect(x + gap, y + gap, width - 2 * gap, height - 2 * gap, 8);
  ctx.fill();
  if (!label) return;
  ctx.fillStyle = color === TILE.normal ? cssVar('--tile-text', '#ffffff') : cssVar('--tile-mark-text', '#000000');
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2);
}
