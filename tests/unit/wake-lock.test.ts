import { describe, it, expect } from 'vitest';
import { ScreenWakeLock } from '@/services/wake-lock';

type FakeSentinel = {
  released: boolean;
  addEventListener: (type: string, fn: () => void) => void;
  release: () => Promise<void>;
};

/** A stand-in for navigator.wakeLock and the document's visibility. */
function fakes() {
  const sentinels: FakeSentinel[] = [];
  const api = {
    request: () => {
      const listeners: (() => void)[] = [];
      const sentinel: FakeSentinel = {
        released: false,
        addEventListener: (_, fn) => listeners.push(fn),
        release: async () => {
          sentinel.released = true;
          listeners.forEach(fn => fn());
        },
      };
      sentinels.push(sentinel);
      return Promise.resolve(sentinel as unknown as WakeLockSentinel);
    },
  };
  let onVisibility: (() => void) | null = null;
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => {
      onVisibility = fn;
    },
  } as Pick<Document, 'visibilityState' | 'addEventListener'>;
  return { api, doc, sentinels, visibility: () => onVisibility?.() };
}

const settle = () => new Promise(resolve => setTimeout(resolve));

describe('ScreenWakeLock', () => {
  it('holds one lock for any number of holders and lets it go with the last', async () => {
    const { api, doc, sentinels } = fakes();
    const lock = new ScreenWakeLock(api, doc);
    const a = lock.hold();
    const b = lock.hold();
    await settle();
    expect(sentinels).toHaveLength(1);
    a();
    a();
    expect(sentinels[0].released).toBe(false);
    b();
    expect(sentinels[0].released).toBe(true);
  });

  it('asks again when the page comes back, since the browser dropped it', async () => {
    const { api, doc, sentinels, visibility } = fakes();
    const lock = new ScreenWakeLock(api, doc);
    lock.hold();
    await settle();
    await sentinels[0].release();
    visibility();
    await settle();
    expect(sentinels).toHaveLength(2);
  });

  it('does nothing where the browser has no wake lock', () => {
    const lock = new ScreenWakeLock(undefined, undefined);
    expect(() => lock.hold()()).not.toThrow();
  });
});
