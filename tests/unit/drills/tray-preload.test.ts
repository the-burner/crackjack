// @vitest-environment jsdom
// A drill's tray photos are loaded when it starts, so a test deep in the shoe
// shows its tray at once.

import { describe, it, expect, vi } from 'vitest';
import { preloadTrayImages, trayImage } from '@/drills/shared/discard-tray';

describe('preloadTrayImages', () => {
  it('loads and decodes every photo a shoe can show, once', () => {
    const decode = vi.fn(() => Promise.resolve());
    HTMLImageElement.prototype.decode = decode;
    preloadTrayImages(2, 'eightDeckFront');
    preloadTrayImages(2, 'eightDeckFront');
    const photos = new Set([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(d => trayImage(d, 'eightDeckFront')!.src));
    expect(decode).toHaveBeenCalledTimes(photos.size);
  });
});
