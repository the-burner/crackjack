import { describe, it, expect } from 'vitest';
import {
  blackjackUnknown,
  lastPlayerTotal,
  sideBetWinOf,
  sideBetPaidOf,
  pickRoundError,
  withDealerError,
  bustedGoodHandError,
  createDealerErrorRound,
} from '../../../src/game/dealer-error-round.ts';
import { DEALER_ERROR } from '../../../src/game/dealer-errors.ts';
import { Hand } from '../../../src/game/engine/hand.ts';
import { rulesFrom } from '../../../src/game/engine/rules.ts';
import { Settings } from '../../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../../src/settings/schema.ts';
import { Storage, MemoryBackend } from '../../../src/services/storage.ts';
import { cardId } from '../../../src/core/cards.ts';

const card = (rank, suit = 0) => cardId(rank, suit);

function makeRules(overrides = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function handOf(ranks, { seat = 1, index = 0, bet = 10, result = null, payout = 0 } = {}) {
  const hand = new Hand({ seat, index, bet });
  for (const rank of ranks) hand.addCard(card(rank));
  hand.result = result;
  hand.payout = payout;
  return hand;
}

const dealerOf = ranks => handOf(ranks, { seat: 0, bet: 0 });

const settled = (hand, over = {}) => ({
  type: 'settled',
  hand,
  result: 'Push',
  payout: 10,
  net: 0,
  seat: 1,
  owner: 'human',
  sideBets: [],
  ...over,
});

const roundEnd = { type: 'roundEnd', bankroll: 1000, needsShuffle: false };

describe('a blackjack the dealer never checked for', () => {
  it('is possible under an unpeeked ace or ten', () => {
    const rules = makeRules({ 'rules.dealerPeeksAce': false, 'rules.dealerPeeksTen': false });
    expect(blackjackUnknown(rules, card(1))).toBe(true);
    expect(blackjackUnknown(rules, card(13))).toBe(true);
    expect(blackjackUnknown(rules, card(7))).toBe(false);
  });

  it('is ruled out once the dealer peeks, or before there is an up card', () => {
    const rules = makeRules({ 'rules.dealerPeeksAce': true, 'rules.dealerPeeksTen': true, 'rules.noHoleCard': false });
    expect(blackjackUnknown(rules, card(1))).toBe(false);
    expect(blackjackUnknown(rules, undefined)).toBe(false);
  });
});

describe('reading the round', () => {
  it('takes the last human hand total, or 0 with none', () => {
    expect(lastPlayerTotal([handOf([10, 5]), handOf([10, 8])])).toBe(18);
    expect(lastPlayerTotal([])).toBe(0);
  });

  it('reads side-bet winnings and returns off the hand settled event', () => {
    const events = [
      settled('1-0', {
        sideBets: [
          { name: 'a', stake: 5, payout: 30, multiplier: 5, label: '' },
          { name: 'b', stake: 5, payout: 0, multiplier: -1, label: '' },
        ],
      }),
    ];
    expect(sideBetWinOf(events, '1-0')).toBe(25);
    expect(sideBetPaidOf(events, '1-0')).toBe(30);
    expect(sideBetWinOf(events, '2-0')).toBe(0);
  });
});

describe('picking the round error', () => {
  const pushed = () => handOf([10, 5, 3], { result: 'Push', payout: 10 });
  const round = (over = {}) => ({
    events: [settled('1-0'), roundEnd],
    humanHands: [pushed()],
    dealer: dealerOf([10, 8]),
    stoodOnSixteen: false,
    dealerBlackjack: false,
    rules: makeRules(),
    enabled: [DEALER_ERROR.chipsOnPush],
    ...over,
  });

  it('takes the chips on a push when chance allows', () => {
    const error = pickRoundError(round({ random: () => 0 }));
    expect(error).toMatchObject({ type: DEALER_ERROR.chipsOnPush, amount: 10, hands: [{ key: '1-0', shortfall: 10 }] });
  });

  it('makes no error when chance does not allow it', () => {
    expect(pickRoundError(round({ random: () => 0.99 }))).toBe(null);
  });

  it('carries a stand on 16 the dealer made during play, already paid', () => {
    const lost = handOf([10, 5], { result: 'Lose', payout: 0 });
    const error = pickRoundError(
      round({ humanHands: [lost], stoodOnSixteen: true, enabled: [DEALER_ERROR.stoodOn16], random: () => 0.99 }),
    );
    expect(error).toMatchObject({ type: DEALER_ERROR.stoodOn16, amount: 10, alreadyPaid: true });
  });
});

describe('showing the error in the events', () => {
  const error = {
    type: DEALER_ERROR.chipsOnPush,
    label: 'Dealer took chips on a Push',
    amount: 10,
    hands: [{ key: '1-0', shortfall: 10, result: 'Lose' }],
  };

  it('changes the shorted hand result and payout and the round-end bankroll', () => {
    const events = [settled('1-0'), settled('2-0'), roundEnd];
    const shown = withDealerError(events, error, 990);
    expect(shown[0]).toMatchObject({ result: 'Lose', payout: 0 });
    expect(shown[1]).toBe(events[1]);
    expect(shown[2]).toMatchObject({ type: 'roundEnd', bankroll: 990 });
    // The engine's events are left alone.
    expect(events[0]).toMatchObject({ result: 'Push', payout: 10 });
    expect(events[2].bankroll).toBe(1000);
  });

  it('leaves the payouts of an error already paid in play', () => {
    const events = [settled('1-0'), roundEnd];
    const shown = withDealerError(events, { ...error, alreadyPaid: true }, 990);
    expect(shown[0]).toBe(events[0]);
    expect(shown[1].bankroll).toBe(990);
  });
});

describe('a good hand called a bust', () => {
  it('owes twice the bet against a lower dealer total, the bet on a tie, else nothing', () => {
    const at = dealerTotal => bustedGoodHandError({ key: '1-0', bet: 10, total: 20, dealerTotal }).amount;
    expect(at(17)).toBe(20);
    expect(at(20)).toBe(10);
    expect(at(21)).toBe(0);
  });

  it('shows the hand as a bust', () => {
    expect(bustedGoodHandError({ key: '2-1', bet: 10, total: 20, dealerTotal: 17 })).toMatchObject({
      type: DEALER_ERROR.bustedGoodHand,
      label: 'Busted a good hand',
      hands: [{ key: '2-1', shortfall: 20, result: 'Bust' }],
    });
  });
});

describe('the table dealer-error state', () => {
  const always = () => 0;

  it('makes the dealer stand on a long 16 against a lower player total, and remembers it', () => {
    const errors = createDealerErrorRound({ enabled: () => [DEALER_ERROR.stoodOn16], random: always });
    expect(errors.dealerDraws(dealerOf([2, 4, 3, 7]), [handOf([10, 5])])).toBe(false);
    const lost = handOf([10, 5], { result: 'Lose', payout: 0 });
    const error = errors.settle({
      events: [settled('1-0', { result: 'Lose', payout: 0 }), roundEnd],
      humanHands: [lost],
      dealer: dealerOf([2, 4, 3, 7]),
      dealerBlackjack: false,
      rules: makeRules(),
    });
    expect(error).toMatchObject({ type: DEALER_ERROR.stoodOn16 });
    expect(errors.pending).toBe(error);
  });

  it('lets the dealer draw when the error is off', () => {
    const errors = createDealerErrorRound({ enabled: () => [], random: always });
    expect(errors.dealerDraws(dealerOf([2, 4, 3, 7]), [handOf([10, 5])])).toBe(true);
  });

  it('busts one good hand at most, and makes no other error while it is pending', () => {
    const errors = createDealerErrorRound({
      enabled: () => [DEALER_ERROR.bustedGoodHand, DEALER_ERROR.chipsOnPush],
      random: always,
    });
    expect(errors.bustsGoodHand(handOf([5, 5, 10]), 17)).toBe(true);
    expect(errors.pending).toMatchObject({ type: DEALER_ERROR.bustedGoodHand, amount: 20 });
    expect(errors.bustsGoodHand(handOf([5, 5, 10], { seat: 2 }), 17)).toBe(false);
    const push = handOf([10, 5, 3], { result: 'Push', payout: 10 });
    expect(
      errors.settle({
        events: [settled('1-0'), roundEnd],
        humanHands: [push],
        dealer: dealerOf([10, 8]),
        dealerBlackjack: false,
        rules: makeRules(),
      }),
    ).toBe(null);
  });

  it('refunds a caught error once', () => {
    const errors = createDealerErrorRound({ enabled: () => [DEALER_ERROR.bustedGoodHand], random: always });
    errors.bustsGoodHand(handOf([5, 5, 10]), 17);
    expect(errors.claim()).toMatchObject({ caught: true, refund: 20, tone: 'good' });
    expect(errors.claim()).toMatchObject({ caught: false, refund: 0, tone: 'error' });
  });

  it('hands over a missed error once, at the next bet', () => {
    const errors = createDealerErrorRound({ enabled: () => [DEALER_ERROR.bustedGoodHand], random: always });
    errors.bustsGoodHand(handOf([5, 5, 10]), 17);
    expect(errors.takeMissed()).toMatchObject({ type: DEALER_ERROR.bustedGoodHand });
    expect(errors.takeMissed()).toBe(null);
  });

  it('forgets the stand on 16 at the next bet', () => {
    const errors = createDealerErrorRound({ enabled: () => [DEALER_ERROR.stoodOn16], random: always });
    errors.dealerDraws(dealerOf([2, 4, 3, 7]), [handOf([10, 5])]);
    errors.takeMissed();
    const lost = handOf([10, 5], { result: 'Lose', payout: 0 });
    expect(
      errors.settle({
        events: [settled('1-0', { result: 'Lose', payout: 0 }), roundEnd],
        humanHands: [lost],
        dealer: dealerOf([2, 4, 3, 7]),
        dealerBlackjack: false,
        rules: makeRules(),
      }),
    ).toBe(null);
  });
});
