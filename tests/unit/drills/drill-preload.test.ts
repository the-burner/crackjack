// @vitest-environment jsdom
// The tray drills load every tray photo their shoe can show as they are shown (during the countdown), so no test waits for one.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp } from '../../support/render';

describe.each(['depth', 'count'] as const)('%s drill', drill => {
  // The photo cache is per module: a fresh one for each drill.
  beforeEach(() => vi.resetModules());

  it('decodes all the tray photos of its shoe as it is shown', async () => {
    const decoded = new Set<string>();
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      decoded.add(new URL(this.src).pathname.slice(1));
      return Promise.resolve();
    };
    const { trayImage } = await import('@/drills/shared/discard-tray');
    const create =
      drill === 'depth'
        ? (await import('@/drills/depth/controller')).createDepthDrill
        : (await import('@/drills/count/controller')).createCountDrill;
    vi.useFakeTimers();
    const app = createTestApp();
    app.settings.update({ [`drills.${drill}.decks`]: 8, [`drills.${drill}.trayStyle`]: 'eightDeckFront' });
    create(app).shell.show();
    vi.useRealTimers();
    const photos = Array.from({ length: 33 }, (_, quarter) => trayImage(quarter / 4, 'eightDeckFront')?.src).filter(
      Boolean,
    );
    expect([...decoded].filter(src => src.includes('trays')).sort()).toEqual([...new Set(photos)].sort());
  });
});
