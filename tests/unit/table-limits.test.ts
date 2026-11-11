import { describe, it, expect } from 'vitest';
import { LIMIT_STEPS } from '@/settings/table-limits';

describe('the table limit steps', () => {
  it("run from $1 to $100,000 through the amounts tables use, every CBJN table's minimum and maximum among them", () => {
    expect(LIMIT_STEPS).toEqual([
      1, 2, 3, 5, 10, 15, 20, 25, 50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500,
      3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000, 25000, 30000, 40000, 50000, 60000, 70000, 80000, 90000,
      100000,
    ]);
  });
});
