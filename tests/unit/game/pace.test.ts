import { describe, it, expect } from 'vitest';
import { SessionPace } from '@/game/pace';

describe('session pace', () => {
  it('counts only the time the table shows, and rounds per hour over it', () => {
    let now = 0;
    const pace = new SessionPace(() => now);
    expect(pace.perHour()).toBe(0);
    pace.resume();
    now = 60_000;
    pace.rounds = 2;
    expect(pace.seconds()).toBe(60);
    expect(pace.perHour()).toBe(120);
    pace.pause();
    now = 600_000;
    expect(pace.seconds()).toBe(60);
    pace.resume();
    pace.resume();
    now = 660_000;
    expect(pace.seconds()).toBe(120);
    pace.reset();
    expect([pace.seconds(), pace.rounds]).toEqual([0, 0]);
    now = 720_000;
    expect(pace.seconds()).toBe(60);
  });
});
