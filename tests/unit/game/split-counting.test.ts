import { describe, it, expect } from 'vitest';
import { BlackjackGame, ACTION } from '../../../src/game/engine/game.ts';
import { rulesFrom } from '../../../src/game/engine/rules.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import type { CardId } from '../../../src/core/cards.ts';
import { seededRandom } from '../../../src/core/random.ts';

const card = (rank: number) => cardId(rank, 0);

/** One seat; the shoe deals `cards` first. */
function riggedGame(cards: CardId[]) {
  const rules = rulesFrom(new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend())));
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
    bankroll: 1000,
    random: seededRandom(1),
  });
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    const next = queue.shift();
    if (next === undefined) return realDraw();
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

describe('splitting a hand only partly seen', () => {
  it("keeps each card's counted mark with that card", () => {
    // Player 8, 8 against a dealer 6.
    const game = riggedGame([card(8), card(6), card(8), card(10), card(2), card(3)]);
    game.startRound([{ seat: 1, bet: 10 }]);
    const hand = game.hands[0];
    // As for a face-down hand of which a peek showed only the first card.
    hand.counted = [true];
    game.act(ACTION.split);
    const [first, second] = game.hands;
    expect(first.counted[0]).toBe(true);
    // The moved card was never seen, so it is still to be counted.
    expect(second.counted[0]).toBe(false);
  });
});
