import { describe, it, expect } from 'vitest';
import {
  betCells,
  betLabel,
  gridGeometry,
  cellIndexAt,
  drawTile,
  COLUMNS,
  ROWS,
  TILE,
  TILE_GAP,
} from '../../../src/game/table/bet-grid.ts';
import { trayPhoto, shoePhoto } from '../../../src/game/table/photos.ts';

const ramp = (...rows) => ({
  minCount: 0,
  rows: rows.map(r => (Array.isArray(r) ? { chips: r[0], hands: r[1] } : { chips: r, hands: 1 })),
});

describe('bet cells', () => {
  it('turns chip counts into amounts', () => {
    expect(betCells({ ramp: ramp(1, 2, 5, 10, 15), chipValue: 5 }).map(c => c.amount)).toEqual([5, 10, 25, 50, 75]);
  });

  it('labels multi-hand bets', () => {
    const cells = betCells({ ramp: ramp([2, 3]), chipValue: 10 });
    expect(cells[0]).toMatchObject({ amount: 20, hands: 3, label: '3x20' });
  });

  it('collapses rows that repeat the row before them', () => {
    expect(betCells({ ramp: ramp(1, 1, 1, 2, 2, 5), chipValue: 5 }).map(c => c.amount)).toEqual([5, 10, 25]);
  });

  it('keeps a repeat that comes back later', () => {
    expect(betCells({ ramp: ramp(1, 2, 1), chipValue: 5 }).map(c => c.amount)).toEqual([5, 10, 5]);
  });

  it('never offers more bets than the grid holds', () => {
    const wide = ramp(...Array.from({ length: 18 }, (_, i) => i + 1));
    expect(betCells({ ramp: wide, chipValue: 1 })).toHaveLength(COLUMNS * ROWS);
  });

  it('shortens thousands', () => {
    expect(betLabel(1000)).toBe('1K');
    expect(betLabel(2500)).toBe('2.5K');
    expect(betLabel(999)).toBe('999');
    expect(betLabel(1000, 2)).toBe('2x1K');
  });
});

describe('grid geometry', () => {
  const geometry = gridGeometry({ width: 601, height: 301, count: 8 });

  it('divides the box into six columns and three rows', () => {
    expect(geometry.tileWidth).toBe(100);
    expect(geometry.tileHeight).toBe(100);
  });

  it('makes one rectangle per cell, filling rows left to right', () => {
    expect(geometry.rects).toHaveLength(8);
    expect(geometry.rects[0]).toEqual({ x: 1, y: 1, width: 100, height: 100 });
    expect(geometry.rects[5]).toMatchObject({ x: 501, y: 1 });
    expect(geometry.rects[6]).toMatchObject({ x: 1, y: 101 });
  });

  it('counts only the rows it used', () => {
    expect(geometry.rows).toBe(2);
    expect(gridGeometry({ width: 600, height: 300, count: 3 }).rows).toBe(1);
  });

  it('never lays out more than the grid holds', () => {
    expect(gridGeometry({ width: 600, height: 300, count: 99 }).rects).toHaveLength(COLUMNS * ROWS);
  });

  it('finds the cell under a point', () => {
    expect(cellIndexAt({ x: 5, y: 5 }, geometry)).toBe(0);
    expect(cellIndexAt({ x: 550, y: 5 }, geometry)).toBe(5);
    expect(cellIndexAt({ x: 5, y: 150 }, geometry)).toBe(6);
  });

  it('reports a miss outside the cells', () => {
    expect(cellIndexAt({ x: 250, y: 150 }, geometry)).toBe(-1);
    expect(cellIndexAt({ x: 5, y: 250 }, geometry)).toBe(-1);
    expect(cellIndexAt({ x: -5, y: 5 }, geometry)).toBe(-1);
  });
});

describe('drawing a tile', () => {
  /** A canvas context that only remembers what it was told to draw. */
  const recorder = () => ({
    calls: [],
    beginPath() {
      this.calls.push(['beginPath']);
    },
    roundRect(...args) {
      this.calls.push(['roundRect', ...args]);
    },
    fill() {
      this.calls.push(['fill', this.fillStyle]);
    },
    fillText(text, x, y) {
      this.calls.push(['fillText', this.fillStyle, text, x, y]);
    },
  });

  const tile = over => {
    const ctx = recorder();
    drawTile(ctx, {
      x: 100,
      y: 200,
      width: 60,
      height: 40,
      label: '25',
      color: TILE.normal,
      font: '12px sans',
      ...over,
    });
    return ctx.calls;
  };

  it('insets the face from its cell on every side', () => {
    expect(tile()).toContainEqual([
      'roundRect',
      100 + TILE_GAP,
      200 + TILE_GAP,
      60 - 2 * TILE_GAP,
      40 - 2 * TILE_GAP,
      8,
    ]);
  });

  it('fills the face with the colour it was given', () => {
    expect(tile({ color: TILE.single })).toContainEqual(['fill', TILE.single[1]]);
  });

  it('centres the label on the tile', () => {
    expect(tile()).toContainEqual(['fillText', '#ffffff', '25', 130, 220]);
  });

  it('writes on a marked tile in dark text instead of white', () => {
    expect(tile({ color: TILE.previous })).toContainEqual(['fillText', '#000000', '25', 130, 220]);
    expect(tile({ color: TILE.selected })).toContainEqual(['fillText', '#000000', '25', 130, 220]);
  });

  it('leaves an unlabelled tile blank', () => {
    expect(tile({ label: '' }).some(([call]) => call === 'fillText')).toBe(false);
  });
});

describe('tray and shoe photos', () => {
  it('shows an empty tray before any cards are dealt', () => {
    expect(trayPhoto(0, '6deck').number).toBe(351);
    expect(trayPhoto(0, '8deck').number).toBe(303);
    expect(trayPhoto(0, '2deck').number).toBe(382);
  });

  it('fills up as cards are dealt', () => {
    expect(trayPhoto(1, '6deck').number).toBe(350);
    expect(trayPhoto(65, '6deck').number).toBe(340);
    expect(trayPhoto(10000, '6deck').number).toBe(304);
  });

  it('points at a file that exists', () => {
    expect(trayPhoto(100, '8deck').src).toBe('assets/trays/table/287.jpg');
  });

  it('shows an empty shoe when nothing is left', () => {
    expect(shoePhoto(0).number).toBe(180);
  });

  it('empties as the shoe is used', () => {
    expect(shoePhoto(416).number).toBe(148);
    expect(shoePhoto(13).number).toBe(179);
    expect(shoePhoto(5).number).toBe(179);
    expect(shoePhoto(99999).number).toBe(145);
    expect(shoePhoto(208).src).toBe('assets/shoe/164.jpg');
  });
});
