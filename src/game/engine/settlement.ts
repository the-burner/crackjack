// @ts-nocheck
// Settling a hand against the dealer: what it pays and what to call the result.
//
// Money model: a hand's stake (bet + double + insurance + side bets) leaves the
// bankroll when it is placed. Settlement returns `payout` to the bankroll, so a
// push returns the stake, an even-money win returns twice it, and a loss
// returns nothing.

import { blackjackPremium, roundPremium, charlieWin, isSuited678, sevensKind } from './rules.ts';

export const RESULT = {
  win: 'Win',
  lose: 'Lose',
  push: 'Push',
  bust: 'Bust',
  blackjack: '21',
  surrender: 'Surrender',
  bonus: 'Bonus',
};

/**
 * @typedef {object} Settlement
 * @property {number} payout       Amount returned to the bankroll.
 * @property {string} result       A RESULT value, shown next to the hand.
 * @property {number} net          payout minus the amount staked on this hand.
 */

/**
 * Settles one player hand.
 * @param {object} o
 * @param {object} o.rules
 * @param {import('./hand.ts').Hand} o.hand
 * @param {import('./hand.ts').Hand} o.dealer
 * @param {boolean} o.dealerBlackjack
 * @returns {Settlement}
 */
export function settleHand({ rules, hand, dealer, dealerBlackjack }) {
  const stake = hand.bet + hand.doubleBet + hand.insuranceBet;
  const insurancePayout = settleInsurance({ hand, dealerBlackjack });
  const finish = (payout, result) => ({
    payout: payout + insurancePayout,
    result,
    net: payout + insurancePayout - stake,
  });

  // Surrender: half the bet comes back. Against a dealer blackjack a late
  // surrender (decided before the dealer checked) loses everything.
  // A hand the dealer wrongly busted pays nothing, whatever it held.
  if (hand.mistakenBust) return finish(0, RESULT.bust);

  if (hand.surrendered) {
    const lateAgainstBlackjack = dealerBlackjack && rules.surrender === 'late';
    // Half of everything wagered comes back, so a rescued double returns half of both bets.
    return finish(lateAgainstBlackjack ? 0 : (hand.bet + hand.doubleBet) / 2, RESULT.surrender);
  }

  const playerBlackjack =
    hand.isNatural() || (rules.bonuses.splitTenAceIsBlackjack && hand.cardCount === 2 && hand.total === 21);
  const wager = hand.bet + hand.doubleBet;

  if (dealerBlackjack) {
    // "Player BJ always wins" pays 3:2 instead of pushing (the original's own flat 0.5).
    if (playerBlackjack && rules.playerBlackjackAlwaysWins) return finish(hand.bet * 2.5, RESULT.win);
    if (playerBlackjack) return finish(wager, RESULT.push);
    if (rules.dealerBlackjackWinsAll) return finish(0, RESULT.lose);
    // Original bets only: the dealer takes just the hand's first bet, so a
    // double's extra wager comes back, and a hand created by splitting is
    // returned untouched.
    if (hand.index > 0) return finish(wager, RESULT.push);
    return finish(hand.doubleBet, RESULT.lose);
  }

  if (playerBlackjack) {
    const premium = roundPremium(rules, hand.bet * blackjackPremium(rules, hand));
    return finish(hand.bet * 2 + premium, RESULT.blackjack);
  }

  // Bonuses that win regardless of the dealer's hand.
  const bonus = handBonus(rules, hand, { dealerTotal: dealer.total });
  if (bonus) return finish(wager * (1 + bonus.multiplier), RESULT.bonus);

  if (hand.busted()) return finish(0, RESULT.bust);

  const dealerTotal = dealer.total;
  const dealerBusted = dealer.busted();
  if (dealerBusted || hand.total > dealerTotal) return finish(wager * 2, RESULT.win);
  if (hand.total < dealerTotal) return finish(0, RESULT.lose);

  // Equal totals.
  if (rules.dealerWinsTies) return finish(0, RESULT.lose);
  if (rules.dealerWinsTied17 && hand.total === 17) return finish(0, RESULT.lose);
  if (rules.dealerWinsTies17to19 && hand.total >= 17 && hand.total <= 19) return finish(0, RESULT.lose);
  return finish(wager, RESULT.push);
}

/** Insurance pays 2:1 when the dealer has blackjack; otherwise the stake is lost. */
function settleInsurance({ hand, dealerBlackjack }) {
  if (!hand.insuranceBet) return 0;
  return dealerBlackjack ? hand.insuranceBet * 3 : 0;
}

/**
 * A bonus that wins on the player's cards alone.
 * @returns {{multiplier: number, name: string}|null} multiplier is the profit as a multiple of the wager.
 */
export function handBonus(rules, hand, { dealerTotal = 0 } = {}) {
  const b = rules.bonuses;
  const n = hand.cardCount;
  const twentyOne = hand.total === 21 && !hand.busted();

  const sevens = sevensKind(hand.cards);
  if (sevens === 'suited' && b.sevens777 === 'suited10:1') return { multiplier: 10, name: 'Suited 777' };
  if (sevens !== 'none') {
    if (b.sevens777 === '2:1') return { multiplier: 2, name: '777' };
    if (b.sevens777 === '3:2') return { multiplier: 1.5, name: '777' };
  }
  // "Pays 2:1 if it wins" does not pay against a dealer 21.
  if (isSuited678(hand.cards) && (b.suited678 || (b.suited678IfWins && dealerTotal !== 21)))
    return { multiplier: 2, name: 'Suited 678' };
  if (twentyOne && n === 5 && b.fiveCard21) return { multiplier: 2, name: 'Five card 21' };
  if (twentyOne && n === 6 && b.sixCard21) return { multiplier: 2, name: 'Six card 21' };
  if (twentyOne && n >= 5 && b.fivePlusCard21) return { multiplier: 2, name: 'Five or more card 21' };
  if (charlieWin(rules, hand)) return { multiplier: 1, name: `${n} cards` };
  return null;
}
