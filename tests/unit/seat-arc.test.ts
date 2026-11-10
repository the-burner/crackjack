import { describe, it, expect } from 'vitest';
import { ENTRY_ANGLE, arcAtRest, arcFrame, seatPositions } from '@/lib/seat-arc';

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

describe('seats moving along the arc', () => {
  const at = (from: number, to: number, ms: number) => arcFrame(arcAtRest(from), to, ms);
  const angles = (seats: { angle: number }[]) => seats.map(s => s.angle);

  it('brings new seats in from the top-left end, unseen, and the old ones start where they were', () => {
    const { seats } = at(1, 6, 0);
    expect(seats[0]).toEqual(arcAtRest(1)[0]);
    for (const seat of seats.slice(1)) expect(seat).toMatchObject({ angle: ENTRY_ANGLE, opacity: 0 });
  });

  it('ends with every seat in its place, and the ones removed gone', () => {
    const grown = at(1, 6, 5000);
    expect(grown.done).toBe(true);
    expect(grown.seats).toEqual(arcAtRest(6));
    const shrunk = at(6, 1, 5000);
    expect(shrunk.done).toBe(true);
    expect(shrunk.seats).toEqual(arcAtRest(1));
    expect(at(6, 1, 100).done).toBe(false);
  });

  it('keeps the seats in order along the arc all the way, both ways, so none passes another', () => {
    for (const [from, to] of [
      [1, 6],
      [6, 1],
      [2, 4],
      [6, 4],
    ]) {
      for (let ms = 0; ms <= 1000; ms += 25) {
        const shown = angles(at(from, to, ms).seats);
        expect(shown, `${from} to ${to} at ${ms}ms`).toEqual([...shown].sort((a, b) => a - b));
      }
    }
  });

  it('sends removed seats out the way new ones come in, fading, the nearest the end first', () => {
    const { seats } = at(6, 4, 200);
    const [five, six] = seats.slice(4);
    expect(six.angle).toBeGreaterThan(five.angle);
    expect(six.opacity).toBeLessThan(five.opacity);
    expect(six.opacity).toBeLessThan(1);
  });

  it('carries on from a frame caught mid-move', () => {
    const mid = at(1, 6, 200).seats;
    const back = arcFrame(mid, 2, 0).seats;
    expect(back).toEqual(mid);
    expect(arcFrame(mid, 2, 5000).seats).toEqual(arcAtRest(2));
  });
});
