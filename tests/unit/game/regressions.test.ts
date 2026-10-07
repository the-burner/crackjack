// Bugs this app introduced for itself, each found by an application-wide bug bash.

import { describe, it, expect } from 'vitest';
import { BlackjackGame, ACTION, STATE } from '../../../src/game/engine/game.ts';
import type { TableConfig } from '../../../src/game/engine/game.ts';
import type { GameEventOf } from '../../../src/game/engine/events.ts';
import { rulesFrom } from '../../../src/game/engine/rules.ts';
import type { Rules } from '../../../src/game/engine/rules.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import type { SettingsPatch } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';
import type { CardId } from '../../../src/core/cards.ts';
import { seededRandom } from '../../../src/core/random.ts';

const card = (rank: number, suit = 0) => cardId(rank, suit);

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function riggedGame(
  cards: CardId[],
  { rules = makeRules(), table = {} }: { rules?: Rules; table?: Partial<TableConfig> } = {},
) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll: 1000,
    random: seededRandom(1),
  });
  game.takeEvents();
  const queue = [...cards];
  const realDraw = game.shoe.draw.bind(game.shoe);
  game.shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift() as CardId;
    game.shoe.remainingByCard[next] -= 1;
    game.shoe.remaining -= 1;
    game.shoe.dealt += 1;
    return next;
  };
  return game;
}

const deal = (p1: CardId, up: CardId, p2: CardId, hole: CardId, rest: CardId[] = []) => [p1, up, p2, hole, ...rest];

describe('a 21 where a player 22 counts as 21', () => {
  const rules = () => makeRules({ 'rules.player22CountsAs21': true });

  it('is stood automatically, like any other 21', () => {
    // 2 + 9 then a ten: a hard 21 on three cards.
    const game = riggedGame(deal(card(2), card(9), card(9), card(5), [card(10)]), { rules: rules() });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].total).toBe(21);
    expect(game.state).not.toBe(STATE.playerAction);
  });

  it('still lets a soft 21 of exactly four cards draw on', () => {
    const game = riggedGame(deal(card(1), card(9), card(2), card(5), [card(5), card(3)]), { rules: rules() });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    const [hand] = game.hands;
    expect(hand.cards.length).toBe(4);
    expect(hand.total).toBe(21);
    expect(game.state).toBe(STATE.playerAction);
  });

  it('does not bust a hard 22, which still counts as 21', () => {
    const game = riggedGame(deal(card(10), card(9), card(5), card(5), [card(7)]), { rules: rules() });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].busted()).toBe(false);
    expect(game.hands[0].total).toBe(21);
  });
});

describe('settling two side-bet spots', () => {
  it('settles each stake with the rule of the spot it was placed on', async () => {
    const { decodeSideBetGame } = await import('../../../src/settings/side-bet-games.ts');
    const { SIDE_BET_GAME_DEFINITIONS } = await import('../../../src/data/side-bet-games.ts');
    const { sideBetSpots } = await import('../../../src/game/engine/side-bets.ts');
    const sideBetGame = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[11]);
    const spots = sideBetSpots(sideBetGame);
    expect(spots.map(s => s.id)).toEqual(['U', 'O']);

    /** Plays one round with a stake on just one spot. */
    const play = (spotId: string) => {
      const game = new BlackjackGame({
        rules: makeRules(),
        table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
        bankroll: 1000,
        random: seededRandom(4),
        sideBetGame,
      });
      game.takeEvents();
      // A player total under 13 wins the Under spot and loses the Over spot.
      const queue = [card(2), card(9), card(3), card(5)];
      const realDraw = game.shoe.draw.bind(game.shoe);
      game.shoe.draw = () => {
        if (queue.length === 0) return realDraw();
        const next = queue.shift() as CardId;
        game.shoe.remainingByCard[next] -= 1;
        game.shoe.remaining -= 1;
        game.shoe.dealt += 1;
        return next;
      };
      const events = [...game.startRound([{ seat: 1, bet: 10, sideBets: { [spotId]: 5 } }])];
      while (game.state === STATE.insurance) events.push(...game.declineInsurance());
      while (game.state === STATE.playerAction) events.push(...game.act(ACTION.stand));
      const settled = events.find(e => e.type === 'settled');
      return settled?.sideBets ?? [];
    };

    const under = play('U');
    const over = play('O');
    expect(under[0]?.label).toBe('U');
    expect(over[0]?.label).toBe('O');
    // The two spots are opposites, so one paying means the other must not.
    expect(under[0]?.payout === over[0]?.payout).toBe(false);
  });
});

describe('a bet the bankroll cannot cover', () => {
  it('is refused when the side bet is what breaks it', async () => {
    const { checkAffordable } = await import('../../../src/game/engine/game.ts');
    expect(checkAffordable({ bankroll: 100, betPerHand: 100, hands: 1, sideBets: { LL: 100 } })).toBe(false);
    expect(checkAffordable({ bankroll: 200, betPerHand: 100, hands: 1, sideBets: { LL: 100 } })).toBe(true);
    expect(checkAffordable({ bankroll: 100, betPerHand: 100, hands: 1, sideBets: {} })).toBe(true);
  });
});

describe('insurance with no money left', () => {
  it('is not offered', () => {
    const rules = makeRules({ 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true });
    const game = riggedGame(deal(card(10), card(1), card(7), card(5)), { rules });
    game.bankroll = 1000;
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.insurance);
    // Everything is staked: half a bet more cannot be found.
    game.bankroll = 0;
    expect(game.canInsure()).toBe(false);
    game.takeInsurance();
    expect(game.bankroll).toBe(0);
    expect(game.hands[0].insuranceBet).toBe(0);
  });

  it('is offered when there is enough', () => {
    const rules = makeRules({ 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true });
    const game = riggedGame(deal(card(10), card(1), card(7), card(5)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.canInsure()).toBe(true);
  });
});

describe('doubling with a thin bankroll', () => {
  const doubling = (extra: SettingsPatch) =>
    makeRules({ 'rules.hardDoubles': 'any', 'rules.doubleAnyNumberOfCards': true, ...extra });

  it('refuses a triple down the bankroll cannot cover', () => {
    const game = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2)]), {
      rules: doubling({ 'rules.tripleDown': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.bankroll = 10;
    expect(game.availableActions().double).toBe(false);
  });

  it('refuses a redouble the bankroll cannot cover', () => {
    const game = riggedGame(deal(card(5), card(9), card(4), card(5), [card(2), card(2)]), {
      rules: doubling({ 'rules.redouble': true }),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    game.bankroll = 15;
    // A redouble stakes the bet plus the double already made: $20.
    expect(game.availableActions().double).toBe(false);
    game.bankroll = 20;
    expect(game.availableActions().double).toBe(true);
  });
});

describe('early surrender against a ten', () => {
  // Choosing this rule turns the ten peek off, as the original did, so the hand
  // can be given up before the dealer's hole card is known.
  const rules = makeRules({
    'rules.surrender': 'earlyVsTen',
    'rules.dealerPeeksTen': false,
    'rules.insurance': 'normal',
  });

  it('offers surrender under a ten without the dealer checking first', () => {
    const game = riggedGame(deal(card(10), card(13), card(6), card(1)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    // The dealer is holding a blackjack but has not looked.
    expect(game.dealer.cards.map(c => c % 13)).toEqual([0, 1]);
    expect(game.state).toBe(STATE.playerAction);
    expect(game.availableActions().surrender).toBe(true);
  });

  it('keeps half the bet when the hand is given up', () => {
    const game = riggedGame(deal(card(10), card(13), card(6), card(1)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.surrender);
    expect(game.hands[0]).toMatchObject({ result: 'Surrender', payout: 5 });
  });
});

describe('the count across a split', () => {
  it('counts the card each split hand draws', () => {
    const seen: CardId[] = [];
    const game = new BlackjackGame({
      rules: makeRules({ 'rules.maxSplitHands': 4 }),
      table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
      bankroll: 1000,
      random: seededRandom(1),
      onCardSeen: c => seen.push(c),
    });
    game.takeEvents();
    const queue = deal(card(8), card(9), card(8, 1), card(5), [card(13), card(12)]);
    const realDraw = game.shoe.draw.bind(game.shoe);
    game.shoe.draw = () => {
      if (queue.length === 0) return realDraw();
      const next = queue.shift() as CardId;
      game.shoe.remainingByCard[next] -= 1;
      game.shoe.remaining -= 1;
      game.shoe.dealt += 1;
      return next;
    };
    game.startRound([{ seat: 1, bet: 10 }]);
    seen.length = 0;
    game.act(ACTION.split);
    // The king drawn to the first hand must be counted, whatever position it lands in.
    expect(seen).toContain(card(13));
    game.act(ACTION.stand);
    expect(seen).toContain(card(12));
  });

  it('does not count the moved card a second time', () => {
    const seen: CardId[] = [];
    const game = new BlackjackGame({
      rules: makeRules({ 'rules.maxSplitHands': 4 }),
      table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
      bankroll: 1000,
      random: seededRandom(1),
      onCardSeen: c => seen.push(c),
    });
    game.takeEvents();
    const queue = deal(card(8), card(9), card(8, 1), card(5), [card(13), card(12)]);
    const realDraw = game.shoe.draw.bind(game.shoe);
    game.shoe.draw = () => {
      if (queue.length === 0) return realDraw();
      const next = queue.shift() as CardId;
      game.shoe.remainingByCard[next] -= 1;
      game.shoe.remaining -= 1;
      game.shoe.dealt += 1;
      return next;
    };
    game.startRound([{ seat: 1, bet: 10 }]);
    const before = seen.filter(c => c === card(8, 1)).length;
    game.act(ACTION.split);
    game.act(ACTION.stand);
    game.act(ACTION.stand);
    expect(seen.filter(c => c === card(8, 1)).length).toBe(before);
  });
});

describe('a double card dealt face down in a face-up game', () => {
  const rules = () => makeRules({ 'rules.hardDoubles': 'any' });
  const table = { doubleDownCardFaceUp: false };

  it('stays down until the showdown, then is turned up and counted', () => {
    const seen: CardId[] = [];
    const game = riggedGame(deal(card(5), card(9), card(6), card(7), [card(13)]), { rules: rules(), table });
    game.onCardSeen = c => seen.push(c);
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.act(ACTION.double);
    const [hand] = game.hands;
    expect(hand.faceUp).toEqual([true, true, true]);
    expect(seen).toContain(card(13));
    // It went down first, and came up only once the dealer had played.
    const reveal = events.findIndex(e => e.type === 'reveal' && e.hand === '1-0' && e.cardIndex === 2);
    const dealerTurn = events.findIndex(e => e.type === 'dealerTurn');
    expect(reveal).toBeGreaterThan(dealerTurn);
  });
});

describe('a computer hand that busts in a face-down game', () => {
  it('is turned face up before it is swept, so its counted cards were seen', () => {
    // Seat 1 is the player, seat 2 a computer that hits 12 and busts.
    const game = riggedGame([card(10), card(10, 1), card(9), card(10, 2), card(2, 1), card(7), card(10, 3)], {
      table: { cardsFaceDown: true, seatCount: 2, computerSeats: [2], computerBet: 5 },
    });
    game.computerPlay = hand => (hand.total < 17 ? ACTION.hit : ACTION.stand);
    const events = [...game.startRound([{ seat: 1, bet: 10 }])];
    events.push(...game.act(ACTION.stand));
    const computer = game.hands.find(h => h.key === '2-0');
    expect(computer!.busted()).toBe(true);
    const bust = events.findIndex(e => e.type === 'message' && e.hand === '2-0' && e.text === 'Bust');
    const revealedBefore = new Set(
      events
        .slice(0, bust)
        .filter((e): e is GameEventOf<'reveal'> => e.type === 'reveal' && e.hand === '2-0')
        .map(e => e.cardIndex),
    );
    expect([...revealedBefore].sort()).toEqual([0, 1]);
  });
});

describe('a computer blackjack in a face-down game', () => {
  it('is turned face up before it is announced and swept', () => {
    // Seat 2, a computer, is dealt a queen and an ace.
    const game = riggedGame([card(10), card(12, 2), card(9), card(7), card(1, 3), card(10, 3)], {
      table: { cardsFaceDown: true, seatCount: 2, computerSeats: [2], computerBet: 5 },
    });
    const events = [...game.startRound([{ seat: 1, bet: 10 }])];
    events.push(...game.act(ACTION.stand));
    const announced = events.findIndex(e => e.type === 'message' && e.hand === '2-0' && e.text === 'Blackjack');
    expect(announced).toBeGreaterThan(-1);
    const shown = new Set(
      events
        .slice(0, announced)
        .filter((e): e is GameEventOf<'reveal'> => e.type === 'reveal' && e.hand === '2-0')
        .map(e => e.cardIndex),
    );
    expect([...shown].sort()).toEqual([0, 1]);
  });
});

describe('a dealer blackjack found by the peek', () => {
  it('is announced once, after the hole card is turned up', () => {
    const rules = makeRules({ 'rules.dealerPeeksTen': true });
    const game = riggedGame(deal(card(10), card(13), card(7), card(1)), { rules });
    const events = game.startRound([{ seat: 1, bet: 10 }]);
    const announced = events.filter(e => e.type === 'message' && e.text === 'Dealer has Blackjack');
    expect(announced).toHaveLength(1);
    const reveal = events.findIndex(e => e.type === 'reveal' && e.hand === '0-0' && e.cardIndex === 1);
    expect(events.indexOf(announced[0])).toBeGreaterThan(reveal);
  });

  it('says nothing when the peek finds no blackjack', () => {
    const rules = makeRules({ 'rules.dealerPeeksTen': true });
    const game = riggedGame(deal(card(10), card(13), card(7), card(5)), { rules });
    const events = game.startRound([{ seat: 1, bet: 10 }]);
    expect(events.filter(e => e.type === 'message' && /Blackjack/.test(e.text))).toEqual([]);
  });
});

describe('a hand the dealer wrongly busted', () => {
  it('is out of the round, so the dealer does not draw against it', () => {
    const game = riggedGame(deal(card(10), card(6), card(5), card(10), [card(5), card(9)]));
    game.onGoodHandBusted = () => true;
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    // Dealer holds 16 and would draw if a live hand were left.
    expect(game.dealer.cards).toHaveLength(2);
  });
});

describe('doubling split aces', () => {
  const pairOfAces = () =>
    riggedGame(deal(card(1), card(9), card(1, 1), card(5), [card(1, 2), card(9, 1)]), {
      rules: makeRules({
        'rules.doubleAfterSplit': true,
        'rules.hitSplitAces': false,
        'rules.resplitAces': true,
        'rules.maxSplitHands': 4,
        'rules.doubleAfterSplitAces': false,
        'rules.hardDoubles': 'any',
        'rules.softDoubles': 'any',
      }),
    });

  it('is not offered on a split ace without its own rule, even where splits may double', () => {
    const game = pairOfAces();
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.availableActions()).toMatchObject({ double: false, split: true, stand: true });
  });

  it('is offered once split aces may be hit', () => {
    const rules = makeRules({
      'rules.doubleAfterSplit': true,
      'rules.hitSplitAces': true,
      'rules.hardDoubles': 'any',
      'rules.softDoubles': 'any',
      'rules.maxSplitHands': 4,
    });
    const game = riggedGame(deal(card(1), card(9), card(1, 1), card(5), [card(5), card(9, 1)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.availableActions().double).toBe(true);
  });
});
