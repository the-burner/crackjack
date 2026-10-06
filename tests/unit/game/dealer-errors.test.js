import { describe, it, expect } from 'vitest';
import {
  DEALER_ERROR, ERROR_CHANCE, UNPEEKED_BLACKJACK_CHANCE, SUPPORTED_ERRORS, enabledErrors,
  dealerErrorsOn, pickDealerError, claimFoul, missedMessage, dealerStandsByMistake,
  bustsGoodHandByMistake, bustedGoodHandShortfall, errorHandFrom,
} from '../../../public/src/game/dealer-errors.js';
import { Hand } from '../../../public/src/game/engine/hand.js';
import { cardId } from '../../../public/src/core/cards.js';

const settingsWith = on => ({ get: key => on.includes(key) });

const hand = (over = {}) => ({
  key: '1-0', bet: 10, insuranceBet: 0, payout: 20, total: 20, cardCount: 3,
  doubled: false, isNatural: false, splitCount: 0, result: 'Win', ...over,
});

const dealerAt = (total, over = {}) => ({ total, cardCount: 4, busted: total > 21, ...over });

/** A random function that always fires the error. */
const always = () => 0;
/** A random function that never fires the error. */
const never = () => 1;

describe('enabled errors', () => {
  it('lists only the options that are on, in a fixed order', () => {
    const settings = settingsWith(['dealerErrors.loseOnPush', 'dealerErrors.blackjackPayoff']);
    expect(enabledErrors(settings)).toEqual([DEALER_ERROR.blackjackMispaid, DEALER_ERROR.chipsOnPush]);
  });

  it('includes standing on 16 and unpaid bonuses', () => {
    const settings = settingsWith(['dealerErrors.standOn16', 'dealerErrors.noBonusPayoff']);
    expect(enabledErrors(settings)).toEqual([DEALER_ERROR.stoodOn16, DEALER_ERROR.bonusNotPaid]);
    expect(SUPPORTED_ERRORS).toContain(DEALER_ERROR.stoodOn16);
  });

  it('reports whether the Foul button is needed', () => {
    expect(dealerErrorsOn(settingsWith([]))).toBe(false);
    expect(dealerErrorsOn(settingsWith(['dealerErrors.standOn16']))).toBe(true);
  });
});

describe('picking an error', () => {
  it('makes nothing happen when no option is on', () => {
    expect(pickDealerError({ hands: [hand()], dealer: dealerAt(19), dealerBlackjack: false, enabled: [], random: always })).toBe(null);
  });

  it('respects the per-error chance', () => {
    const args = { hands: [hand({ result: 'Push', payout: 10 })], dealer: dealerAt(20), dealerBlackjack: false, enabled: [DEALER_ERROR.chipsOnPush] };
    expect(pickDealerError({ ...args, random: never })).toBe(null);
    expect(pickDealerError({ ...args, random: () => ERROR_CHANCE.chipsOnPush - 0.01 })).not.toBe(null);
  });

  it('takes the chips on a push: the player is short the bet', () => {
    const error = pickDealerError({
      hands: [hand({ result: 'Push', payout: 10 })], dealer: dealerAt(20),
      dealerBlackjack: false, enabled: [DEALER_ERROR.chipsOnPush], random: always,
    });
    expect(error).toMatchObject({ type: DEALER_ERROR.chipsOnPush, amount: 10 });
    expect(error.hands).toEqual([{ key: '1-0', shortfall: 10, result: 'Lose' }]);
  });

  it('does not take chips on a push from a doubled or insured hand', () => {
    const base = { dealer: dealerAt(20), dealerBlackjack: false, enabled: [DEALER_ERROR.chipsOnPush], random: always };
    expect(pickDealerError({ ...base, hands: [hand({ result: 'Push', payout: 20, doubled: true })] })).toBe(null);
    expect(pickDealerError({ ...base, hands: [hand({ result: 'Push', payout: 10, insuranceBet: 5 })] })).toBe(null);
    expect(pickDealerError({ ...base, hands: [hand({ result: 'Push', payout: 10, cardCount: 2 })] })).toBe(null);
  });

  it('pays a blackjack at even money: the player is short the premium', () => {
    const error = pickDealerError({
      hands: [hand({ isNatural: true, cardCount: 2, payout: 25, total: 21, result: '21' })],
      dealer: dealerAt(19), dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    });
    expect(error.amount).toBe(5);
    expect(error.hands[0].result).toBe('Win');
  });

  it('mispays a blackjack more often when the dealer never peeked', () => {
    const base = {
      hands: [hand({ isNatural: true, cardCount: 2, payout: 25, total: 21, result: '21' })],
      dealer: dealerAt(19), dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid],
    };
    const between = () => ERROR_CHANCE.blackjackMispaid + 0.01;
    expect(pickDealerError({ ...base, dealerPeeked: true, random: between })).toBe(null);
    expect(pickDealerError({ ...base, dealerPeeked: false, random: between })).not.toBe(null);
    expect(pickDealerError({ ...base, dealerPeeked: false, random: () => UNPEEKED_BLACKJACK_CHANCE })).toBe(null);
    // Peeking is the default.
    expect(pickDealerError({ ...base, random: between })).toBe(null);
  });

  it('does not mispay a blackjack that already pays even money', () => {
    expect(pickDealerError({
      hands: [hand({ isNatural: true, cardCount: 2, payout: 20, total: 21, result: '21' })],
      dealer: dealerAt(19), dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    })).toBe(null);
  });

  it('pays insurance at 1:1: the player is short the insurance stake', () => {
    const error = pickDealerError({
      hands: [hand({ insuranceBet: 5, payout: 15, result: 'Lose' })], dealer: dealerAt(21, { cardCount: 2, busted: false }),
      dealerBlackjack: true, enabled: [DEALER_ERROR.insuranceMispaid], random: always,
    });
    expect(error.amount).toBe(5);
  });

  it('only mispays insurance when the dealer has blackjack', () => {
    expect(pickDealerError({
      hands: [hand({ insuranceBet: 5 })], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.insuranceMispaid], random: always,
    })).toBe(null);
  });

  it('only mispays insurance on a hand the blackjack beat', () => {
    const base = { dealer: dealerAt(21, { cardCount: 2, busted: false }), dealerBlackjack: true, enabled: [DEALER_ERROR.insuranceMispaid], random: always };
    // A natural pushes the blackjack, so there is nothing to short.
    expect(pickDealerError({ ...base, hands: [hand({ insuranceBet: 5, payout: 25, isNatural: true, cardCount: 2, total: 21, result: 'Push' })] })).toBe(null);
    // A split hand keeps its stake against the blackjack.
    expect(pickDealerError({ ...base, hands: [hand({ insuranceBet: 5, payout: 25, result: 'Push' })] })).toBe(null);
    expect(pickDealerError({ ...base, hands: [hand({ insuranceBet: 5, payout: 35, result: 'Win' })] })).toBe(null);
  });

  it('does not mispay insurance when blackjacks pay even money', () => {
    expect(pickDealerError({
      hands: [hand({ insuranceBet: 5, payout: 15, result: 'Lose' })], dealer: dealerAt(21, { cardCount: 2, busted: false }),
      dealerBlackjack: true, blackjackBonus: false, enabled: [DEALER_ERROR.insuranceMispaid], random: always,
    })).toBe(null);
  });

  it('never busts a good hand at the payoff: that mistake is made during the hand', () => {
    expect(pickDealerError({
      hands: [hand({ total: 21, cardCount: 4, payout: 20 })], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.bustedGoodHand], random: always,
    })).toBe(null);
  });

  it('does not pay a hand that won by one point', () => {
    const error = pickDealerError({
      hands: [hand({ total: 20, payout: 20, result: 'Win' })], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.winNotPaid], random: always,
    });
    expect(error.amount).toBe(10);
    expect(error.hands[0].result).toBe('Push');
  });

  it('only shorts a one-point win', () => {
    expect(pickDealerError({
      hands: [hand({ total: 20, payout: 20, result: 'Win' })], dealer: dealerAt(18),
      dealerBlackjack: false, enabled: [DEALER_ERROR.winNotPaid], random: always,
    })).toBe(null);
  });

  it('pays every hand when the dealer busts, so nothing is short', () => {
    expect(pickDealerError({
      hands: [hand({ total: 20, payout: 20, result: 'Win' })], dealer: dealerAt(22),
      dealerBlackjack: false, enabled: [DEALER_ERROR.winNotPaid], random: always,
    })).toBe(null);
  });

  it('claims 21 when the dealer busts with 22', () => {
    const error = pickDealerError({
      hands: [hand({ key: '1-0', total: 18, payout: 20 }), hand({ key: '2-0', total: 21, payout: 20 })],
      dealer: dealerAt(22), dealerBlackjack: false, enabled: [DEALER_ERROR.shouldHaveBusted], random: always,
    });
    // The 18 loses its whole payout; the 21 is pushed, so it keeps its stake.
    expect(error.hands).toEqual([
      { key: '1-0', shortfall: 20, result: 'Lose' },
      { key: '2-0', shortfall: 10, result: 'Push' },
    ]);
    expect(error.amount).toBe(30);
  });

  it('needs four dealer cards for 22 and five for 23', () => {
    const base = { hands: [hand({ total: 18, payout: 20 })], dealerBlackjack: false, enabled: [DEALER_ERROR.shouldHaveBusted], random: always };
    expect(pickDealerError({ ...base, dealer: dealerAt(22, { cardCount: 3 }) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(22, { cardCount: 4 }) })).not.toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(23, { cardCount: 4 }) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(23, { cardCount: 5 }) })).not.toBe(null);
  });

  it('does not claim 21 on a two-card dealer bust or a wild total', () => {
    const base = { hands: [hand({ total: 18, payout: 20 })], dealerBlackjack: false, enabled: [DEALER_ERROR.shouldHaveBusted], random: always };
    expect(pickDealerError({ ...base, dealer: dealerAt(22, { cardCount: 2 }) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(25) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(24, { cardCount: 6 }) })).toBe(null);
  });

  it('leaves a natural alone when the dealer claims 21', () => {
    expect(pickDealerError({
      hands: [hand({ isNatural: true, cardCount: 2, total: 21, payout: 25 })],
      dealer: dealerAt(22), dealerBlackjack: false, enabled: [DEALER_ERROR.shouldHaveBusted], random: always,
    })).toBe(null);
  });

  it('makes at most one error, taking the first that applies', () => {
    const error = pickDealerError({
      hands: [hand({ result: 'Push', payout: 10 })], dealer: dealerAt(20), dealerBlackjack: false,
      enabled: [DEALER_ERROR.blackjackMispaid, DEALER_ERROR.chipsOnPush], random: always,
    });
    expect(error.type).toBe(DEALER_ERROR.chipsOnPush);
  });
});

describe('claiming and missing', () => {
  it('refunds exactly what the player was short', () => {
    const pending = { type: DEALER_ERROR.winNotPaid, label: 'Winning hand not paid', amount: 10, hands: [] };
    expect(claimFoul(pending)).toMatchObject({ caught: true, refund: 10 });
  });

  it('reports a false Foul call', () => {
    expect(claimFoul(null)).toMatchObject({ caught: false, refund: 0 });
  });

  it('reports a missed error at the same amount as the refund', () => {
    const pending = { type: DEALER_ERROR.winNotPaid, label: 'Winning hand not paid', amount: 10, hands: [] };
    expect(missedMessage(pending)).toBe('You missed a dealer error, Winning hand not paid, costing $10');
    expect(claimFoul(pending).refund).toBe(pending.amount);
  });

  it('shows cents when the amount is not whole', () => {
    expect(missedMessage({ label: 'BJ Mispaid', amount: 2.5 })).toContain('$2.50');
  });
});

describe('standing on 16 and unpaid bonuses', () => {
  const standing = (over = {}) => dealerStandsByMistake({
    dealer: { total: 16, hardTotal: 16, cardCount: 4, ...(over.dealer ?? {}) },
    playerTotal: over.playerTotal ?? 15,
    enabled: over.enabled ?? [DEALER_ERROR.stoodOn16],
    random: over.random ?? (() => 0),
  });

  it('stands on 16 only when that mistake is enabled', () => {
    expect(standing()).toBe(true);
    expect(standing({ random: () => 0.99 })).toBe(false);
    expect(standing({ random: () => ERROR_CHANCE.stoodOn16 - 0.001 })).toBe(true);
    expect(standing({ random: () => ERROR_CHANCE.stoodOn16 })).toBe(false);
    expect(standing({ enabled: [] })).toBe(false);
  });

  it('stands on a soft 16 too, but not on another total', () => {
    expect(standing({ dealer: { total: 16, hardTotal: 6, cardCount: 4 } })).toBe(true);
    expect(standing({ dealer: { total: 17, hardTotal: 7, cardCount: 4 } })).toBe(false);
    expect(standing({ dealer: { total: 15, hardTotal: 15, cardCount: 4 } })).toBe(false);
  });

  it('needs four or more dealer cards', () => {
    expect(standing({ dealer: { total: 16, hardTotal: 16, cardCount: 3 } })).toBe(false);
    expect(standing({ dealer: { total: 16, hardTotal: 16, cardCount: 5 } })).toBe(true);
  });

  it('leaves a player who already stands on 17 alone', () => {
    expect(standing({ playerTotal: 16 })).toBe(true);
    expect(standing({ playerTotal: 17 })).toBe(false);
    expect(standing({ playerTotal: 20 })).toBe(false);
  });

  it('charges the hands that lost to a dealer who stood on 16', () => {
    const hands = [
      { key: '1-0', bet: 10, insuranceBet: 0, payout: 0, total: 15, cardCount: 2, doubled: false, isNatural: false, splitCount: 0, result: 'Lose', sideBetWin: 0 },
      { key: '2-0', bet: 10, insuranceBet: 0, payout: 20, total: 20, cardCount: 2, doubled: false, isNatural: false, splitCount: 0, result: 'Win', sideBetWin: 0 },
      { key: '3-0', bet: 10, insuranceBet: 0, payout: 0, total: 16, cardCount: 3, doubled: true, isNatural: false, splitCount: 0, result: 'Lose', sideBetWin: 0 },
    ];
    const error = pickDealerError({
      hands,
      dealer: { total: 16, cardCount: 4, busted: false, stoodOnSixteen: true },
      dealerBlackjack: false,
      enabled: [DEALER_ERROR.stoodOn16],
      random: () => 0,
    });
    expect(error.type).toBe(DEALER_ERROR.stoodOn16);
    // The doubled hand was short twice its bet.
    expect(error.amount).toBe(30);
    expect(error.hands.map(h => h.key)).toEqual(['1-0', '3-0']);
  });

  it('charges nothing for standing on 16 unless the dealer actually stood', () => {
    const hands = [{ key: '1-0', bet: 10, insuranceBet: 0, payout: 0, total: 15, cardCount: 2, doubled: false, isNatural: false, splitCount: 0, result: 'Lose', sideBetWin: 0 }];
    expect(pickDealerError({
      hands,
      dealer: { total: 16, cardCount: 4, busted: false },
      dealerBlackjack: false,
      enabled: [DEALER_ERROR.stoodOn16],
      random: always,
    })).toBe(null);
  });

  it('charges an unpaid winning side bet', () => {
    const hands = [{ key: '1-0', bet: 10, insuranceBet: 0, payout: 20, total: 20, cardCount: 2, doubled: false, isNatural: false, splitCount: 0, result: 'Win', sideBetWin: 45 }];
    const error = pickDealerError({
      hands,
      dealer: { total: 18, cardCount: 2, busted: false },
      dealerBlackjack: false,
      enabled: [DEALER_ERROR.bonusNotPaid],
      random: () => 0,
    });
    expect(error.amount).toBe(45);
  });
});

describe('busting a good hand, as the card lands', () => {
  const drawn = (over = {}) => ({ total: 20, cardCount: 3, doubled: false, ...over });
  const on = [DEALER_ERROR.bustedGoodHand];

  it('needs the option on', () => {
    expect(bustsGoodHandByMistake({ hand: drawn(), enabled: [], random: always })).toBe(false);
    expect(bustsGoodHandByMistake({ hand: drawn(), enabled: on, random: always })).toBe(true);
  });

  it('happens as often as the original did', () => {
    const chance = ERROR_CHANCE[DEALER_ERROR.bustedGoodHand];
    expect(chance).toBeCloseTo(0.14);
    expect(bustsGoodHandByMistake({ hand: drawn(), enabled: on, random: () => chance - 0.001 })).toBe(true);
    expect(bustsGoodHandByMistake({ hand: drawn(), enabled: on, random: () => chance })).toBe(false);
    expect(bustsGoodHandByMistake({ hand: drawn(), enabled: on, random: never })).toBe(false);
  });

  it('only touches a 20 or 21 of three or more cards', () => {
    expect(bustsGoodHandByMistake({ hand: drawn({ total: 21 }), enabled: on, random: always })).toBe(true);
    expect(bustsGoodHandByMistake({ hand: drawn({ total: 19 }), enabled: on, random: always })).toBe(false);
    expect(bustsGoodHandByMistake({ hand: drawn({ cardCount: 2 }), enabled: on, random: always })).toBe(false);
  });

  it('leaves a doubled 21 alone but not a doubled 20', () => {
    expect(bustsGoodHandByMistake({ hand: drawn({ total: 21, doubled: true }), enabled: on, random: always })).toBe(false);
    expect(bustsGoodHandByMistake({ hand: drawn({ total: 20, doubled: true }), enabled: on, random: always })).toBe(true);
  });

  it('owes double the bet when the dealer was behind, the bet when level, nothing when ahead', () => {
    expect(bustedGoodHandShortfall({ bet: 10, playerTotal: 20, dealerTotal: 18 })).toBe(20);
    expect(bustedGoodHandShortfall({ bet: 10, playerTotal: 20, dealerTotal: 20 })).toBe(10);
    expect(bustedGoodHandShortfall({ bet: 10, playerTotal: 20, dealerTotal: 21 })).toBe(0);
  });
});

describe('reading an engine hand', () => {
  /** A settled engine hand: an insured ace-king that paid 3:2. */
  function settledHand() {
    const engineHand = new Hand({ seat: 2, index: 1, bet: 10 });
    engineHand.addCard(cardId(1, 0));
    engineHand.addCard(cardId(13, 0));
    engineHand.insuranceBet = 5;
    engineHand.payout = 25;
    engineHand.result = '21';
    return engineHand;
  }

  it('copies the fields the error check reads', () => {
    expect(errorHandFrom(settledHand())).toEqual({
      key: '2-1', sideBetWin: 0, sideBetPaid: 0, bet: 10, insuranceBet: 5, payout: 25, total: 21,
      cardCount: 2, doubled: false, isNatural: true, splitCount: 0, result: '21',
    });
  });

  it('carries the side-bet win the settlement reported', () => {
    expect(errorHandFrom(settledHand(), { sideBetWin: 45 }).sideBetWin).toBe(45);
    expect(errorHandFrom(settledHand(), { sideBetPaid: 60 }).sideBetPaid).toBe(60);
  });

  it('describes the hand well enough to find a mispaid blackjack', () => {
    const error = pickDealerError({
      hands: [errorHandFrom(settledHand())], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    });
    expect(error).toMatchObject({ type: DEALER_ERROR.blackjackMispaid, amount: 5 });
  });
});

describe('a mispaid blackjack with a side bet', () => {
  const natural = (over = {}) => hand({
    isNatural: true, bet: 10, payout: 25, total: 21, cardCount: 2, result: 'Win', ...over,
  });

  it('shorts only the blackjack premium, not the side bet the hand also won', () => {
    // $10 bet paid 3:2 is $25; a $12.50 side-bet win rides along in payout.
    const error = pickDealerError({
      hands: [natural({ payout: 37.5, sideBetWin: 12.5 })], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    });
    expect(error.amount).toBe(5);
  });

  it('shorts the premium when there is no side bet', () => {
    const error = pickDealerError({
      hands: [natural()], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    });
    expect(error.amount).toBe(5);
  });
});

describe('a dealer that stood on 16 by mistake', () => {
  const stood = () => ({ ...dealerAt(18, { cardCount: 4 }), stoodOnSixteen: true });
  const lost = hand({ total: 18, payout: 0, result: 'Lose' });

  it('always counts as an error, without a second roll', () => {
    // The dealer has already stood: whether it was a mistake is not in doubt.
    const error = pickDealerError({
      hands: [lost], dealer: stood(), dealerBlackjack: false, enabled: [DEALER_ERROR.stoodOn16], random: never,
    });
    expect(error).toMatchObject({ type: DEALER_ERROR.stoodOn16, amount: 10 });
  });

  it('has already cost the player their bet, so it is not charged again', () => {
    const error = pickDealerError({
      hands: [lost], dealer: stood(), dealerBlackjack: false, enabled: [DEALER_ERROR.stoodOn16], random: always,
    });
    expect(error.alreadyPaid).toBe(true);
  });

  it('is charged at the payoff for a mistake made there', () => {
    const error = pickDealerError({
      hands: [hand({ total: 20, payout: 20, result: 'Push', cardCount: 3 })], dealer: dealerAt(20),
      dealerBlackjack: false, enabled: [DEALER_ERROR.chipsOnPush], random: always,
    });
    expect(error.alreadyPaid).toBe(false);
  });
});

describe('a mispaid blackjack beside a winning side bet', () => {
  it('shorts only the premium: the side bet’s stake and winnings are both its own', () => {
    // A $10 natural paid 3:2 is $25; a $10 side bet at 1:1 returns $20 more.
    const error = pickDealerError({
      hands: [hand({ isNatural: true, bet: 10, payout: 45, total: 21, cardCount: 2, result: 'Win', sideBetWin: 10, sideBetPaid: 20 })],
      dealer: dealerAt(19), dealerBlackjack: false, enabled: [DEALER_ERROR.blackjackMispaid], random: always,
    });
    expect(error.amount).toBe(5);
  });
});
