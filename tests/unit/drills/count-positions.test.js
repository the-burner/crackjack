import { describe, it, expect } from 'vitest';
import { flashPositions } from '../../../src/drills/count/logic.ts';

describe('a flash of a single card', () => {
  it('centres the card with Positions: Horizontal, as it does diagonally', () => {
    const single = { width: 300, height: 400, maxCards: 1, rotated: false, cards: 1 };
    const { cards, cardWidth } = flashPositions({ ...single, layout: 'horizontal' });
    expect(cards).toEqual([{ x: (300 - cardWidth) / 2, y: 0 }]);
  });
});
