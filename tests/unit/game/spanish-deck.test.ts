// Spanish 21 is dealt from Spanish decks: 48 cards each, the four tens taken out.
import { describe, it, expect } from 'vitest';
import { Shoe } from '@/game/engine/shoe';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { seededRandom } from '@/core/random';
import { rankOf } from '@/core/cards';

describe('a Spanish shoe', () => {
  it('holds 48 cards a deck and never deals a ten, though it deals the jacks, queens and kings', () => {
    const shoe = new Shoe({ decks: 6, spanish: true, cardsBehindCutCard: 1, random: seededRandom(3) });
    expect(shoe.totalCards).toBe(288);
    const ranks = new Set<number>();
    for (let card = shoe.draw(); card !== null; card = shoe.draw()) ranks.add(rankOf(card));
    expect(shoe.dealt).toBe(288);
    expect(ranks.has(10)).toBe(false);
    expect([11, 12, 13].every(rank => ranks.has(rank))).toBe(true);
  });
});

describe('a Spanish 21 table', () => {
  const sessionWith = (game: number) => {
    const app = createServices({ backend: new MemoryBackend() });
    app.settings.update({ 'bonuses.game': game, 'table.decks': 6 });
    return new GameSession(app);
  };

  it('deals Spanish decks, and its true count divides by Spanish decks', () => {
    const session = sessionWith(17);
    expect(session.game.shoe.cardsPerDeck).toBe(48);
    expect(session.counter.decksRemaining(48)).toBe(5);
    expect(sessionWith(0).game.shoe.cardsPerDeck).toBe(52);
  });
});
