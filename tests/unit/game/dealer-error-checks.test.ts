// Dealer errors over real rounds: a session wired to the dealer-error state the
// way the table controller wires it, dealing stacked cards.

import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createDealerErrorRound } from '@/game/dealer-error-round';
import { enabledErrors, missedMessage } from '@/game/dealer-errors';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { SettingsPatch } from '@/settings/schema';
import type { GameEvent } from '@/game/engine/events';
import type { GameAction } from '@/game/engine/game';

const card = (rank: number, suit = 0) => cardId(rank, suit);
const [A, K] = [1, 13];

const BASE: SettingsPatch = {
  'table.seatCount': 1,
  'table.computerSeats': [false, false, false, false, false, false],
  'table.startingBankroll': 1000,
  'table.burnCards': 0,
  'mechanics.dealerMakesObviousPlays': false,
  'rules.surrender': 'none',
};

/** A session dealing `cards` in order, with the dealer making every mistake it may. */
function table(cards: CardId[], settings: SettingsPatch = {}) {
  const app = createServices({ backend: new MemoryBackend() });
  // A silent stand-in for the Web Audio player.
  app.sound = { play() {} } as unknown as typeof app.sound;
  app.settings.update({ ...BASE, ...settings });
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
  const errors = createDealerErrorRound({ enabled: () => enabledErrors(app.settings), random: () => 0 });
  session.beforeDealerDraw = dealer => errors.dealerDraws(dealer, session.game.humanHands());
  session.onGoodHandBusted = hand => errors.bustsGoodHand(hand, session.game.dealer.total);

  /** As the controller does once the round settles. */
  const settle = (events: GameEvent[]) => {
    if (session.state !== 'settled') return;
    const error = errors.settle({
      events,
      humanHands: session.game.humanHands(),
      dealer: session.game.dealer,
      dealerBlackjack: Boolean(session.game.dealerBlackjack),
      rules: session.game.rules,
    });
    if (error && !error.alreadyPaid) session.adjustBankroll(-error.amount);
  };

  return {
    session,
    play(
      actions: GameAction[],
      { sideBets = {}, insure = null }: { sideBets?: Record<string, number>; insure?: boolean | null } = {},
    ) {
      // The events of the call that settled the round, as the controller sees them.
      let events = session.startRound({ betPerHand: 10, sideBets });
      if (insure !== null) events = insure ? session.takeInsurance() : session.declineInsurance();
      for (const action of actions) events = session.act(action);
      settle(events);
    },
    foul() {
      const result = errors.claim();
      if (result.caught) session.adjustBankroll(result.refund);
      return result;
    },
    takeMissed: () => errors.takeMissed(),
    dealerCards: () => session.game.dealer.cards,
    hand: () => session.game.hands[0],
  };
}

describe('a good hand called a bust', () => {
  const settings: SettingsPatch = { 'dealerErrors.bustOn21OrLess': true };

  it('refunds the bet when the dealer was level', () => {
    // Player 5, 6, hits a 9 for 20; dealer 10 and K.
    const t = table([card(5), card(10), card(6), card(K), card(9)], settings);
    t.play(['hit']);
    expect(t.hand().mistakenBust).toBe(true);
    expect(t.session.bankroll).toBe(990);
    expect(t.foul()).toMatchObject({ caught: true, refund: 10 });
    expect(t.session.bankroll).toBe(1000);
  });

  it('refunds nothing when the dealer was ahead with an unseen blackjack', () => {
    const t = table([card(5), card(10), card(6), card(A), card(9)], { ...settings, 'rules.dealerPeeksTen': false });
    t.play(['hit']);
    expect(t.hand().mistakenBust).toBe(true);
    expect(t.foul()).toMatchObject({ caught: true, refund: 0 });
    expect(t.session.bankroll).toBe(990);
  });

  it('can be a doubled 20, judged on the double card', () => {
    const t = table([card(5), card(10), card(6), card(7), card(9)], settings);
    t.play(['double']);
    expect(t.hand().mistakenBust).toBe(true);
    expect(t.session.bankroll).toBe(980);
  });

  it('can be a doubled 20 when doubled hands draw on', () => {
    // 4 and 3 doubled to 12, then a hit to 20.
    const t = table([card(4), card(10), card(3), card(7), card(5), card(8)], {
      ...settings,
      'rules.hitAfterDouble': true,
    });
    t.play(['double', 'hit']);
    expect(t.hand().mistakenBust).toBe(true);
    expect(t.session.bankroll).toBe(980);
  });

  it('is never a doubled 21', () => {
    // 4 and 3 doubled to 11, then a hit to 21.
    const t = table([card(4), card(10), card(3), card(7), card(4, 1), card(10, 1)], {
      ...settings,
      'rules.hitAfterDouble': true,
    });
    t.play(['double', 'hit']);
    expect(t.hand().mistakenBust).toBe(false);
    expect(t.session.bankroll).toBe(1020);
  });
});

describe('a dealer standing on 16', () => {
  const settings: SettingsPatch = { 'dealerErrors.standOn16': true };

  it('stops on a four-card soft 16, and Foul catches it', () => {
    // Player 10, 2 stands; dealer 2, A, 2, A, with a 5 to follow.
    const t = table([card(10), card(2), card(2), card(A), card(2, 1), card(A, 1), card(5)], settings);
    t.play(['stand']);
    expect(t.dealerCards()).toEqual([card(2), card(A), card(2, 1), card(A, 1)]);
    expect(t.foul()).toMatchObject({ caught: true });
  });

  it('costs a lost hand only its bet', () => {
    // Dealer 2, 3, 4, 7 = hard 16.
    const t = table([card(10), card(2), card(2, 1), card(3), card(4), card(7), card(5)], settings);
    t.play(['stand']);
    expect(t.dealerCards()).toEqual([card(2), card(3), card(4), card(7)]);
    expect(t.hand().result).toBe('Lose');
    expect(t.session.bankroll).toBe(990);
  });
});

describe('a mispaid blackjack beside a winning side bet', () => {
  // A spade blackjack against the dealer's 9 and 8; Royal Match pays 3:1 suited.
  const natural = [card(A), card(9), card(K), card(8)];
  const settings: SettingsPatch = { 'dealerErrors.blackjackPayoff': true, 'bonuses.game': 15 };

  it('keeps only the premium, refunded by Foul', () => {
    const t = table(natural, settings);
    const [spot] = t.session.sideBetSpots();
    t.play([], { sideBets: { [spot.id]: 10 } });
    // Paid in full: $25 for the natural and $40 for the side bet, $1,045.
    expect(t.session.bankroll).toBe(1040);
    expect(t.foul()).toMatchObject({ caught: true, refund: 5 });
    expect(t.session.bankroll).toBe(1045);
  });

  it('reports only the premium when missed', () => {
    const t = table(natural, settings);
    const [spot] = t.session.sideBetSpots();
    t.play([], { sideBets: { [spot.id]: 10 } });
    expect(missedMessage(t.takeMissed()!)).toBe('You missed a dealer error, BJ Mispaid, costing $5');
  });
});

describe('insurance', () => {
  it('is paid in full when blackjacks pay even money', () => {
    // Player 10, 8 insures against the dealer's A, K.
    const t = table([card(10), card(A), card(8), card(K)], {
      'dealerErrors.insurancePayoff': true,
      'rules.blackjackPayout': '1:1',
    });
    t.play([], { insure: true });
    expect(t.session.bankroll).toBe(1000);
    expect(t.foul()).toMatchObject({ caught: false });
  });
});
