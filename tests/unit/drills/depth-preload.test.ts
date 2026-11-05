// @vitest-environment jsdom
// The Depth drill loads every tray photo its shoe can show as it starts, so no test waits for one.

import { describe, it, expect, vi } from 'vitest';
import { createTestApp } from '../../support/render';
import { createDepthDrill } from '@/drills/depth/controller';
import { trayImage } from '@/drills/shared/discard-tray';

describe('depth drill', () => {
  it('decodes all the tray photos of its shoe as it starts', () => {
    const decoded = new Set<string>();
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      decoded.add(new URL(this.src).pathname.slice(1));
      return Promise.resolve();
    };
    vi.useFakeTimers();
    const app = createTestApp();
    app.settings.update({ 'drills.depth.decks': 8, 'drills.depth.trayStyle': 'eightDeckFront' });
    createDepthDrill(app).shell.show();
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    const photos = Array.from({ length: 33 }, (_, quarter) => trayImage(quarter / 4, 'eightDeckFront')?.src).filter(
      Boolean,
    );
    expect([...decoded].sort()).toEqual([...new Set(photos)].sort());
  });
});
