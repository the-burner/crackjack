import { describe, it, expect } from 'vitest';
import { BlackjackGame, STATE, ACTION } from '@/game/engine/game';
import type { GameOptions, TableConfig } from '@/game/engine/game';
import { rulesFrom } from '@/game/engine/rules';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { SettingsPatch } from '@/settings/schema';
import { seededRandom } from '@/core/random';
import { decodeSideBetGame } from '@/settings/side-bet-games';
import { sideBetSpots } from '@/game/engine/side-bets';
import { SIDE_BET_GAME_DEFINITIONS } from '@/data/side-bet-games';

const SPADES = 0,
  HEARTS = 2,
  DIAMONDS = 3;
const card = (rank: number, suit = SPADES) => cardId(rank, suit);

function makeRules(overrides: SettingsPatch = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

interface RigOptions extends Partial<Omit<GameOptions, 'table'>> {
  table?: Partial<TableConfig>;
}

/** A game whose shoe deals the given cards in order, then falls back to random. */
function riggedGame(
  cards: CardId[],
  { rules = makeRules(), table = {}, bankroll = 1000, ...options }: RigOptions = {},
) {
  const game = new BlackjackGame({
    rules,
    table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true, ...table },
    bankroll,
    random: seededRandom(1),
    ...options,
  });
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

// Deal order: player card 1, dealer upcard, player card 2, dealer hole card.
const deal = (p1: CardId, up: CardId, p2: CardId, hole: CardId, rest: CardId[] = []) => [p1, up, p2, hole, ...rest];

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

  it('points at the next split hand before dealing its second card', () => {
    const game = riggedGame(deal(card(8), card(5), card(8), card(6), [card(3), card(2), card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    const events = game.act(ACTION.stand);
    const turn = events.findIndex(e => e.type === 'turn' && e.hand === '1-1');
    const dealt = events.findIndex(e => e.type === 'card' && e.hand === '1-1');
    expect(turn).toBeGreaterThanOrEqual(0);
    expect(turn).toBeLessThan(dealt);
    // Once pointed at, the hand is not pointed at again for its decision.
    expect(events.filter(e => e.type === 'turn')).toHaveLength(1);
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

    const hit = riggedGame(deal(card(10), card(1), card(8), card(6), [card(2)]), {
      rules: makeRules({ 'rules.dealerHitsSoft17': true }),
    });
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
    const game = riggedGame(deal(cardId(7, HEARTS), card(10), cardId(7, HEARTS), card(10), [cardId(7, HEARTS)]), {
      rules,
    });
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

  it('shuffles in the middle of a deal when the shoe runs out', () => {
    const game = riggedGame([], { table: { decks: 1, shuffleMode: 'rounds', roundsPerShoe: 80, burnCards: 0 } });
    let shuffles = 0;
    for (let round = 0; round < 20 && shuffles === 0; round++) {
      const events = [...game.startRound([{ seat: 1, bet: 1 }])];
      while (game.state === STATE.insurance) events.push(...game.declineInsurance());
      while (game.state === STATE.playerAction) events.push(...game.act(ACTION.stand));
      shuffles += events.filter(event => event.type === 'shuffle').length;
    }
    expect(shuffles).toBe(1);
    expect(game.shoe.remaining).toBeGreaterThan(0);
  });

  it('counts only the cards that are face up', () => {
    const seen = [];
    const game = new BlackjackGame({
      rules: makeRules(),
      table: { decks: 6, burnCards: 0, seatCount: 1, computerSeats: [], doubleDownCardFaceUp: true },
      bankroll: 1000,
      random: seededRandom(3),
      onCardSeen: c => seen.push(c),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    // Three cards are face up after the deal; the hole card is counted when revealed.
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });
});

describe('seats and bets', () => {
  it('leaves out a seat that did not bet', () => {
    const game = riggedGame([], { table: { seatCount: 2 } });
    game.startRound([
      { seat: 1, bet: 0 },
      { seat: 2, bet: 10 },
    ]);
    expect(game.hands.map(hand => hand.seat)).toEqual([2]);
    expect(game.bankroll).toBe(990);
  });

  it('leaves out a computer seat the table does not have', () => {
    const game = riggedGame([], { table: { seatCount: 2, computerSeats: [2, 3] } });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.map(hand => hand.seat)).toEqual([1, 2]);
  });

  it('seats and burns nothing at a table that says nothing about either', () => {
    const game = riggedGame([], { table: { seatCount: undefined, computerSeats: undefined, burnCards: undefined } });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.map(hand => hand.owner)).toEqual(['human']);
    game.shuffleAndBurn();
    expect(game.takeEvents().map(event => event.type)).toEqual(['shuffle']);
  });

  it('seats no computer player at a table that says it has no seats', () => {
    const game = riggedGame([], { table: { seatCount: undefined, computerSeats: [1] } });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.hands.map(hand => hand.owner)).toEqual(['human']);
  });
});

describe('answers the engine ignores', () => {
  it('ignores an insurance answer when none was offered', () => {
    const game = riggedGame(deal(card(10), card(9), card(6), card(5)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.playerAction);
    expect(game.takeInsurance()).toEqual([]);
    expect(game.declineInsurance()).toEqual([]);
    expect(game.hands[0].insuranceBet).toBe(0);
    expect(game.bankroll).toBe(990);
  });

  it('ignores an action the hand may not take', () => {
    const game = riggedGame(deal(card(10), card(9), card(6), card(5)));
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.availableActions().split).toBe(false);
    expect(game.act(ACTION.split)).toEqual([]);
    expect(game.hands.length).toBe(1);
    expect(game.state).toBe(STATE.playerAction);
  });

  it('ignores an action once the round is settled', () => {
    const game = riggedGame(deal(card(10), card(9), card(10), card(9)));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(game.state).toBe(STATE.settled);
    expect(game.act(ACTION.hit)).toEqual([]);
    expect(game.hands[0].cardCount).toBe(2);
    expect(game.bankroll).toBe(1010);
  });
});

describe('surrender before the insurance answer', () => {
  it('lets a hand give up early, and only once', () => {
    const rules = makeRules({ 'rules.surrender': 'early' });
    const game = riggedGame(deal(card(10), card(1), card(6), card(10)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.insurance);
    expect(game.availableActions().surrender).toBe(true);
    // Nothing else can be played while the insurance offer stands.
    expect(game.act(ACTION.hit)).toEqual([]);
    game.act(ACTION.surrender);
    expect(game.hands[0].surrendered).toBe(true);
    expect(game.availableActions().surrender).toBe(false);
    game.declineInsurance();
    expect(game.bankroll).toBe(995);
  });

  it('offers no surrender at a table that does not allow it', () => {
    const rules = makeRules({ 'rules.surrender': 'none' });
    const game = riggedGame(deal(card(10), card(1), card(6), card(9)), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.state).toBe(STATE.insurance);
    expect(game.availableActions()).toEqual({ surrender: false });
  });

  it('offers no surrender when only computer seats are in play', () => {
    const game = riggedGame([card(10), card(1), card(7), card(10)], { table: { seatCount: 2, computerSeats: [2] } });
    game.startRound([]);
    expect(game.state).toBe(STATE.insurance);
    expect(game.availableActions()).toEqual({ surrender: false });
  });
});

describe('when the dealer takes the decision away', () => {
  it('stands a hand that reaches the table card limit', () => {
    const game = riggedGame(deal(card(2), card(9), card(3), card(5), [card(4)]), { table: { maxCardsPerHand: 3 } });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].cardCount).toBe(3);
    expect(game.state).toBe(STATE.settled);
  });

  it('stands the dealer when the table says not to draw', () => {
    const game = riggedGame(deal(card(10), card(5), card(10), card(6)), { beforeDealerDraw: () => false });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(game.dealer.cardCount).toBe(2);
    expect(game.dealer.total).toBe(11);
    expect(game.bankroll).toBe(1010);
  });
});

describe('doubling', () => {
  it('doubles twice over when the table allows a triple down', () => {
    const rules = makeRules({ 'rules.tripleDown': true });
    const game = riggedGame(deal(card(5), card(9), card(6), card(5), [card(9)]), { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.hands[0].doubleBet).toBe(20);
    expect(game.hands[0].wagered).toBe(30);
  });

  it('busts a doubled hand and goes straight to the payoff', () => {
    const game = riggedGame(deal(card(10), card(9), card(6), card(5), [card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.double);
    expect(game.hands[0].result).toBe('Bust');
    expect(game.dealer.cardCount).toBe(2);
    expect(game.bankroll).toBe(980);
  });
});

describe('split aces', () => {
  it('stands both halves when split aces may not draw', () => {
    const game = riggedGame(deal(card(1), card(5), card(1), card(6), [card(9), card(8), card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.split);
    expect(game.state).toBe(STATE.settled);
    expect(game.hands.map(hand => hand.total)).toEqual([20, 19]);
    expect(game.hands.every(hand => hand.stood)).toBe(true);
    expect(game.bankroll).toBe(980);
  });

  it('points at the second ace though it may not draw', () => {
    const game = riggedGame(deal(card(1), card(5), card(1), card(6), [card(9), card(8), card(10)]));
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.act(ACTION.split);
    const turn = events.findIndex(e => e.type === 'turn' && e.hand === '1-1');
    expect(turn).toBeGreaterThanOrEqual(0);
    expect(turn).toBeLessThan(events.findIndex(e => e.type === 'card' && e.hand === '1-1'));
  });
});

describe('no hole card and nothing left to beat', () => {
  it('leaves the dealer one card when every hand is already out', () => {
    const rules = makeRules({ 'rules.noHoleCard': true });
    const game = riggedGame([card(10), card(9), card(6), card(7)], { rules });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    expect(game.hands[0].result).toBe('Bust');
    expect(game.dealer.cardCount).toBe(1);
    expect(game.bankroll).toBe(990);
  });
});

describe('computer seats', () => {
  const twoSeats = { seatCount: 2, computerSeats: [2] };
  const computerHand = (game: BlackjackGame) => game.hands.find(hand => hand.seat === 2)!;

  it('plays a dealer-like strategy when no decisions are supplied', () => {
    const game = riggedGame([card(10), card(10), card(5), card(10), card(6), card(6)], { table: twoSeats });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    // 16 against a 5: the fallback strategy stands.
    expect(computerHand(game).cardCount).toBe(2);
    expect(computerHand(game).stood).toBe(true);
  });

  it('follows the decisions it is given', () => {
    const game = riggedGame([card(10), card(2), card(9), card(10), card(3), card(9), card(4), card(10)], {
      table: twoSeats,
      computerPlay: hand => (hand.total < 17 ? ACTION.hit : ACTION.stand),
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(computerHand(game).cardCount).toBe(4);
    expect(computerHand(game).total).toBe(19);
    expect(computerHand(game).stood).toBe(true);
  });

  it('stops a computer hand that reaches 21', () => {
    const game = riggedGame([card(10), card(5), card(9), card(10), card(6), card(9), card(10)], {
      table: twoSeats,
      computerPlay: () => ACTION.hit,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.stand);
    expect(computerHand(game).total).toBe(21);
    expect(computerHand(game).cardCount).toBe(3);
    expect(computerHand(game).stood).toBe(true);
  });

  it('doubles without touching the player bankroll', () => {
    const game = riggedGame([card(10), card(5), card(9), card(10), card(6), card(9), card(10)], {
      table: twoSeats,
      computerPlay: () => ACTION.double,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.bankroll).toBe(990);
    game.act(ACTION.stand);
    expect(computerHand(game).doubled).toBe(true);
    expect(computerHand(game).doubleBet).toBe(5);
    expect(computerHand(game).cardCount).toBe(3);
    expect(game.bankroll).toBe(1010);
  });

  it('busts a computer hand that keeps hitting', () => {
    const game = riggedGame([card(10), card(10), card(9), card(10), card(6), card(9), card(10)], {
      table: twoSeats,
      computerPlay: () => ACTION.hit,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    const events = game.act(ACTION.stand);
    expect(computerHand(game).result).toBe('Bust');
    expect(events).toContainEqual({ type: 'message', text: 'Bust', hand: '2-0' });
  });

  it('splits into two hands without touching the player bankroll', () => {
    const game = riggedGame([card(10), card(8), card(9), card(10), card(8), card(9), card(2), card(3)], {
      table: twoSeats,
      computerPlay: () => ACTION.split,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    expect(game.bankroll).toBe(990);
    game.act(ACTION.stand);
    expect(game.hands.filter(hand => hand.seat === 2).map(hand => hand.key)).toEqual(['2-0', '2-1']);
    expect(game.bankroll).toBe(1010);
  });
});

describe('side bets through the engine', () => {
  it('keeps a side-bet stake at a table with no side-bet game', () => {
    const game = riggedGame(deal(card(10), card(9), card(10), card(9)));
    game.startRound([{ seat: 1, bet: 10, sideBets: { main: 5 } }]);
    expect(game.bankroll).toBe(985);
    const [settled] = game.act(ACTION.stand).filter(event => event.type === 'settled');
    expect(settled.sideBets).toEqual([]);
    expect(game.bankroll).toBe(1005);
  });

  it('pays a five-card 21 bonus on the main bet', () => {
    const sideBetGame = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[17]);
    const game = riggedGame(deal(card(2), card(10), card(3), card(7), [card(4), card(5), card(7)]), { sideBetGame });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    const [settled] = game.act(ACTION.hit).filter(event => event.type === 'settled');
    expect(game.hands[0].cardCount).toBe(5);
    expect(game.hands[0].total).toBe(21);
    expect(settled.sideBets).toEqual([{ name: 'bonus', stake: 0, payout: 5, multiplier: 0.5, label: 'Bonus' }]);
    expect(game.bankroll).toBe(1015);
  });

  it('adds the game bonus on top of a hand the table already paid a bonus', () => {
    const rules = makeRules({ 'bonuses.fiveCard21': true });
    const sideBetGame = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[17]);
    const game = riggedGame(deal(card(2), card(10), card(3), card(7), [card(4), card(5), card(7)]), {
      rules,
      sideBetGame,
    });
    game.startRound([{ seat: 1, bet: 10 }]);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    game.act(ACTION.hit);
    expect(game.hands[0].result).toBe('Bonus');
    expect(game.bankroll).toBe(1025);
  });

  it('pays a side bet the player placed on a spot', () => {
    const sideBetGame = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[13]);
    const [spot] = sideBetSpots(sideBetGame);
    const game = riggedGame(deal(card(10), card(9), cardId(10, 1), card(9)), { sideBetGame });
    game.startRound([{ seat: 1, bet: 10, sideBets: { [spot.id]: 5 } }]);
    expect(game.bankroll).toBe(985);
    const [settled] = game.act(ACTION.stand).filter(event => event.type === 'settled');
    expect(settled.sideBets).toEqual([{ name: spot.id, stake: 5, payout: 65, multiplier: 12, label: spot.id }]);
    expect(game.bankroll).toBe(1070);
  });

  it('loses a side bet the hand does not match', () => {
    const sideBetGame = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[13]);
    const [spot] = sideBetSpots(sideBetGame);
    const game = riggedGame(deal(card(10), card(9), card(8), card(8)), { sideBetGame });
    game.startRound([{ seat: 1, bet: 10, sideBets: { [spot.id]: 5 } }]);
    const [settled] = game.act(ACTION.stand).filter(event => event.type === 'settled');
    expect(settled.sideBets).toEqual([{ name: spot.id, stake: 5, payout: 0, multiplier: -1, label: spot.id }]);
    expect(game.bankroll).toBe(1005);
  });
});

describe('GameSession', () => {
  it('plays a round, keeps the count, and persists the bankroll', async () => {
    const { GameSession } = await import('@/game/session');
    const { createServices } = await import('@/app/app');
    const app = createServices({ backend: new MemoryBackend() });
    // A silent stand-in for the Web Audio player.
    app.sound = { play() {} } as unknown as typeof app.sound;
    const session = new GameSession(app);
    session.startRound({ betPerHand: 10, hands: 1 });
    while (session.state === 'insurance') session.declineInsurance();
    while (session.state === 'playerAction') session.act('stand');
    expect(session.state).toBe('settled');
    expect(session.counts.runningCount).not.toBeNaN();
    expect(app.bankroll.getState().value).toBe(session.bankroll);
    expect(session.stats.rounds).toBe(1);
  });
});
