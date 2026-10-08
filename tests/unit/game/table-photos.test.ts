// @vitest-environment jsdom
// The tray and shoe photographs: one per depth, so a new one loads as the
// tray fills or the shoe empties. The table must never show a blank slot.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawMasked, preloadTablePhotos, tablePhotos } from '@/game/table/photos';

/** Images that have "loaded", by src. */
const loaded = new Set<string>();
const drawnSrcs: string[] = [];

const ctx = {
  clearRect: () => {},
  drawImage: (img: unknown) => {
    if (img instanceof HTMLImageElement) drawnSrcs.push(img.getAttribute('src') ?? '');
  },
  globalCompositeOperation: 'source-over',
} as unknown as CanvasRenderingContext2D;

const rect = { x: 0, y: 0, width: 10, height: 10 };
const MASK = 'mask.png';
const draw = (photoSrc: string) => {
  drawnSrcs.length = 0;
  const drew = drawMasked(ctx, { photoSrc, maskSrc: MASK, ...rect }, () => {});
  return { drew, photo: drawnSrcs[0] };
};

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get(this: HTMLImageElement) {
      return loaded.has(this.getAttribute('src') ?? '') ? 10 : 0;
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  loaded.clear();
});

describe('drawMasked', () => {
  it('draws nothing before any photo of a slot has loaded', () => {
    loaded.add(MASK);
    expect(draw('first.jpg').drew).toBe(false);
  });

  it('keeps showing the last photo while the next one loads, then shows it', () => {
    loaded.add(MASK);
    loaded.add('a.jpg');
    expect(draw('a.jpg')).toEqual({ drew: true, photo: 'a.jpg' });
    // b.jpg is still loading: a.jpg stands in rather than a blank tray.
    expect(draw('b.jpg')).toEqual({ drew: true, photo: 'a.jpg' });
    loaded.add('b.jpg');
    expect(draw('b.jpg')).toEqual({ drew: true, photo: 'b.jpg' });
  });
});

describe('preloadTablePhotos', () => {
  it("asks for every tray photo of the table's series and every shoe photo, once", () => {
    const decode = vi.fn(() => Promise.resolve());
    HTMLImageElement.prototype.decode = decode;
    preloadTablePhotos('2deck');
    preloadTablePhotos('2deck');
    expect(tablePhotos('2deck')).toHaveLength(17 + 36);
    expect(decode).toHaveBeenCalledTimes(17 + 36);
  });
});
