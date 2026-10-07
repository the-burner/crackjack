import { describe, it, expect } from 'vitest';
import { durationColumns, joinDuration } from '../../src/ui/time-wheel.js';

describe('duration wheels within the setting maximum', () => {
  it('shows a one minute limit as seconds alone', () => {
    expect(durationColumns(60).map(c => [c.unit, c.count])).toEqual([['s', 61]]);
  });

  it('never offers a duration above the maximum', () => {
    for (const max of [15, 30, 40, 60, 1799]) {
      const columns = durationColumns(max);
      expect(
        joinDuration(
          columns.map(c => c.count - 1),
          columns,
        ),
      ).toBe(max);
    }
  });
});
