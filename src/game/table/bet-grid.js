// The canvas grid of bet buttons: a 6 x 3 block of bevelled tiles, one per bet
// the player's ramp allows, plus the drawing and hit-testing it needs.

import { normalizeRamp } from '../../settings/bet-ramp.js';

export const COLUMNS = 6;
export const ROWS = 3;
/** Tile colours, as the original drew them. */
export const TILE = { normal: '#0000c4', single: '#00ff00', previous: '#dc780c', selected: '#ff0000' };

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

/**
 * Draws one Win95-style bevelled tile: black outline, white highlight on the
 * top and left, grey shadow on the bottom and right, a coloured face and a
 * centred label.
 */
export function drawBevelButton(ctx, { x, y, width, height, label, color, font }) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y + 1, width - 2, 2);
  ctx.fillRect(x + 1, y + 1, 2, height - 2);
  ctx.fillStyle = '#808080';
  ctx.fillRect(x + 1, y + height - 3, width - 2, 2);
  ctx.fillRect(x + width - 3, y + 1, 2, height - 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 3, width - 6, height - 6);
  if (!label) return;
  ctx.fillStyle = color === TILE.normal ? '#ffffff' : '#000000';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2);
}
