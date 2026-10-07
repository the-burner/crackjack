import { describe, it, expect } from 'vitest';
import { betError, sideBetOverTheMultiple } from '@/game/bet-validation';

const check = (over = {}) =>
  betError({ amount: 25, hands: 1, limits: [5, 1000], bankroll: 500, sideBets: {}, spots: [], ...over });

describe('placing a bet', () => {
  it('accepts a bet inside the limits that the bankroll covers', () => {
    expect(check()).toBe(null);
    expect(check({ amount: 5 })).toBe(null);
    expect(check({ amount: 500, bankroll: 500 })).toBe(null);
  });

  it('refuses a bet below the table minimum', () => {
    expect(check({ amount: 1 })).toBe('Bet below the table minimum of $5.');
  });

  it('refuses a bet above the table maximum, with thousands separators', () => {
    expect(check({ amount: 2500, limits: [25, 2000], bankroll: 10000 })).toBe('Bet above the table maximum of $2,000.');
  });

  it('checks the limits before the bankroll', () => {
    expect(check({ amount: 1, bankroll: 0 })).toBe('Bet below the table minimum of $5.');
  });

  it('refuses a round the bankroll cannot cover, side bets and every hand included', () => {
    const broke = 'Not enough in the bankroll for that bet.';
    expect(check({ amount: 300, hands: 2 })).toBe(broke);
    expect(check({ amount: 250, hands: 2 })).toBe(null);
    expect(check({ amount: 250, hands: 2, sideBets: { Lucky: 1 } })).toBe(broke);
  });

  it('refuses a side bet over its multiple of the main bet', () => {
    const spots = [{ id: 'Lucky', maxMultipleOfBet: 2 }];
    expect(check({ amount: 10, sideBets: { Lucky: 25 }, spots })).toBe(
      'Side bet cannot be greater than 2 times the main bet.',
    );
    expect(check({ amount: 10, sideBets: { Lucky: 20 }, spots })).toBe(null);
  });

  it('checks the bankroll before the side-bet multiple', () => {
    const spots = [{ id: 'Lucky', maxMultipleOfBet: 2 }];
    expect(check({ amount: 10, sideBets: { Lucky: 600 }, spots })).toBe('Not enough in the bankroll for that bet.');
  });
});

describe('the side-bet multiple', () => {
  const spots = [
    { id: 'A', maxMultipleOfBet: 5 },
    { id: 'B', maxMultipleOfBet: 2 },
  ];

  it('names the multiple of the first spot that breaks it', () => {
    expect(sideBetOverTheMultiple(10, { A: 60, B: 30 }, spots)).toBe(5);
    expect(sideBetOverTheMultiple(10, { B: 30 }, spots)).toBe(2);
  });

  it('is 0 when nothing breaks it or nothing is staked', () => {
    expect(sideBetOverTheMultiple(10, { A: 50, B: 20 }, spots)).toBe(0);
    expect(sideBetOverTheMultiple(10, {}, spots)).toBe(0);
  });
});
