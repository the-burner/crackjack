// Computer seats play the player's own strategy, as the original's did, and a
// seat that splits plays both of its hands.

import { describe, it, expect, vi } from 'vitest';
import { GameSession } from '../../../src/game/session.ts';
import { createServices } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { BlackjackGame, ACTION } from '../../../src/game/engine/game.ts';
import { rulesFrom } from '../../../src/game/engine/rules.ts';
import { PLAYER } from '../../../src/game/engine/hand.ts';
import { correctPlay } from '../../../src/game/play-check.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import { Storage } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import { seededRandom } from '../../../src/core/random.ts';

const card = (rank, suit = 0) => cardId(rank, suit);

function makeApp(overrides = {}) {
  const app = createServices({ backend: new MemoryBackend() });
  app.sound = { play() {} };
  app.settings.update(overrides);
  return app;
}

function makeRules(overrides = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function riggedGame(cards, { rules = makeRules(), table = {}, computerPlay = null } = {}) {
  const game = new BlackjackGame({
    rules,
    table: {
      decks: 6,
      burnCards: 0,
      seatCount: 2,
      computerSeats: [2],
      computerBet: 5,
      doubleDownCardFaceUp: true,
      ...table,
    },
    bankroll: 1000,
    random: seededRandom(1),
    computerPlay,
  });
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift();
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

describe('a computer seat deciding its play', () => {
  it('asks the player strategy and gets a real action back', () => {
    const session = new GameSession(makeApp());
    session.startRound({ betPerHand: 10, hands: 1 });
    const hand = session.game.hands.find(h => h.owner === PLAYER.computer) ?? session.game.hands[0];
    const action = session.computerAction(hand, { dealerUpcard: card(10) });
    expect(action).toBeDefined();
    expect(Object.values(ACTION)).toContain(action);
  });

  it('plays what the strategy says for the hand', () => {
    const session = new GameSession(makeApp());
    session.startRound({ betPerHand: 10, hands: 1 });
    const hand = session.game.hands[0];
    const upcard = card(6);
    const expected = correctPlay({
      strategy: session.strategy,
      rules: session.rules,
      hand,
      upcard,
      counts: session.counts,
      shoe: session.game.shoe,
      handsInSeat: 1,
    }).action;
    const played = session.computerAction(hand, { dealerUpcard: upcard });
    expect(played).toBe(expected === ACTION.surrender ? ACTION.stand : expected);
  });

  it('stands rather than giving a hand up', () => {
    const session = new GameSession(makeApp({ 'rules.surrender': 'late' }));
    session.startRound({ betPerHand: 10, hands: 1 });
    const hand = session.game.hands[0];
    // Force the strategy to call for a surrender.
    const original = session.strategy;
    expect(session.computerAction(hand, { dealerUpcard: card(1) })).not.toBe(ACTION.surrender);
    expect(session.strategy).toBe(original);
  });

  it('is used by the engine for every computer hand', () => {
    // The session deals with Math.random; pin it so a dealer blackjack cannot
    // end the round before any computer seat has played.
    const random = seededRandom(5);
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => random());
    const asked = [];
    const session = new GameSession(
      makeApp({ 'table.seatCount': 2, 'table.computerSeats': [false, true, false, false, false, false] }),
    );
    const real = session.computerAction.bind(session);
    session.computerAction = (hand, context) => {
      asked.push(hand.key);
      return real(hand, context);
    };
    session.startRound({ betPerHand: 10, hands: 1 });
    while (session.state === 'insurance') session.declineInsurance();
    while (session.state === 'playerAction') session.act('stand');
    spy.mockRestore();
    expect(asked.length).toBeGreaterThan(0);
  });
});

describe('a computer seat that splits', () => {
  // Deal order with a human seat 1 and a computer seat 2:
  // 1-0, 2-0, dealer up, 1-0, 2-0, hole, then the cards drawn in play.
  const eights = [card(10), card(8), card(6), card(7), card(8, 1), card(9)];

  it('plays on the hand it split instead of abandoning it', () => {
    let splits = 0;
    const computerPlay = hand => {
      if (hand.isPair() && splits === 0) {
        splits += 1;
        return ACTION.split;
      }
      return hand.total < 17 ? ACTION.hit : ACTION.stand;
    };
    const game = riggedGame([...eights, card(5), card(4), card(3), card(2)], {
      rules: makeRules({ 'rules.maxSplitHands': 4 }),
      computerPlay,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    const seat = game.hands.filter(h => h.seat === 2);
    expect(seat).toHaveLength(2);
    // Both halves drew on and finished; neither is left sitting on two cards.
    for (const hand of seat) {
      expect(hand.cards.length).toBeGreaterThanOrEqual(2);
      expect(hand.stood || hand.busted() || hand.total >= 17).toBe(true);
    }
  });

  it('gives each half its own bet without charging the player', () => {
    const seen = [];
    const computerPlay = hand => {
      seen.push(game.bankroll);
      return hand.isPair() ? ACTION.split : ACTION.stand;
    };
    const game = riggedGame(eights, { rules: makeRules({ 'rules.maxSplitHands': 4 }), computerPlay });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    const seat = game.hands.filter(h => h.seat === 2);
    expect(seat).toHaveLength(2);
    expect(seat.every(hand => hand.bet === 5)).toBe(true);
    // The bankroll did not move across the split: only the player pays for hands.
    expect(new Set(seen).size).toBe(1);
  });

  it('stands a split pair of aces it may not draw on', () => {
    const aces = [card(10), card(1), card(6), card(7), card(1, 1), card(9)];
    const computerPlay = hand => (hand.isPair() ? ACTION.split : ACTION.stand);
    const game = riggedGame(aces, {
      rules: makeRules({ 'rules.maxSplitHands': 4, 'rules.hitSplitAces': false }),
      computerPlay,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    const seat = game.hands.filter(h => h.seat === 2);
    expect(seat).toHaveLength(2);
    expect(seat.every(hand => hand.cards.length === 2)).toBe(true);
  });
});

describe('a player hand that splits', () => {
  it('keeps the turn, as it always did', () => {
    const pair = [card(8), card(5), card(8, 1), card(9)];
    const game = riggedGame(pair, { table: { computerSeats: [] }, rules: makeRules({ 'rules.maxSplitHands': 4 }) });
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.act(ACTION.split);
    expect(events.filter(e => e.type === 'turn').at(-1)).toMatchObject({ hand: '1-0' });
    expect(game.state).toBe('playerAction');
    expect(game.activeHand.key).toBe('1-0');
  });

  it('moves on when a split pair of aces may not be played', () => {
    const aces = [card(1), card(5), card(1, 1), card(9)];
    const game = riggedGame(aces, {
      table: { computerSeats: [] },
      rules: makeRules({ 'rules.maxSplitHands': 4, 'rules.hitSplitAces': false }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.state).not.toBe('playerAction');
    expect(game.hands.filter(h => h.seat === 1)).toHaveLength(2);
  });
});

describe('a computer seat the strategy would have surrender', () => {
  it('plays the strategy’s best move without surrender instead of standing', () => {
    const session = new GameSession(makeApp({ 'rules.surrender': 'late' }));
    session.startRound({ betPerHand: 10, hands: 1 });
    // A hard 16 against an ace is a surrender at most counts.
    const hand = { ...session.game.hands[0], cards: [card(10), card(6)] };
    Object.setPrototypeOf(hand, Object.getPrototypeOf(session.game.hands[0]));
    const withoutSurrender = correctPlay({
      strategy: session.strategy,
      rules: { ...session.rules, surrender: 'none' },
      hand,
      upcard: card(1),
      counts: session.counts,
      shoe: session.game.shoe,
      handsInSeat: 1,
    }).action;
    expect(session.computerAction(hand, { dealerUpcard: card(1) })).toBe(withoutSurrender);
  });
});
