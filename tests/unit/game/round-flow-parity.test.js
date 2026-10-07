// When the shoe is shuffled, what the burn cards do, and where the cut card falls.

import { describe, it, expect, vi } from 'vitest';
import { BlackjackGame, ACTION } from '../../../src/game/engine/game.js';
import { Shoe, SHUFFLE_MODE } from '../../../src/game/engine/shoe.js';
import { rulesFrom } from '../../../src/game/engine/rules.js';
import { Settings } from '../../../src/settings/store.js';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.js';
import { Storage, MemoryBackend } from '../../../src/services/storage.js';
import { seededRandom } from '../../../src/core/random.js';

function makeRules(overrides = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function makeGame({ table = {}, onCardSeen = null } = {}) {
  return new BlackjackGame({
    rules: makeRules(),
    table: { decks: 6, burnCards: 1, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(3),
    onCardSeen,
  });
}

/** Plays a round out to its payoff. */
function playRound(game) {
  game.startRound([{ seat: 1, bet: 10 }]);
  for (let i = 0; i < 12 && game.state === 'playerAction'; i++) game.act(ACTION.stand);
  return game;
}

describe('when the shoe is shuffled', () => {
  it('burns the first shoe when the table opens, before any round', () => {
    const game = makeGame();
    expect(game.takeEvents().map(e => e.type)).toEqual(['shuffle', 'burn']);
    const events = game.startRound([{ seat: 1, bet: 10 }]);
    expect(events.filter(e => e.type === 'shuffle' || e.type === 'burn')).toEqual([]);
  });

  it('shuffles at the end of the round, not when the next bet is placed', () => {
    const game = makeGame({ table: { shuffleMode: SHUFFLE_MODE.rounds, roundsPerShoe: 1 } });
    playRound(game);
    const between = game.nextRound();
    expect(between.map(e => e.type)).toEqual(['clear', 'shuffle', 'burn']);
    const next = game.startRound([{ seat: 1, bet: 10 }]);
    expect(next.filter(e => e.type === 'shuffle' || e.type === 'burn')).toEqual([]);
  });

  it('leaves the shoe alone between rounds when it does not need shuffling', () => {
    const game = makeGame({ table: { shuffleMode: SHUFFLE_MODE.rounds, roundsPerShoe: 50 } });
    playRound(game);
    expect(game.nextRound().map(e => e.type)).toEqual(['clear']);
  });
});

describe('burn cards', () => {
  it('are dealt face up and counted where the table shows them', () => {
    const seen = vi.fn();
    const game = makeGame({ table: { shuffleMode: SHUFFLE_MODE.rounds, roundsPerShoe: 1, burnCards: 2, showBurnCards: true }, onCardSeen: seen });
    playRound(game);
    seen.mockClear();
    const burns = game.nextRound().filter(e => e.type === 'burn');
    expect(burns).toHaveLength(2);
    expect(burns.every(e => e.faceUp)).toBe(true);
    expect(seen.mock.calls.map(([card]) => card)).toEqual(burns.map(e => e.card));
  });

  it('are dealt face down and uncounted where the table hides them', () => {
    const seen = vi.fn();
    const game = makeGame({ table: { shuffleMode: SHUFFLE_MODE.rounds, roundsPerShoe: 1, burnCards: 2, showBurnCards: false }, onCardSeen: seen });
    playRound(game);
    seen.mockClear();
    const burns = game.nextRound().filter(e => e.type === 'burn');
    expect(burns).toHaveLength(2);
    expect(burns.every(e => e.faceUp)).toBe(false);
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('the cut card', () => {
  it('shows on the card after penetration is reached, as the original tested it', () => {
    const shoe = new Shoe({
      decks: 1, shuffleMode: SHUFFLE_MODE.cutCard, cardsBehindCutCard: 50, roundsPerShoe: 100, random: seededRandom(5),
    });
    expect(shoe.penetration).toBe(2);
    shoe.draw();
    shoe.draw();
    expect(shoe.needsShuffle).toBe(false);
    shoe.draw();
    expect(shoe.needsShuffle).toBe(true);
  });
});
