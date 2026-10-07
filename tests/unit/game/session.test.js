import { describe, it, expect, vi } from 'vitest';
import { GameSession } from '../../../src/game/session.js';
import { createServices } from '../../../src/app/app.js';
import { MemoryBackend } from '../../../src/services/storage.js';
import { cardId } from '../../../src/core/cards.js';
import { Counter } from '../../../src/core/counting.js';
import { SIDE_BET_GAME_DEFINITIONS } from '../../../src/data/side-bet-games.js';

const card = (rank, suit = 0) => cardId(rank, suit);

/** One human seat and no computer players, so the deal order is predictable. */
const ONE_SEAT = { 'table.seatCount': 1, 'table.computerSeats': [false, false, false, false, false, false] };

function makeApp(settings = {}, backend = new MemoryBackend()) {
  const app = createServices({ backend });
  app.sound = { play() {} };
  app.settings.update({ ...ONE_SEAT, ...settings });
  return app;
}

/** A session whose shoe deals the given cards in order, then falls back to random. */
function riggedSession(cards, app = makeApp()) {
  const session = new GameSession(app);
  const { shoe } = session.game;
  const queue = [...cards];
  const realDraw = shoe.draw.bind(shoe);
  shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift();
    shoe.remainingByCard[next] -= 1;
    shoe.remaining -= 1;
    shoe.dealt += 1;
    return next;
  };
  return session;
}

/** Deal order for one seat: player, upcard, player, hole card. */
const deal = (p1, up, p2, hole, rest = []) => [p1, up, p2, hole, ...rest];

/** A round played out to settlement. */
function playRound(session, betPerHand = 25) {
  session.startRound({ betPerHand });
  while (session.state === 'insurance') session.declineInsurance();
  while (session.state === 'playerAction') session.act('stand');
}

describe('the side-bet game', () => {
  it('offers no spots at a plain blackjack table', () => {
    const session = riggedSession([]);
    expect(session.sideBetGame).toBe(null);
    expect(session.sideBetSpots()).toEqual([]);
  });

  it('offers the spots of the chosen game', () => {
    const session = riggedSession([], makeApp({ 'bonuses.game': 13 }));
    expect(session.sideBetGame.name).toBe('Perfect Pairs');
    expect(session.sideBetSpots().length).toBeGreaterThan(0);
    expect(session.sideBetSpots()[0]).toHaveProperty('id');
  });

  it('plays plain blackjack when the chosen game has no definition', () => {
    const session = riggedSession([], makeApp({ 'bonuses.game': 2001 }));
    expect(session.sideBetGame).toBe(null);
    expect(session.sideBetSpots()).toEqual([]);
  });

  it('stakes a side bet beside the main bet and pays it', () => {
    const session = riggedSession(deal(card(10), card(9), cardId(10, 1), card(9)), makeApp({ 'bonuses.game': 13 }));
    const [spot] = session.sideBetSpots();
    session.startRound({ betPerHand: 25, sideBets: { [spot.id]: 5 } });
    expect(session.bankroll).toBe(29970);
    session.act('stand');
    expect(session.state).toBe('settled');
    // A pair of tens: the main bet pays 50 and the side bet 12:1.
    expect(session.game.hands[0].payout).toBe(115);
  });

  it('plays plain blackjack when a definition will not decode', () => {
    SIDE_BET_GAME_DEFINITIONS[2001] = 'not a definition';
    try {
      const session = riggedSession([], makeApp({ 'bonuses.game': 2001 }));
      expect(session.sideBetGame).toBe(null);
    } finally {
      delete SIDE_BET_GAME_DEFINITIONS[2001];
    }
  });
});

describe('the suggested bet', () => {
  it('reads the bet ramp at the current count', () => {
    const session = riggedSession([]);
    expect(session.suggestedBet()).toMatchObject({ betPerHand: 25, hands: 1, chips: 1 });
  });

  it('still reads the ramp when the ace side count is on', () => {
    const session = riggedSession([], makeApp({ 'trueCount.aceSideCount': true }));
    expect(session.counts.betCount).toBe(0);
    expect(session.suggestedBet()).toMatchObject({ betPerHand: 25, hands: 1 });
  });
});

describe('bet warnings', () => {
  it('warns about a bet the ramp does not call for, once', () => {
    const session = riggedSession([]);
    session.startRound({ betPerHand: 10 });
    expect(session.takeWarnings()).toEqual(['You should have bet $25']);
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats).toMatchObject({ betDecisions: 1, betErrors: 1 });
  });

  it('says nothing about a bet that matches the ramp', () => {
    const session = riggedSession([]);
    session.startRound({ betPerHand: 25 });
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats).toMatchObject({ betDecisions: 1, betErrors: 0 });
  });

  it('checks nothing when bet warnings are off', () => {
    const session = riggedSession([], makeApp({ 'betting.warnOnError': false }));
    session.startRound({ betPerHand: 10 });
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats.betDecisions).toBe(0);
  });

  it('does not count a round with nothing bet as the lowest bet', () => {
    const session = riggedSession([], makeApp({ 'betting.warnOnError': false }));
    session.startRound({ betPerHand: 0 });
    expect(session.stats).toMatchObject({ rounds: 1, totalBet: 0, highBet: 0, lowBet: 0 });
  });

  it('checks the ramp against the ace-adjusted count when that is on', () => {
    const session = riggedSession([], makeApp({ 'trueCount.aceSideCount': true }));
    session.startRound({ betPerHand: 10 });
    expect(session.takeWarnings()).toEqual(['You should have bet $25']);
  });
});

describe('insurance', () => {
  /** A 16 against an ace, with the dealer holding a blackjack. */
  const insuranceRound = (app = makeApp()) => riggedSession(deal(card(10), card(1), card(6), card(10)), app);

  it('takes insurance on the hand and pays it 2:1 against a blackjack', () => {
    const session = insuranceRound();
    session.startRound({ betPerHand: 25 });
    expect(session.state).toBe('insurance');
    session.takeInsurance();
    expect(session.game.hands[0].insuranceBet).toBe(12.5);
    expect(session.state).toBe('settled');
    // The insurance pays exactly what the hand lost.
    expect(session.bankroll).toBe(30000);
  });

  it('warns that insurance was wrong at this count', () => {
    const session = insuranceRound();
    session.startRound({ betPerHand: 25 });
    session.takeInsurance();
    expect(session.takeWarnings()).toEqual(['You should have taken no insurance']);
    expect(session.stats).toMatchObject({ playDecisions: 1, playErrors: 1 });
  });

  it('declines insurance and loses only the bet', () => {
    const session = insuranceRound();
    session.startRound({ betPerHand: 25 });
    session.declineInsurance();
    expect(session.game.hands[0].insuranceBet).toBe(0);
    expect(session.bankroll).toBe(29975);
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats).toMatchObject({ playDecisions: 1, playErrors: 0 });
  });

  it('weighs the ten side count when that is on', () => {
    const session = insuranceRound(makeApp({ 'trueCount.tenSideCount': true }));
    session.startRound({ betPerHand: 25 });
    session.takeInsurance();
    expect(session.takeWarnings()).toEqual(['You should have taken no insurance']);
  });

  it('checks nothing when strategy warnings are off', () => {
    const session = insuranceRound(makeApp({ 'strategy.warnOnError': false }));
    session.startRound({ betPerHand: 25 });
    session.takeInsurance();
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats.playDecisions).toBe(0);
  });
});

describe('actions', () => {
  it('offers the actions the engine allows', () => {
    const session = riggedSession(deal(card(10), card(9), card(6), card(5)));
    session.startRound({ betPerHand: 25 });
    expect(session.availableActions()).toMatchObject({ hit: true, stand: true, split: false });
  });

  it('warns about a play the strategy does not call for', () => {
    const session = riggedSession(deal(card(10), card(9), card(6), card(5)));
    session.startRound({ betPerHand: 25 });
    session.act('stand');
    expect(session.takeWarnings()).toEqual(['That should have been a Surrender']);
    expect(session.lastError).toMatchObject({ expectedName: 'Surrender', action: 'stand', hand: '1-0' });
    expect(session.stats).toMatchObject({ playDecisions: 1, playErrors: 1 });
  });

  it('checks nothing when strategy warnings are off', () => {
    const session = riggedSession(deal(card(10), card(9), card(6), card(5)), makeApp({ 'strategy.warnOnError': false }));
    session.startRound({ betPerHand: 25 });
    session.act('stand');
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats.playDecisions).toBe(0);
    expect(session.lastError).toBe(null);
  });

  it('checks nothing once the table is cleared', () => {
    const session = riggedSession(deal(card(10), card(9), card(10), card(9)));
    playRound(session);
    session.nextRound();
    session.act('stand');
    expect(session.stats.playDecisions).toBe(1);
  });
});

describe('dealer errors the screen asks for', () => {
  it('lets the dealer call a good hand a bust', () => {
    const session = riggedSession(deal(card(5), card(9), card(5), card(10), [card(5)]));
    session.onGoodHandBusted = hand => hand.cardCount === 3;
    session.startRound({ betPerHand: 25 });
    session.act('hit');
    const [hand] = session.game.hands;
    expect(hand.mistakenBust).toBe(true);
    expect(hand.total).toBe(15);
    expect(session.state).toBe('settled');
  });

  it('plays on when the dealer has no mistake to make', () => {
    const session = riggedSession(deal(card(5), card(9), card(5), card(10), [card(5)]));
    session.startRound({ betPerHand: 25 });
    session.act('hit');
    const [hand] = session.game.hands;
    expect(hand.mistakenBust).toBe(false);
    expect(session.state).toBe('playerAction');
  });

  it('lets the dealer stand when it should have drawn', () => {
    const session = riggedSession(deal(card(10), card(5), card(10), card(6)));
    session.beforeDealerDraw = () => false;
    session.startRound({ betPerHand: 25 });
    session.act('stand');
    expect(session.game.dealer.cardCount).toBe(2);
    expect(session.bankroll).toBe(30025);
  });
});

describe('the bankroll', () => {
  it('picks up where the last session left off', () => {
    const app = makeApp();
    app.storage.set('bankroll', 500);
    expect(new GameSession(app).bankroll).toBe(500);
  });

  it('starts afresh when the table refreshes the bankroll', () => {
    const app = makeApp({ 'table.refreshBankrollOnStart': true });
    app.storage.set('bankroll', 500);
    expect(new GameSession(app).bankroll).toBe(30000);
  });

  it('resets to the starting amount, and saves it', () => {
    const app = makeApp();
    const session = riggedSession(deal(card(10), card(9), card(10), card(9)), app);
    playRound(session);
    expect(session.bankroll).not.toBe(30000);
    session.resetBankroll();
    expect(session.bankroll).toBe(30000);
    expect(app.storage.get('bankroll')).toBe(30000);
  });

  it('takes a refund from the dealer, and saves it', () => {
    const app = makeApp();
    const session = riggedSession([], app);
    session.adjustBankroll(50);
    expect(session.bankroll).toBe(30050);
    expect(app.storage.get('bankroll')).toBe(30050);
    session.adjustBankroll(-50);
    expect(session.bankroll).toBe(30000);
  });
});

describe('shuffling', () => {
  const hidden = { 'table.showBurnCards': false };

  it('shuffles on demand and hands back the events to animate', () => {
    const session = riggedSession(deal(card(10), card(9), card(10), card(9)), makeApp(hidden));
    playRound(session);
    expect(session.counts.runningCount).not.toBe(0);
    const events = session.shuffleNow();
    expect(events.map(event => event.type)).toEqual(['shuffle', 'burn']);
    // A hidden burn card is not counted, so the new shoe starts at zero.
    expect(session.counts.runningCount).toBe(0);
    expect(session.game.shoe.needsShuffle).toBe(false);
  });

  it('starts the count afresh when the shoe is replaced between rounds', () => {
    const app = makeApp({ ...hidden, 'table.shuffleMode': 'rounds', 'table.roundsPerShoe': 1 });
    // Round one, then the new shoe's burn card, then round two.
    const cards = deal(card(10), card(10), card(10), card(10), [card(9), card(2), card(3), card(4), card(5)]);
    const session = riggedSession(cards, app);
    playRound(session);
    expect(session.counts.runningCount).toBe(-4);
    session.nextRound();
    expect(session.counts.runningCount).toBe(0);

    session.startRound({ betPerHand: 25 });
    // Only the three face-up cards of the new round are counted.
    expect(session.counts.runningCount).toBe(3);
  });
});

describe('burn cards and the count', () => {
  /** What one card is worth to the session's counting system. */
  const valueOf = (session, burned) => {
    const alone = new Counter(session.strategy, session.trueCountSettings());
    alone.reset(session.table.decks);
    alone.addCard(burned, 1);
    return alone.running;
  };

  /** The burn cards a session's opening shoe dealt, not yet played to the screen. */
  const openingBurns = session => session.game.events.filter(event => event.type === 'burn');

  it('burns the first shoe of a session, like every other', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 1 }));
    expect(openingBurns(session)).toHaveLength(1);
    expect(session.game.shoe.dealt).toBe(1);
  });

  it('burns as many cards as the table says', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 3 }));
    expect(openingBurns(session)).toHaveLength(3);
  });

  it('counts a shown burn card from the very first shoe', () => {
    const app = makeApp({ 'table.burnCards': 1, 'table.showBurnCards': true });
    const session = new GameSession(app);
    const [burn] = openingBurns(session);
    expect(burn.faceUp).toBe(true);
    expect(session.counts.runningCount).toBe(valueOf(session, burn.card));
  });

  it('does not count a hidden burn card', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 1, 'table.showBurnCards': false }));
    const [burn] = openingBurns(session);
    expect(burn.faceUp).toBe(false);
    expect(session.counts.runningCount).toBe(0);
  });

  it('counts a shown burn card on the shoe after a reshuffle too', () => {
    const app = makeApp({ 'table.burnCards': 1, 'table.showBurnCards': true, 'table.shuffleMode': 'rounds', 'table.roundsPerShoe': 1 });
    const session = new GameSession(app);
    session.game.takeEvents();
    playRound(session);
    const between = session.nextRound();
    const [burn] = between.filter(event => event.type === 'burn');
    // The old shoe's count is gone; only the new shoe's burn card is in it.
    expect(session.counts.runningCount).toBe(valueOf(session, burn.card));
  });

  it('counts a shown burn card when the player shuffles by hand', () => {
    const session = new GameSession(makeApp({ 'table.burnCards': 1, 'table.showBurnCards': true }));
    playRound(session);
    const [burn] = session.shuffleNow().filter(event => event.type === 'burn');
    expect(session.counts.runningCount).toBe(valueOf(session, burn.card));
  });

  it('starts a new count when the shoe runs out in the middle of a round', () => {
    const app = makeApp({ 'table.burnCards': 1, 'table.showBurnCards': false, 'table.decks': 1 });
    const session = new GameSession(app);
    const reset = vi.spyOn(session.counter, 'reset');
    // Empty the shoe, so the next card dealt needs a new one.
    while (session.game.shoe.remaining > 0) session.game.shoe.draw();
    session.startRound({ betPerHand: 25 });
    expect(reset).toHaveBeenCalled();
  });
});
