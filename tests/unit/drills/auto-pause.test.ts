import { describe, it, expect } from 'vitest';
import { autoPauseDue, intervalLeft, intervalTime, startAutoPause, takeAutoPause } from '@/drills/shared/auto-pause';

describe('pausing every interval', () => {
  it('is due once the interval of drill time has passed', () => {
    const pause = startAutoPause(180);
    expect(autoPauseDue(pause, 179.9)).toBe(false);
    expect(autoPauseDue(pause, 180)).toBe(true);
  });

  it('counts the next interval from when the pause was taken, so a late pause does not shorten it', () => {
    const { next } = takeAutoPause(startAutoPause(180), 186, { tests: 30, errors: 3 });
    expect(next.dueAt).toBe(366);
    expect(autoPauseDue(next, 365)).toBe(false);
  });

  it('sums up only the interval just ended', () => {
    const first = takeAutoPause(startAutoPause(180), 181, { tests: 50, errors: 5 });
    expect(first.message).toBe('3:00 done: 50 hands, 90%');
    const second = takeAutoPause(first.next, 362, { tests: 80, errors: 6 });
    expect(second.message).toBe('3:00 done: 30 hands, 96%');
  });

  it('says so when no hand was dealt in the interval', () => {
    expect(takeAutoPause(startAutoPause(60), 60, { tests: 0, errors: 0 }).message).toBe('1:00 done: 0 hands, 0%');
  });

  it('counts the interval down for the Time cell, and starts it over after each pause', () => {
    const pause = startAutoPause(180);
    expect(intervalLeft(pause, 0)).toEqual({ seconds: 180, overdue: false });
    expect(intervalLeft(pause, 179.2)).toEqual({ seconds: 1, overdue: false });
    // Up, while the last hand waits for its answer.
    expect(intervalLeft(pause, 185)).toEqual({ seconds: 0, overdue: true });
    const { next } = takeAutoPause(pause, 185, { tests: 10, errors: 0 });
    expect(intervalLeft(next, 185)).toEqual({ seconds: 180, overdue: false });
  });

  it('writes the interval as m:ss, or h:mm:ss from an hour', () => {
    expect(intervalTime(45)).toBe('0:45');
    expect(intervalTime(180)).toBe('3:00');
    expect(intervalTime(3600)).toBe('1:00:00');
  });
});
