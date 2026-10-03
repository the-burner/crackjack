// Dealers make mistakes. With the options under "Dealer Errors" on, the table
// occasionally shorts the player, who is meant to notice and call "Foul".
//
// This module is pure: it decides which mistake a settled round can carry, what
// it costs the player, and what a Foul claim or a missed error is worth. The
// table screen applies the result.
//
// The refund for a caught error and the cost reported for
// a missed one are the same number: exactly what the player was short.

/** The mistakes a dealer can make. */
export const DEALER_ERROR = {
  insuranceMispaid: 'insuranceMispaid',
  blackjackMispaid: 'blackjackMispaid',
  bustedGoodHand: 'bustedGoodHand',
  shouldHaveBusted: 'shouldHaveBusted',
  winNotPaid: 'winNotPaid',
  chipsOnPush: 'chipsOnPush',
  stoodOn16: 'stoodOn16',
  bonusNotPaid: 'bonusNotPaid',
};

/** What each mistake is called in the messages. */
export const ERROR_LABELS = {
  insuranceMispaid: 'Insurance Mispaid',
  blackjackMispaid: 'BJ Mispaid',
  bustedGoodHand: 'Busted a good hand',
  shouldHaveBusted: 'Dealer should have Busted',
  winNotPaid: 'Winning hand not paid',
  chipsOnPush: 'Dealer took chips on a Push',
  stoodOn16: 'Dealer stood on 16',
  bonusNotPaid: 'Bonus not paid',
};

/** The setting that turns each mistake on. */
export const ERROR_SETTINGS = {
  insuranceMispaid: 'dealerErrors.insurancePayoff',
  blackjackMispaid: 'dealerErrors.blackjackPayoff',
  bustedGoodHand: 'dealerErrors.bustOn21OrLess',
  shouldHaveBusted: 'dealerErrors.shouldHaveBusted',
  winNotPaid: 'dealerErrors.noPayOnWin',
  chipsOnPush: 'dealerErrors.loseOnPush',
  stoodOn16: 'dealerErrors.standOn16',
  bonusNotPaid: 'dealerErrors.noBonusPayoff',
};

/** How often each mistake happens when its option is on. */
export const ERROR_CHANCE = {
  insuranceMispaid: 0.35,
  blackjackMispaid: 0.385,
  bustedGoodHand: 0.14,
  shouldHaveBusted: 0.525,
  winNotPaid: 0.525,
  chipsOnPush: 0.35,
  stoodOn16: 0.07,
  bonusNotPaid: 0.385,
};

/** Every mistake this table can make. */
export const SUPPORTED_ERRORS = [
  DEALER_ERROR.insuranceMispaid,
  DEALER_ERROR.blackjackMispaid,
  DEALER_ERROR.bustedGoodHand,
  DEALER_ERROR.shouldHaveBusted,
  DEALER_ERROR.winNotPaid,
  DEALER_ERROR.chipsOnPush,
  DEALER_ERROR.stoodOn16,
  DEALER_ERROR.bonusNotPaid,
];

/**
 * Whether the dealer stops drawing on this hand by mistake. The caller asks
 * before each draw; a stand on a hard 16 is the mistake players must catch.
 */
export function dealerStandsByMistake({ dealer, enabled, random }) {
  if (!enabled.includes(DEALER_ERROR.stoodOn16)) return false;
  if (dealer.total !== 16 || dealer.soft) return false;
  return random() < ERROR_CHANCE[DEALER_ERROR.stoodOn16];
}

/** The mistakes the player's options allow, in the order they are considered. */
export function enabledErrors(settings, { supported = SUPPORTED_ERRORS } = {}) {
  return supported.filter(type => settings.get(ERROR_SETTINGS[type]));
}

/** True when any dealer-error option is on, which is when "Foul" is offered. */
export const dealerErrorsOn = settings => Object.values(ERROR_SETTINGS).some(key => settings.get(key));

/**
 * @typedef {object} ErrorHand
 * @property {string} key
 * @property {number} bet
 * @property {number} insuranceBet
 * @property {number} payout        What the hand actually paid out.
 * @property {number} total
 * @property {number} cardCount
 * @property {boolean} doubled
 * @property {boolean} isNatural
 * @property {number} splitCount
 * @property {string} result        A RESULT value.
 */

/**
 * Picks the mistake a settled round carries, if any. At most one per round.
 * @param {object} o
 * @param {ErrorHand[]} o.hands         The player's settled hands.
 * @param {{total: number, cardCount: number, busted: boolean}} o.dealer
 * @param {boolean} o.dealerBlackjack
 * @param {string[]} o.enabled          From enabledErrors().
 * @param {() => number} o.random
 * @returns {{type: string, label: string, amount: number, hands: {key: string, shortfall: number, result: string}[]}|null}
 */
export function pickDealerError({ hands, dealer, dealerBlackjack, enabled, random }) {
  for (const type of enabled) {
    const affected = affectedHands(type, { hands, dealer, dealerBlackjack });
    const amount = affected.reduce((sum, hand) => sum + hand.shortfall, 0);
    if (affected.length === 0 || amount <= 0) continue;
    if (random() >= ERROR_CHANCE[type]) continue;
    return { type, label: ERROR_LABELS[type], amount: round2(amount), hands: affected };
  }
  return null;
}

/** The hands a mistake of this type would touch, and what each one loses. */
function affectedHands(type, { hands, dealer, dealerBlackjack }) {
  const plain = hand => hand.cardCount >= 3 && !hand.doubled && hand.insuranceBet === 0 && hand.splitCount <= 1;
  switch (type) {
    // Insurance paid at 1:1 instead of 2:1.
    case DEALER_ERROR.insuranceMispaid:
      if (!dealerBlackjack) return [];
      return hands.filter(h => h.insuranceBet > 0)
        .map(h => ({ key: h.key, shortfall: h.insuranceBet, result: h.result }));
    // A natural paid at even money instead of the blackjack premium.
    case DEALER_ERROR.blackjackMispaid:
      return hands.filter(h => h.isNatural && h.payout > h.bet * 2)
        .map(h => ({ key: h.key, shortfall: h.payout - h.bet * 2, result: 'Win' }));
    // A good hand of three or more cards called a bust.
    case DEALER_ERROR.bustedGoodHand:
      return hands.filter(h => h.cardCount >= 3 && !h.doubled && h.payout > 0 && (h.total === 20 || h.total === 21))
        .map(h => ({ key: h.key, shortfall: h.payout, result: 'Bust' }));
    // The dealer busted but counted the hand as 21.
    case DEALER_ERROR.shouldHaveBusted:
      if (!dealer.busted || dealer.cardCount < 3) return [];
      if (dealer.total > 23 || (dealer.total === 23 && dealer.cardCount < 4)) return [];
      return hands.filter(h => h.payout > 0 && !h.isNatural && h.total <= 21)
        .map(h => ({
          key: h.key,
          // A hand of 21 would push against the claimed 21; anything less loses.
          shortfall: h.total === 21 ? Math.max(0, h.payout - h.bet) : h.payout,
          result: h.total === 21 ? 'Push' : 'Lose',
        }))
        .filter(h => h.shortfall > 0);
    // A hand that won by one point paid as a push.
    case DEALER_ERROR.winNotPaid:
      if (dealer.busted) return [];
      return hands.filter(h => plain(h) && h.result === 'Win' && h.total - dealer.total === 1)
        .map(h => ({ key: h.key, shortfall: h.bet, result: 'Push' }));
    // Chips taken on a push.
    case DEALER_ERROR.chipsOnPush:
      return hands.filter(h => plain(h) && h.result === 'Push')
        .map(h => ({ key: h.key, shortfall: h.bet, result: 'Lose' }));
    // The dealer stood on a hard 16. The hands that lost to it are the ones the
    // player was cheated of, since a drawing dealer busts more often than not.
    case DEALER_ERROR.stoodOn16:
      if (dealer.stoodOnSixteen !== true) return [];
      return hands.filter(h => h.payout === 0 && h.total <= 21 && !h.isNatural)
        .map(h => ({ key: h.key, shortfall: h.bet + (h.doubled ? h.bet : 0), result: 'Lose' }));
    // A winning side bet was not paid.
    case DEALER_ERROR.bonusNotPaid:
      return hands.filter(h => h.sideBetWin > 0)
        .map(h => ({ key: h.key, shortfall: h.sideBetWin, result: h.result }));
    default:
      return [];
  }
}

/**
 * Settles a Foul claim.
 * @param {object|null} pending  The error from pickDealerError, or null.
 * @returns {{caught: boolean, refund: number, message: string, tone: string}}
 */
export function claimFoul(pending) {
  if (!pending) return { caught: false, refund: 0, message: ' No dealer errors ', tone: 'error' };
  return { caught: true, refund: pending.amount, message: ' You caught a dealer error ', tone: 'good' };
}

/** What to say at the start of the next round when the player did not notice. */
export function missedMessage(pending) {
  return `You missed a dealer error, ${pending.label}, costing ${formatAmount(pending.amount)}`;
}

const formatAmount = amount => `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

const round2 = n => Math.round(n * 100) / 100;

/**
 * Reads the fields pickDealerError needs off an engine hand and its settlement.
 * @param {import('./engine/hand.js').Hand} hand
 */
export function errorHandFrom(hand, { sideBetWin = 0 } = {}) {
  return {
    key: hand.key,
    sideBetWin,
    bet: hand.bet,
    insuranceBet: hand.insuranceBet,
    payout: hand.payout,
    total: hand.total,
    cardCount: hand.cardCount,
    doubled: hand.doubled,
    isNatural: hand.isNatural(),
    splitCount: hand.splitCount,
    result: hand.result,
  };
}
