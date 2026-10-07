import { describe, it, expect } from 'vitest';
import { DrillClock, TIMER_MODE } from '../../../src/drills/shared/drill-clock.ts';

describe('a DrillClock stopped while paused', () => {
  it('stays stopped when resumed', () => {
    let now = 100;
    const ticks: (() => void)[] = [];
    const clock = new DrillClock({
      mode: TIMER_MODE.countUp,
      limit: 60,
      now: () => now,
      // The id is never read back here.
      setTimer: fn => ticks.push(fn) as unknown as ReturnType<typeof setTimeout>,
      clearTimer: () => {},
    });
    clock.start();
    now = 105;
    clock.pause();
    clock.stop();
    const scheduled = ticks.length;
    clock.resume();
    now = 200;
    expect(clock.running).toBe(false);
    expect(clock.elapsed).toBe(5);
    expect(ticks.length).toBe(scheduled);
  });
});
