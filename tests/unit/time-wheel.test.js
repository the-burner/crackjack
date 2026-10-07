import { describe, it, expect } from 'vitest';
import { durationColumns, joinDuration, splitDuration, tenthsColumns } from '../../src/ui/time-wheel.ts';

describe('duration wheels', () => {
  it('shows only the wheels a range needs', () => {
    expect(durationColumns(1799).map(c => [c.unit, c.count])).toEqual([
      ['min', 30],
      ['s', 60],
    ]);
    expect(durationColumns(7200).map(c => [c.unit, c.count])).toEqual([
      ['h', 3],
      ['min', 60],
      ['s', 60],
    ]);
    expect(durationColumns(45).map(c => [c.unit, c.count])).toEqual([['s', 46]]);
  });

  it('splits seconds across the wheels and joins them back', () => {
    const columns = durationColumns(7200);
    expect(splitDuration(3725, columns)).toEqual([1, 2, 5]);
    expect(joinDuration([1, 2, 5], columns)).toBe(3725);
    expect(splitDuration(185, durationColumns(1799))).toEqual([3, 5]);
  });

  it('keeps a picked duration within its range', () => {
    const columns = durationColumns(1799);
    expect(joinDuration([0, 3], columns, { min: 10, max: 1799 })).toBe(10);
    expect(joinDuration([29, 59], columns, { min: 10, max: 1799 })).toBe(1799);
  });

  it('splits tenths of a second into seconds and tenths', () => {
    const columns = tenthsColumns(59);
    expect(columns.map(c => [c.unit, c.count])).toEqual([
      ['.', 6],
      ['s', 10],
    ]);
    expect(splitDuration(8, columns)).toEqual([0, 8]);
    expect(splitDuration(25, columns)).toEqual([2, 5]);
    expect(joinDuration([5, 9], columns, { min: 1, max: 59 })).toBe(59);
    expect(joinDuration([0, 0], columns, { min: 1, max: 59 })).toBe(1);
  });
});
