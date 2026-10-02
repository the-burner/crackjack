import { describe, it, expect } from 'vitest';
import {
  DEALER_ERROR, ERROR_CHANCE, SUPPORTED_ERRORS, enabledErrors, dealerErrorsOn,
  pickDealerError, claimFoul, missedMessage,
} from '../../../src/game/dealer-errors.js';

const settingsWith = on => ({ get: key => on.includes(key) });

const hand = (over = {}) => ({
  key: '1-0', bet: 10, insuranceBet: 0, payout: 20, total: 20, cardCount: 3,
  doubled: false, isNatural: false, splitCount: 0, result: 'Win', ...over,
});

const dealerAt = (total, over = {}) => ({ total, cardCount: 3, busted: total > 21, ...over });

/** A random function that always fires the error. */
const always = () => 0;
/** A random function that never fires the error. */
const never = () => 1;

describe('enabled errors', () => {
  it('lists only the options that are on, in a fixed order', () => {
    const settings = settingsWith(['dealerErrors.loseOnPush', 'dealerErrors.blackjackPayoff']);
    expect(enabledErrors(settings)).toEqual([DEALER_ERROR.blackjackMispaid, DEALER_ERROR.chipsOnPush]);
  });

  it('leaves out the errors the engine cannot make', () => {
    const settings = settingsWith(['dealerErrors.standOn16', 'dealerErrors.noBonusPayoff']);
    expect(enabledErrors(settings)).toEqual([]);
    expect(SUPPORTED_ERRORS).not.toContain(DEALER_ERROR.stoodOn16);
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

  it('busts a good hand: the player loses the whole payout', () => {
    const error = pickDealerError({
      hands: [hand({ total: 21, cardCount: 4, payout: 20 })], dealer: dealerAt(19),
      dealerBlackjack: false, enabled: [DEALER_ERROR.bustedGoodHand], random: always,
    });
    expect(error.amount).toBe(20);
    expect(error.hands[0].result).toBe('Bust');
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

  it('does not claim 21 on a two-card dealer bust or a wild total', () => {
    const base = { hands: [hand({ total: 18, payout: 20 })], dealerBlackjack: false, enabled: [DEALER_ERROR.shouldHaveBusted], random: always };
    expect(pickDealerError({ ...base, dealer: dealerAt(22, { cardCount: 2 }) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(25) })).toBe(null);
    expect(pickDealerError({ ...base, dealer: dealerAt(23, { cardCount: 4 }) })).not.toBe(null);
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
