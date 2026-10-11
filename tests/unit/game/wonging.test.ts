import { describe, it, expect } from 'vitest';
import { wongedIn, shoeStartsIn } from '@/game/wonging';

const rule = { wongIn: 1, wongOut: -2 };

describe('wonging', () => {
  it('stays in until the count falls to Wong Out', () => {
    expect(wongedIn(true, 0, rule)).toBe(true);
    expect(wongedIn(true, -1, rule)).toBe(true);
    expect(wongedIn(true, -2, rule)).toBe(false);
    expect(wongedIn(true, -5, rule)).toBe(false);
  });

  it('stays out until the count climbs to Wong In', () => {
    expect(wongedIn(false, -1, rule)).toBe(false);
    expect(wongedIn(false, 0, rule)).toBe(false);
    expect(wongedIn(false, 1, rule)).toBe(true);
    expect(wongedIn(false, 4, rule)).toBe(true);
  });

  it('begins a shoe playing, unless told to begin it wonged out with Wong In above 0', () => {
    expect(shoeStartsIn(rule, false)).toBe(true);
    expect(shoeStartsIn(rule, true)).toBe(false);
    expect(shoeStartsIn({ wongIn: 0, wongOut: -2 }, true)).toBe(true);
  });
});
