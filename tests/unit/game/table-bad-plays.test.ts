import { describe, it, expect } from 'vitest';
import { obviouslyBad, areYouSure } from '@/game/table/bad-plays';
import { ACTION } from '@/game/engine/game';

const totals = (total: number, hardTotal = total) => ({ total, hardTotal });

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
    expect(areYouSure(ACTION.stand)).toBe('Are you sure that you want to Stand?');
    expect(areYouSure(ACTION.split)).toBe('Are you sure that you want to Split?');
    // The original named this one in full.
    expect(areYouSure(ACTION.double)).toBe('Are you sure that you want to Double Down?');
  });

  it('falls back to the action itself for a play the original never named', () => {
    // Surrender is never questioned, so the original had no wording for it.
    expect(areYouSure(ACTION.surrender)).toBe('Are you sure that you want to surrender?');
  });
});
