import { describe, it, expect } from 'vitest';
import { cardId, rankOf, suitOf, valueOf, rankName } from '@/core/cards';

describe('card ids', () => {
  it('names the rank of a card id', () => {
    expect([1, 2, 10, 11, 12, 13].map(rankName)).toEqual(['A', '2', 'T', 'J', 'Q', 'K']);
  });

  it('names the same rank in every suit', () => {
    expect([1, 14, 27, 40].map(rankName)).toEqual(['A', 'A', 'A', 'A']);
  });

  it('splits an id into its rank and suit, and values tens and faces as ten', () => {
    expect([rankOf(26), suitOf(26), valueOf(26)]).toEqual([13, 1, 10]);
    expect(cardId(13, 1)).toBe(26);
  });
});
