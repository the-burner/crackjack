import { describe, it, expect } from 'vitest';
import { seatPositions } from '@/lib/seat-arc';

describe('seat positions', () => {
  it('puts one seat in the middle at the bottom', () => {
    const [only] = seatPositions(1);
    expect(only.seat).toBe(1);
    expect(only.x).toBeCloseTo(0.5);
    expect(only.y).toBeCloseTo(0.78);
  });

  it('runs seat 1 at the right to the last at the left, along an arc that dips in the middle', () => {
    for (const count of [2, 4, 6]) {
      const seats = seatPositions(count);
      expect(seats.map(s => s.seat)).toEqual(Array.from({ length: count }, (_, i) => i + 1));
      const xs = seats.map(s => s.x);
      expect(xs).toEqual([...xs].sort((a, b) => b - a));
      // Mirror images about the middle.
      seats.forEach((s, i) => {
        expect(s.x + seats[count - 1 - i].x).toBeCloseTo(1);
        expect(s.y).toBeCloseTo(seats[count - 1 - i].y);
      });
      if (count > 2) expect(seats[Math.floor(count / 2)].y).toBeGreaterThan(seats[0].y);
    }
  });

  it('spreads more seats wider, inside the drawing', () => {
    const width = (count: number) => seatPositions(count)[0].x - seatPositions(count)[count - 1].x;
    expect(width(2)).toBeLessThan(width(4));
    expect(width(4)).toBeLessThan(width(6));
    for (const { x, y } of seatPositions(6)) {
      expect(x).toBeGreaterThan(0.05);
      expect(x).toBeLessThan(0.95);
      expect(y).toBeLessThan(0.9);
    }
  });
});
