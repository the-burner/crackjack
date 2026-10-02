import { describe, it, expect } from 'vitest';
import { BlackjackGame, STATE, ACTION } from '../../../src/game/engine/game.js';
import { rulesFrom } from '../../../src/game/engine/rules.js';
import { Settings } from '../../../src/settings/store.js';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.js';
import { Storage, MemoryBackend } from '../../../src/services/storage.js';
import { cardId } from '../../../src/core/cards.js';
import { seededRandom } from '../../../src/core/random.js';

const SPADES = 0, HEARTS = 2, DIAMONDS = 3;
const card = (rank, suit = SPADES) => cardId(rank, suit);

function makeRules(overrides = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

/** A game whose shoe deals the given cards in order, then falls back to random. */
function riggedGame(cards, { rules = makeRules(), table = {}, bankroll = 1000 } = {}) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll,
    random: seededRandom(1),
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

// Deal order: player card 1, dealer upcard, player card 2, dealer hole card.
const deal = (p1, up, p2, hole, rest = []) => [p1, up, p2, hole, ...rest];

describe('round flow', () => {
  it('pays a blackjack 3:2 on the first round', () => {
    const game = riggedGame(deal(card(1), card(9), card(13), card(5)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.settled);
    expect(game.hands[0].result).toBe('21');
    expect(game.bankroll).toBe(1015);
  });

  it('pays a blackjack 3:2 against a ten upcard the dealer peeked at', () => {
    const game = riggedGame(deal(card(1), card(10), card(13), card(5)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.bankroll).toBe(1015);
  });

  it('pushes blackjack against a dealer blackjack', () => {
    const game = riggedGame(deal(card(1), card(10), card(13), card(1)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.dealerBlackjack).toBe(true);
    expect(game.hands[0].result).toBe('Push');
    expect(game.bankroll).toBe(1000);
  });

  it('plays out a hit to a bust', () => {
    const game = riggedGame(deal(card(10), card(9), card(6), card(5), [card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.playerAction);
    game.act(ACTION.hit);
    expect(game.hands[0].result).toBe('Bust');
    expect(game.bankroll).toBe(990);
  });

  it('doubles and wins when the dealer busts', () => {
    const game = riggedGame(deal(card(6), card(9), card(5), card(6), [card(9), card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.hands[0].doubleBet).toBe(10);
    expect(game.bankroll).toBe(1020);
  });

  it('splits a pair into two hands and plays each', () => {
    const game = riggedGame(deal(card(8), card(5), card(8), card(6), [card(3), card(2), card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.hands.length).toBe(2);
    expect(game.bankroll).toBe(980);
    game.act(ACTION.stand);
    game.act(ACTION.stand);
    expect(game.state).toBe(STATE.settled);
  });

  it('stops splitting at the table limit', () => {
    const rules = makeRules({ 'rules.maxSplitHands': 2 });
    const game = riggedGame(deal(card(8), card(5), card(8), card(6), [card(8), card(8)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.availableActions().split).toBe(false);
  });

  it('returns half the bet on a late surrender', () => {
    const rules = makeRules({ 'rules.surrender': 'late' });
    const game = riggedGame(deal(card(10), card(10), card(6), card(7)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.availableActions().surrender).toBe(true);
    game.act(ACTION.surrender);
    expect(game.bankroll).toBe(995);
  });

  it('pays insurance 2:1 when the dealer has blackjack', () => {
    const game = riggedGame(deal(card(10), card(1), card(10), card(10)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.insurance);
    game.takeInsurance();
    expect(game.dealerBlackjack).toBe(true);
    expect(game.bankroll).toBe(1000);
  });

  it('loses the insurance stake when the dealer has no blackjack', () => {
    const game = riggedGame(deal(card(10), card(1), card(9), card(5), [card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.takeInsurance();
    game.act(ACTION.stand);
    // Dealer A+5+10 = 16, draws... settled either way; the insurance stake is gone.
    expect(game.hands[0].insuranceBet).toBe(5);
    expect(game.bankroll).toBeLessThanOrEqual(1005);
  });
});

describe('dealer play', () => {
  it('stands on soft 17 unless the table hits it', () => {
    const stand = riggedGame(deal(card(10), card(1), card(8), card(6), [card(10)]));
    stand.startRound([{ seat: 1, bet: 10 }]);
    stand.declineInsurance();
    stand.act(ACTION.stand);
    expect(stand.dealer.total).toBe(17);

    const hit = riggedGame(deal(card(10), card(1), card(8), card(6), [card(2)]), { rules: makeRules({ 'rules.dealerHitsSoft17': true }) });
    hit.startRound([{ seat: 1, bet: 10 }]);
    hit.declineInsurance();
    hit.act(ACTION.stand);
    expect(hit.dealer.cardCount).toBe(3);
  });

  it('does not draw when every hand has busted', () => {
    const game = riggedGame(deal(card(10), card(5), card(6), card(6), [card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.dealer.cardCount).toBe(2);
  });
});

describe('no hole card (ENHC)', () => {
  const rules = makeRules({ 'rules.noHoleCard': true });

  it('loses only the original bet on a double against a dealer blackjack', () => {
    const game = riggedGame([card(6), card(10), card(5), card(10), card(1)], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.dealerBlackjack).toBe(true);
    expect(game.bankroll).toBe(990);
  });

  it('returns a split hand against a dealer blackjack', () => {
    const game = riggedGame([card(8), card(10), card(8), card(2), card(3), card(1)], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    game.act(ACTION.stand);
    game.act(ACTION.stand);
    expect(game.bankroll).toBe(990);
  });
});

describe('bonuses', () => {
  it('pays a five-card 21 double', () => {
    const rules = makeRules({ 'bonuses.fiveCard21': true });
    const game = riggedGame(deal(card(2), card(10), card(3), card(10), [card(4), card(5), card(7)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    expect(game.hands[0].total).toBe(21);
    expect(game.hands[0].result).toBe('Bonus');
    expect(game.bankroll).toBe(1020);
  });

  it('pays a diamond blackjack 2:1 when that bonus is on', () => {
    const rules = makeRules({ 'bonuses.diamondBlackjack': true });
    const game = riggedGame(deal(cardId(1, DIAMONDS), card(9), cardId(13, DIAMONDS), card(5)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.bankroll).toBe(1020);
  });

  it('pays suited sevens 10:1', () => {
    const rules = makeRules({ 'bonuses.sevens777': 'suited10:1' });
    const game = riggedGame(deal(cardId(7, HEARTS), card(10), cardId(7, HEARTS), card(10), [cardId(7, HEARTS)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].result).toBe('Bonus');
    expect(game.bankroll).toBe(1100);
  });
});

describe('shoe', () => {
  it('shuffles when the cut card is reached', () => {
    const game = riggedGame([], { table: { decks: 1, cardsBehindCutCard: 40, burnCards: 0 } });
    game.startRound([{ seat: 1, bet: 1 }]);
    while (!game.shoe.needsShuffle) {
      game.nextRound();
      game.startRound([{ seat: 1, bet: 1 }]);
      if (game.state === STATE.playerAction) game.act(ACTION.stand);
    }
    expect(game.shoe.dealt).toBeGreaterThanOrEqual(12);
    game.nextRound();
    game.startRound([{ seat: 1, bet: 1 }]);
    expect(game.shoe.dealt).toBeLessThan(12);
  });

  it('counts only the cards that are face up', () => {
    const seen = [];
    const game = new BlackjackGame({
      rules: makeRules(), table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
      bankroll: 1000, random: seededRandom(3), onCardSeen: c => seen.push(c),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    // Three cards are face up after the deal; the hole card is counted when revealed.
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
});

describe('GameSession', () => {
  it('plays a round, keeps the count, and persists the bankroll', async () => {
    const { GameSession } = await import('../../../src/game/session.js');
    const { createServices } = await import('../../../src/app/app.js');
    const app = createServices({ backend: new MemoryBackend() });
    app.sound = { play() {} };
    const session = new GameSession(app);
    session.startRound({ betPerHand: 10, hands: 1 });
    while (session.state === 'insurance') session.declineInsurance();
    while (session.state === 'playerAction') session.act('stand');
    expect(session.state).toBe('settled');
    expect(session.counts.runningCount).not.toBeNaN();
    expect(app.storage.get('bankroll')).toBe(session.bankroll);
    expect(session.stats.rounds).toBe(1);
  });
});
