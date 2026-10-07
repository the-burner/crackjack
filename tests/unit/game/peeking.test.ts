// Peeking at the dealer's hole card and at a neighbour's cards, and the table
// filling and emptying between rounds.

import { describe, it, expect, vi } from 'vitest';
import { BlackjackGame } from '@/game/engine/game';
import { rulesFrom } from '@/game/engine/rules';
import { PLAYER } from '@/game/engine/hand';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { Random } from '@/core/random';
import type { Rules } from '@/game/engine/rules';
import type { GameOptions, PeekingOptions, TableConfig } from '@/game/engine/game';
import type { SettingValues } from '@/settings/schema';

function makeRules(overrides: Partial<SettingValues> = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

/**
 * A game whose random source is a constant, so every decision it drives is known.
 * The shoe draws from the same source, which is why a fixed list cannot be used.
 */
function makeGame({
  table = {},
  rules = makeRules(),
  random = 0.5,
  onCardSeen = null,
}: {
  table?: Partial<TableConfig>;
  rules?: Rules;
  random?: number | Random;
  onCardSeen?: GameOptions['onCardSeen'];
} = {}) {
  return new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 4, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: typeof random === 'function' ? random : () => random,
    onCardSeen,
  });
}

const peekingTable = (over: Partial<PeekingOptions> = {}): Partial<TableConfig> => ({
  peeking: {
    mode: 'holeCard',
    percent: 100,
    adjacentHands: false,
    randomizeCard: false,
    randomizeHand: false,
    ...over,
  },
});

describe('peeking at the hole card', () => {
  it('flashes the card and puts it back down', () => {
    const game = makeGame({ table: peekingTable() });
    const events = game.startRound([{ seat: 1, bet: 10 }]);
    const peek = events.find(e => e.type === 'peek');
    const conceal = events.find(e => e.type === 'conceal');
    expect(peek).toMatchObject({ hand: '0-0', cardIndex: 1, card: game.dealer.cards[1] });
    expect(conceal).toMatchObject({ hand: '0-0', cardIndex: 1 });
    expect(game.dealer.faceUp[1]).toBe(false);
  });

  it('counts the card it showed, and does not count it again when it is turned over', () => {
    const seen = vi.fn();
    const game = makeGame({ table: peekingTable(), onCardSeen: seen });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.dealer.counted[1]).toBe(true);
    const countedSoFar = seen.mock.calls.length;
    game.reveal(game.dealer, 1);
    expect(seen.mock.calls.length).toBe(countedSoFar);
  });

  it('does nothing when peeking is off', () => {
    const game = makeGame();
    expect(game.startRound([{ seat: 1, bet: 10 }]).some(e => e.type === 'peek')).toBe(false);
  });

  it('happens as often as the percentage says', () => {
    // The card shows when the draw lands above 100 - percent.
    const shows = (random: number) =>
      makeGame({ table: peekingTable({ percent: 30 }), random })
        .startRound([{ seat: 1, bet: 10 }])
        .some(e => e.type === 'peek');
    expect(shows(0.8)).toBe(true);
    expect(shows(0.5)).toBe(false);
  });

  it('only flashes where the dealer checks, in "peek when dealer peeks" mode', () => {
    const table = peekingTable({ mode: 'whenDealerPeeks' });
    const rules = makeRules({ 'rules.dealerPeeksAce': true, 'rules.dealerPeeksTen': false });
    // An ace upcard is checked, a ten is not, so only the ace flashes.
    expect(withUpcard(makeGame({ table, rules }), cardId(1, 0)).some(e => e.type === 'peek')).toBe(true);
    expect(withUpcard(makeGame({ table, rules }), cardId(10, 0)).some(e => e.type === 'peek')).toBe(false);
  });

  it('never flashes a card that is not there', () => {
    const game = makeGame({ table: peekingTable(), rules: makeRules({ 'rules.noHoleCard': true }) });
    expect(game.startRound([{ seat: 1, bet: 10 }]).some(e => e.type === 'peek')).toBe(false);
  });
});

/** Deals a round whose dealer upcard is a known card. */
function withUpcard(game: BlackjackGame, upcard: CardId) {
  const draw = game.shoe.draw.bind(game.shoe);
  let dealt = 0;
  game.shoe.draw = () => {
    dealt += 1;
    // The upcard is the second card off the shoe with one player seat.
    if (dealt === 2) return upcard;
    return draw();
  };
  return game.startRound([{ seat: 1, bet: 10 }]);
}

describe('peeking at a neighbour', () => {
  const faceDown = (over: Partial<PeekingOptions> = {}): Partial<TableConfig> => ({
    cardsFaceDown: true,
    computerSeats: [2],
    computerBet: 5,
    ...peekingTable({ mode: 'off', adjacentHands: true, ...over }),
  });

  it('deals the seat beside the player face up in a face-down game', () => {
    const game = makeGame({ table: faceDown() });
    game.startRound([{ seat: 1, bet: 10 }]);
    const [player, neighbour] = game.hands;
    expect(player.faceUp).toEqual([false, false]);
    expect(neighbour.faceUp).toEqual([true, true]);
  });

  it('leaves everyone face down when the option is off', () => {
    const game = makeGame({ table: faceDown({ adjacentHands: false }) });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands[1].faceUp).toEqual([false, false]);
  });

  it('leaves a seat that is not next to the player face down', () => {
    const game = makeGame({ table: { ...faceDown(), computerSeats: [4], seatCount: 4 } });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands[1].faceUp).toEqual([false, false]);
  });

  it('decides each card on its own with "randomize card"', () => {
    const game = makeGame({ table: faceDown({ randomizeCard: true }) });
    game.startRound([{ seat: 1, bet: 10 }]);
    const neighbour = game.hands[1];
    // The decision is taken per card as it is dealt, so it is asked of each one.
    game.random = () => 0.9;
    expect(game.dealtFaceUp(neighbour)).toBe(true);
    game.random = () => 0.1;
    expect(game.dealtFaceUp(neighbour)).toBe(false);
  });

  it('shows the whole hand or none of it with "randomize hand"', () => {
    const shown = makeGame({ table: faceDown({ randomizeHand: true }), random: 0.1 });
    shown.startRound([{ seat: 1, bet: 10 }]);
    expect(shown.hands[1].faceUp).toEqual([true, true]);

    const hidden = makeGame({ table: faceDown({ randomizeHand: true }), random: 0.9 });
    hidden.startRound([{ seat: 1, bet: 10 }]);
    expect(hidden.hands[1].faceUp).toEqual([false, false]);
  });

  it('counts the cards it shows', () => {
    const seen: CardId[] = [];
    const game = makeGame({ table: faceDown(), onCardSeen: card => seen.push(card) });
    game.startRound([{ seat: 1, bet: 10 }]);
    const neighbour = game.hands[1];
    expect(seen).toEqual(expect.arrayContaining(neighbour.cards));
  });
});

describe('players coming and going', () => {
  const table = { computerSeats: [2, 3, 4], computerBet: 5, playersComeAndGo: true, seatCount: 4 };

  it('keeps the same seats until the table turns over', () => {
    const game = makeGame({ table, random: 0.9 });
    game.startRound([{ seat: 1, bet: 10 }]);
    const first = game.hands.filter(h => h.owner === PLAYER.computer).map(h => h.seat);
    game.nextRound();
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.filter(h => h.owner === PLAYER.computer).map(h => h.seat)).toEqual(first);
  });

  it('refills with a random number of players at random seats', () => {
    // A draw of 0.5 picks two of the three seats.
    const game = makeGame({ table, random: 0.5 });
    game.startRound([{ seat: 1, bet: 10 }]);
    const seats = game.hands.filter(h => h.owner === PLAYER.computer).map(h => h.seat);
    expect(seats).toHaveLength(2);
    expect(seats.every(seat => table.computerSeats.includes(seat))).toBe(true);
  });

  it('can empty a one-player table', () => {
    const game = makeGame({ table: { ...table, computerSeats: [2] }, random: 0.1 });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.filter(h => h.owner === PLAYER.computer)).toHaveLength(0);
  });

  it('seats every configured player when the option is off', () => {
    const game = makeGame({ table: { ...table, playersComeAndGo: false } });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.filter(h => h.owner === PLAYER.computer).map(h => h.seat)).toEqual([2, 3, 4]);
  });
});
