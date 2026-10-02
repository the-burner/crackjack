import { describe, it, expect } from 'vitest';
import { obviouslyBad, areYouSure } from '../../../src/game/table/bad-plays.js';
import { ACTION } from '../../../src/game/engine/game.js';

const totals = (total, hardTotal = total) => ({ total, hardTotal });

describe('plays the dealer questions', () => {
  it('questions hitting a hard 17 or more', () => {
    expect(obviouslyBad(ACTION.hit, totals(17))).toBe(true);
    expect(obviouslyBad(ACTION.hit, totals(16))).toBe(false);
    // A soft 18 has a low total of 8, so hitting it is a normal play.
    expect(obviouslyBad(ACTION.hit, totals(18, 8))).toBe(false);
  });

  it('questions standing on less than 12', () => {
    expect(obviouslyBad(ACTION.stand, totals(11))).toBe(true);
    expect(obviouslyBad(ACTION.stand, totals(12))).toBe(false);
  });

  it('questions doubling a hard 12 or more', () => {
    expect(obviouslyBad(ACTION.double, totals(12))).toBe(true);
    expect(obviouslyBad(ACTION.double, totals(11))).toBe(false);
    expect(obviouslyBad(ACTION.double, totals(13, 3))).toBe(false);
  });

  it('never questions splitting or surrendering', () => {
    expect(obviouslyBad(ACTION.split, totals(20))).toBe(false);
    expect(obviouslyBad(ACTION.surrender, totals(20))).toBe(false);
  });

  it('asks the question the way the dealer would', () => {
    expect(areYouSure(ACTION.hit)).toBe('Are you sure that you want to Hit?');
    expect(areYouSure(ACTION.double)).toBe('Are you sure that you want to Double?');
  });
});
