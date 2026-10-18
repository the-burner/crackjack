import { describe, it, expect, vi } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { SettingsPatch } from '@/settings/schema';
import { Counter } from '@/core/counting';
import { SIDE_BET_GAME_DEFINITIONS } from '@/data/side-bet-games';

const card = (rank: number, suit = 0) => cardId(rank, suit);

/** One human seat and no computer players, so the deal order is predictable. */
const ONE_SEAT: SettingsPatch = {
  'table.seatCount': 1,
  'table.computerSeats': [false, false, false, false, false, false],
};

function makeApp(settings: SettingsPatch = {}, backend = new MemoryBackend()) {
  const app = createServices({ backend });
  // A silent stand-in for the Web Audio player.
  app.sound = { play() {} } as unknown as typeof app.sound;
  app.settings.update({ ...ONE_SEAT, ...settings });
  return app;
}

/** A session whose shoe deals the given cards in order, then falls back to random. */
function riggedSession(cards: CardId[], app = makeApp()) {
  const session = new GameSession(app);
  const { shoe } = session.game;
  const queue = [...cards];
  const realDraw = shoe.draw.bind(shoe);
  shoe.draw = () => {
    if (queue.length === 0) return realDraw();
    const next = queue.shift() as CardId;
    shoe.remainingByCard[next] -= 1;
    shoe.remaining -= 1;
    shoe.dealt += 1;
    return next;
  };
  return session;
}

/** Deal order for one seat: player, upcard, player, hole card. */
const deal = (p1: CardId, up: CardId, p2: CardId, hole: CardId, rest: CardId[] = []) => [p1, up, p2, hole, ...rest];

/** A round played out to settlement. */
function playRound(session: GameSession, betPerHand = 25) {
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
    expect(session.sideBetGame!.name).toBe('Perfect Pairs');
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
    // The bundled table is read-only; the test plants a bad entry for a moment.
    const definitions = SIDE_BET_GAME_DEFINITIONS as Record<number, string>;
    definitions[2001] = 'not a definition';
    try {
      const session = riggedSession([], makeApp({ 'bonuses.game': 2001 }));
      expect(session.sideBetGame).toBe(null);
    } finally {
      delete definitions[2001];
    }
  });
});

describe('the suggested bet', () => {
  it('reads the bet ramp at the current count', () => {
    const session = riggedSession([]);
    expect(session.suggestedBet()).toMatchObject({ betPerHand: 25, hands: 1, chips: 1 });
  });

  it('still reads the ramp when the ace side count is on', () => {
    const session = riggedSession([], makeApp({ 'game.trueCount.aceSideCount': true }));
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
    const session = riggedSession([], makeApp({ 'game.betting.warnOnError': false }));
    session.startRound({ betPerHand: 10 });
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats.betDecisions).toBe(0);
  });

  it('does not count a round with nothing bet as the lowest bet', () => {
    const session = riggedSession([], makeApp({ 'game.betting.warnOnError': false }));
    session.startRound({ betPerHand: 0 });
    expect(session.stats).toMatchObject({ rounds: 1, totalBet: 0, highBet: 0, lowBet: 0 });
  });

  it('checks the ramp against the ace-adjusted count when that is on', () => {
    const session = riggedSession([], makeApp({ 'game.trueCount.aceSideCount': true }));
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
    const session = insuranceRound(makeApp({ 'game.trueCount.tenSideCount': true }));
    session.startRound({ betPerHand: 25 });
    session.takeInsurance();
    expect(session.takeWarnings()).toEqual(['You should have taken no insurance']);
  });

  it('checks nothing when strategy warnings are off', () => {
    const session = insuranceRound(makeApp({ 'game.strategy.warnOnError': false }));
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
    const session = riggedSession(
      deal(card(10), card(9), card(6), card(5)),
      makeApp({ 'game.strategy.warnOnError': false }),
    );
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
    app.bankroll.setState({ value: 500 });
    expect(new GameSession(app).bankroll).toBe(500);
  });

  it('starts afresh when the table refreshes the bankroll', () => {
    const app = makeApp({ 'table.refreshBankrollOnStart': true });
    app.bankroll.setState({ value: 500 });
    expect(new GameSession(app).bankroll).toBe(30000);
  });

  it('resets to the starting amount, and saves it', () => {
    const app = makeApp();
    const session = riggedSession(deal(card(10), card(9), card(10), card(9)), app);
    playRound(session);
    expect(session.bankroll).not.toBe(30000);
    session.resetBankroll();
    expect(session.bankroll).toBe(30000);
    expect(app.bankroll.getState().value).toBe(30000);
  });

  it('counts a dealer error taken after the payoff in the bankroll figures', () => {
    // 19 against 20: the hand loses its 25.
    const session = riggedSession(deal(card(10), card(10), card(9), card(10)));
    playRound(session);
    expect(session.stats).toMatchObject({ highBankroll: 29975, lowBankroll: 29975, bankrollSum: 29975 });
    session.adjustBankroll(-50);
    expect(session.stats).toMatchObject({ highBankroll: 29925, lowBankroll: 29925, bankrollSum: 29925 });
    // The Foul refund puts it back.
    session.adjustBankroll(50);
    expect(session.stats).toMatchObject({ highBankroll: 29975, lowBankroll: 29975, bankrollSum: 29975 });
  });

  it("leaves the last round's figures alone once the next round starts", () => {
    const session = riggedSession(
      deal(card(10), card(10), card(9), card(10), deal(card(10), card(9), card(10), card(9))),
    );
    playRound(session);
    session.startRound({ betPerHand: 25 });
    const before = { ...session.stats };
    session.adjustBankroll(25);
    expect(session.stats.bankrollSum).toBe(before.bankrollSum);
    expect(session.stats.highBankroll).toBe(before.highBankroll);
  });

  it('takes a refund from the dealer, and saves it', () => {
    const app = makeApp();
    const session = riggedSession([], app);
    session.adjustBankroll(50);
    expect(session.bankroll).toBe(30050);
    expect(app.bankroll.getState().value).toBe(30050);
    session.adjustBankroll(-50);
    expect(session.bankroll).toBe(30000);
  });
});

describe('shuffling', () => {
  const hidden: SettingsPatch = { 'table.showBurnCards': false };

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
  const valueOf = (session: GameSession, burned: CardId) => {
    const alone = new Counter(session.strategy, session.trueCountSettings());
    alone.reset(session.table.decks);
    alone.addCard(burned, 1);
    return alone.running;
  };

  /** The burn cards a session's opening shoe dealt, not yet played to the screen. */
  const openingBurns = (session: GameSession) => session.game.events.filter(event => event.type === 'burn');

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
    const app = makeApp({
      'table.burnCards': 1,
      'table.showBurnCards': true,
      'table.shuffleMode': 'rounds',
      'table.roundsPerShoe': 1,
    });
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

describe('the cards the true count treats as gone', () => {
  /** Decks remaining after the deal: 10 and 6 against a 9 up, its hole card face down. */
  const decksAfterDeal = (remainingCards: 'dealt' | 'shown' | 'inTray') => {
    const app = makeApp({
      'table.decks': 6,
      'table.burnCards': 0,
      'game.trueCount.resolution': 'exact',
      'game.trueCount.remainingCards': remainingCards,
    });
    const session = riggedSession(deal(card(10), card(9), card(6), card(5)), app);
    session.startRound({ betPerHand: 25 });
    return session.counts.decksRemaining * 52;
  };

  it('are every card dealt', () => {
    expect(decksAfterDeal('dealt')).toBeCloseTo(312 - 4);
  });

  it('leave out the cards still face down', () => {
    expect(decksAfterDeal('shown')).toBeCloseTo(312 - 3);
  });

  it('leave out the cards still on the table, by default', () => {
    expect(decksAfterDeal('inTray')).toBeCloseTo(312);
  });
});

describe('the error tallies', () => {
  const wrongDouble = (settings: SettingsPatch = {}) => {
    const app = makeApp(settings);
    const session = riggedSession(deal(card(10), card(9), card(6), card(5)), app);
    session.startRound({ betPerHand: 25 });
    session.act('double');
    expect(session.lastError).toMatchObject({ action: 'double' });
    return app.errorTallies.cells();
  };

  it('record a wrong play in its cell', () => {
    expect(wrongDouble()).toHaveLength(1);
  });

  it('leave out an extended strategy, whose columns are not the upcard', () => {
    expect(wrongDouble({ 'game.strategy.system': 92 })).toEqual([]);
  });
});

describe('the advanced count', () => {
  it('gives the cards left under each choice, the exact decks left and the exact true count', () => {
    const app = makeApp({ 'table.decks': 6, 'table.burnCards': 0, 'game.trueCount.remainingCards': 'shown' });
    // 10 and 6 against a 5 up: a running count of +1 with the hole card face down.
    const session = riggedSession(deal(card(10), card(5), card(6), card(9)), app);
    session.startRound({ betPerHand: 25 });
    const advanced = session.advancedCounts();
    expect(advanced.cardsLeft).toEqual({ dealt: 308, shown: 309, inTray: 312 });
    expect(advanced.inUse).toBe('shown');
    expect(advanced.exactDecks).toBeCloseTo(309 / 52);
    expect(advanced.exactTrueCount).toBeCloseTo(session.counts.runningCount / (309 / 52));
  });
});

describe('the counts at the start of the round', () => {
  it('are taken as betting opens, and kept through the round', () => {
    const app = makeApp({ 'table.decks': 6, 'table.burnCards': 0, 'game.trueCount.remainingCards': 'shown' });
    const session = riggedSession(deal(card(10), card(5), card(6), card(9)), app);
    expect(session.roundStartCounts).toBeNull();
    const { runningCount, decksRemaining, trueCount } = session.counts;
    session.startBetting();
    session.startRound({ betPerHand: 25 });
    expect(session.counts.runningCount).not.toBe(runningCount);
    expect(session.roundStartCounts).toEqual({ runningCount, decksRemaining, trueCount });
  });
});

describe('the true count between rounds', () => {
  it('counts the round’s cards as gone once they are in the tray', () => {
    // One deck, exact decks, rounded: the six cards going into the tray move the true count.
    const app = makeApp({
      'table.decks': 1,
      'table.burnCards': 0,
      'game.trueCount.remainingCards': 'inTray',
      'game.trueCount.resolution': 'exact',
      'game.trueCount.lastDeckResolution': 'exact',
      'game.trueCount.rounding': 'round',
    });
    // 2 and 3 against 4 up and 5 in the hole; the dealer draws 6 and 2 to stand on 17. A running count of +6.
    const session = riggedSession(deal(card(2), card(4), card(3), card(5), [card(6), card(2)]), app);
    playRound(session);
    session.nextRound();
    expect(session.counts.runningCount).toBe(6);
    // 6 over the 46 cards left: 6.78, rounded to 7.
    expect(session.counts.trueCount).toBe(7);
  });
});

describe('the true count', () => {
  it('follows the true count settings the moment they change, with no card seen', () => {
    const app = makeApp({
      'table.decks': 1,
      'table.burnCards': 0,
      'game.trueCount.resolution': 'exact',
      'game.trueCount.lastDeckResolution': 'exact',
      'game.trueCount.rounding': 'truncate',
    });
    const session = riggedSession(deal(card(2), card(4), card(3), card(5), [card(6), card(2)]), app);
    playRound(session);
    session.nextRound();
    // 6 over the 46 cards left: 6.78.
    expect(session.counts.trueCount).toBe(6);
    app.settings.set('game.trueCount.rounding', 'round');
    expect(session.counts.trueCount).toBe(7);
    app.settings.set('game.trueCount.remainingCards', 'dealt');
    expect(session.counts.decksRemaining).toBeCloseTo(46 / 52);
  });
});

describe('a shuffle while betting', () => {
  it('starts the round over on the new shoe', () => {
    // Exact decks, so the round's cards show in the decks left.
    const app = makeApp({ 'table.decks': 6, 'table.burnCards': 0, 'game.trueCount.resolution': 'exact' });
    const session = riggedSession(deal(card(10), card(5), card(6), card(9)), app);
    session.startBetting();
    session.startRound({ betPerHand: 25 });
    while (session.state === 'playerAction') session.act('stand');
    session.nextRound();
    session.startBetting();
    expect(session.roundStartCounts!.decksRemaining).toBeLessThan(6);
    session.shuffleNow();
    expect(session.roundStartCounts).toEqual({ runningCount: 0, decksRemaining: 6, trueCount: 0 });
  });
});

describe('wonging', () => {
  const WITH_COMPUTER: SettingsPatch = {
    'table.seatCount': 2,
    'table.computerSeats': [false, true, false, false, false, false],
    'game.betting.wonging': true,
  };
  /** Sets the running count that makes the true count `count` over the decks left now. */
  const setTrueCount = (session: GameSession, count: number) => {
    session.counter.running = count * session.counter.decksRemaining(session.cardsGone());
  };
  /** A session at true count `count`, before its first bet. */
  const at = (count: number, settings: SettingsPatch = WITH_COMPUTER) => {
    const session = new GameSession(makeApp(settings));
    setTrueCount(session, count);
    return session;
  };
  const minimumBet = (session: GameSession) => session.suggestedBet().betPerHand;

  it('sits out a round: graded as a bet, but not played', () => {
    const session = at(-3);
    session.wong();
    expect(session.takeWarnings()).toEqual([]);
    expect(session.stats).toMatchObject({ rounds: 0, totalBet: 0, betDecisions: 1, betErrors: 0, bankrollSum: 0 });
    expect(session.game.humanHands()).toEqual([]);
  });

  it('faults a Wong while the count says play', () => {
    const session = at(0);
    session.wong();
    expect(session.takeWarnings()).toEqual(['That should have been a bet, not a Wong']);
    expect(session.stats).toMatchObject({ betDecisions: 1, betErrors: 1 });
  });

  it('faults a bet once the count has fallen to Wong Out, until it is back at Wong In', () => {
    const session = at(-2);
    session.startRound({ betPerHand: minimumBet(session) });
    expect(session.takeWarnings()).toEqual(['That should have been a Wong']);
    expect(session.stats).toMatchObject({ rounds: 1, betDecisions: 1, betErrors: 1 });
  });

  it('stays out between the two counts, and comes back in at Wong In', () => {
    const session = at(-2);
    session.wong();
    setTrueCount(session, 0);
    expect(session.shouldWong()).toBe(true);
    setTrueCount(session, 1);
    expect(session.shouldWong()).toBe(false);
  });

  it('begins a shoe wonged out when told to, while Wong In is above 0', () => {
    const session = at(0, { ...WITH_COMPUTER, 'game.betting.wongStartOut': true });
    expect(session.shouldWong()).toBe(true);
  });

  it('asks nothing of a solo player, who must play every hand', () => {
    const session = at(-3, { 'game.betting.wonging': true });
    expect(session.soloNextRound()).toBe(true);
    session.startRound({ betPerHand: minimumBet(session) });
    expect(session.takeWarnings()).toEqual([]);
  });

  it('asks nothing when wonging is off', () => {
    const session = at(-3, { ...WITH_COMPUTER, 'game.betting.wonging': false });
    session.startRound({ betPerHand: minimumBet(session) });
    expect(session.takeWarnings()).toEqual([]);
  });
});
