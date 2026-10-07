import { describe, it, expect } from 'vitest';
import { doubleTapDetector, DOUBLE_TAP_MS, DOUBLE_TAP_DISTANCE } from '@/lib/double-tap';

describe('doubleTapDetector', () => {
  it('reports the second of two quick, close taps', () => {
    const tap = doubleTapDetector();
    expect(tap({ x: 100, y: 100, t: 0 })).toBe(false);
    expect(tap({ x: 105, y: 102, t: 200 })).toBe(true);
  });

  it('ignores taps too far apart in time or space', () => {
    const tap = doubleTapDetector();
    tap({ x: 100, y: 100, t: 0 });
    expect(tap({ x: 100, y: 100, t: DOUBLE_TAP_MS + 1 })).toBe(false);
    expect(tap({ x: 100 + DOUBLE_TAP_DISTANCE + 1, y: 100, t: DOUBLE_TAP_MS + 50 })).toBe(false);
  });

  it('starts over after a double tap, so three taps make one', () => {
    const tap = doubleTapDetector();
    tap({ x: 0, y: 0, t: 0 });
    expect(tap({ x: 0, y: 0, t: 100 })).toBe(true);
    expect(tap({ x: 0, y: 0, t: 200 })).toBe(false);
  });
});
