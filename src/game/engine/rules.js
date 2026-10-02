// Table rules: the questions the engine asks about what is allowed and what a
// hand pays, derived from the user's settings.

import { valueOf, rankOf } from '../../core/cards.js';

export const SURRENDER = { none: 'none', late: 'late', early: 'early', earlyVsTen: 'earlyVsTen', macao: 'macao' };
export const INSURANCE = { none: 'none', normal: 'normal', blackjackOnly: 'blackjackOnly' };

/** Builds a rules object from the settings. */
export function rulesFrom(settings) {
  const get = key => settings.get(key);
  return {
    dealerHitsSoft17: get('rules.dealerHitsSoft17'),
    dealerPeeksTen: get('rules.dealerPeeksTen'),
    dealerPeeksAce: get('rules.dealerPeeksAce'),
    noHoleCard: get('rules.noHoleCard'),
    dealerBlackjackWinsAll: get('rules.dealerBlackjackWinsAll'),
    doubleAfterSplit: get('rules.doubleAfterSplit'),
    hardDoubles: get('rules.hardDoubles'),
    softDoubles: get('rules.softDoubles'),
    doubleOnThreeCards: get('rules.doubleOnThreeCards'),
    doubleAnyNumberOfCards: get('rules.doubleAnyNumberOfCards'),
    redouble: get('rules.redouble'),
    tripleDown: get('rules.tripleDown'),
    hitAfterDouble: get('rules.hitAfterDouble'),
    doubleDownRescue: get('rules.doubleDownRescue'),
    maxSplitHands: get('rules.maxSplitHands'),
    doubleAfterSplitAces: get('rules.doubleAfterSplitAces'),
    resplitAces: get('rules.resplitAces'),
    hitSplitAces: get('rules.hitSplitAces'),
    splitTensSameRankOnly: get('rules.splitTensSameRankOnly'),
    noAceSplits: get('rules.noAceSplits'),
    noSplit4s5s10s: get('rules.noSplit4s5s10s'),
    insurance: get('rules.insurance'),
    surrender: get('rules.surrender'),
    surrenderAfterInsurance: get('rules.surrenderAfterInsurance'),
    dealerWinsTies: get('rules.dealerWinsTies'),
    dealerWinsTied17: get('rules.dealerWinsTied17'),
    dealerWinsTies17to19: get('rules.dealerWinsTies17to19'),
    autoWinFiveCards: get('rules.autoWinFiveCards'),
    autoWinSixCards: get('rules.autoWinSixCards'),
    autoWinSevenCards: get('rules.autoWinSevenCards'),
    player22CountsAs21: get('rules.player22CountsAs21'),
    blackjackPayout: get('rules.blackjackPayout'),
    blackjackRoundUp: get('rules.blackjackRoundUp'),
    playerBlackjackAlwaysWins: get('rules.playerBlackjackAlwaysWins'),
    bonuses: {
      sevens777: get('bonuses.sevens777'),
      suitedAceJack: get('bonuses.suitedAceJack'),
      heartsAceJack: get('bonuses.heartsAceJack'),
      diamondBlackjack: get('bonuses.diamondBlackjack'),
      fiveCard21: get('bonuses.fiveCard21'),
      sixCard21: get('bonuses.sixCard21'),
      fivePlusCard21: get('bonuses.fivePlusCard21'),
      suited678: get('bonuses.suited678'),
      suited678IfWins: get('bonuses.suited678IfWins'),
      splitTenAceIsBlackjack: get('bonuses.splitTenAceIsBlackjack'),
    },
  };
}

/** Hands a player may hold at once in one seat. */
export const maxHandsPerSeat = rules => rules.maxSplitHands;

/** Whether the dealer checks for blackjack under an ace or ten. */
export function dealerPeeks(rules, upcard) {
  if (rules.noHoleCard) return false;
  const value = valueOf(upcard);
  if (value === 1) return rules.dealerPeeksAce;
  if (value === 10) return rules.dealerPeeksTen;
  return false;
}

/** Whether insurance is offered against this upcard. */
export function insuranceOffered(rules, upcard, playerHasTwentyOne) {
  if (rules.insurance === INSURANCE.none) return false;
  if (valueOf(upcard) !== 1) return false;
  return rules.insurance !== INSURANCE.blackjackOnly || playerHasTwentyOne;
}

/**
 * Whether a hand may double now.
 * @param {import('./hand.js').Hand} hand
 */
export function doubleAllowed(rules, hand) {
  if (hand.cardCount < 2) return false;
  if (hand.cardCount > 2 && !(rules.doubleAnyNumberOfCards || (rules.doubleOnThreeCards && hand.cardCount === 3))) return false;
  if (hand.isSplit && !rules.doubleAfterSplit) {
    // Split aces can still double when that is allowed explicitly.
    if (!(hand.isAcePair() && rules.doubleAfterSplitAces)) return false;
  }
  if (hand.doubled && !rules.redouble) return false;
  const { total, hardTotal, soft } = hand.totals();
  if (soft) {
    if (rules.softDoubles === 'any') return true;
    // "A8 or A9 only" means a soft 19 or soft 20.
    return rules.softDoubles === 'a8a9' && (total === 19 || total === 20);
  }
  switch (rules.hardDoubles) {
    case 'any': return true;
    case '8-11': return hardTotal >= 8 && hardTotal <= 11;
    case '9-11': return hardTotal >= 9 && hardTotal <= 11;
    case '10-11': return hardTotal >= 10 && hardTotal <= 11;
    default: return false;
  }
}

/** Whether a hand may split now. `handsInSeat` counts the hands the seat already holds. */
export function splitAllowed(rules, hand, handsInSeat) {
  if (!hand.isPair({ sameRankOnly: rules.splitTensSameRankOnly && valueOf(hand.cards[0]) === 10 })) return false;
  if (handsInSeat >= maxHandsPerSeat(rules)) return false;
  const value = valueOf(hand.cards[0]);
  if (value === 1 && rules.noAceSplits) return false;
  if (rules.noSplit4s5s10s && [4, 5, 10].includes(value)) return false;
  if (hand.isAcePair() && hand.isSplit && !rules.resplitAces) return false;
  return true;
}

/** Whether a split hand of aces may be hit or doubled. */
export function splitAcesMayDraw(rules, hand) {
  return !(hand.isSplit && valueOf(hand.cards[0]) === 1 && !rules.hitSplitAces);
}

/** Whether a hand may surrender now. */
export function surrenderAllowed(rules, hand, { hasInsurance = false } = {}) {
  if (rules.surrender === SURRENDER.none) return false;
  if (hasInsurance && !rules.surrenderAfterInsurance) return false;
  if (hand.isSplit) return false;
  if (rules.surrender === SURRENDER.macao) return hand.cardCount >= 2 && !hand.busted();
  return hand.cardCount === 2;
}

/** Whether early surrender is allowed against this upcard (before the dealer checks). */
export function earlySurrenderAllowed(rules, upcard) {
  if (rules.surrender === SURRENDER.early || rules.surrender === SURRENDER.macao) return true;
  return rules.surrender === SURRENDER.earlyVsTen && valueOf(upcard) === 10;
}

/** Whether the dealer must draw another card. */
export function dealerShouldDraw(rules, dealerHand) {
  const { total, hardTotal } = dealerHand.totals();
  if (total > 21) return false;
  if (hardTotal > 16) return false;
  // A soft 17 stands unless the table hits soft 17.
  if (total === 17 && hardTotal === 7) return rules.dealerHitsSoft17;
  return total <= 16;
}

/** A player hand that wins automatically for having many cards without busting. */
export function charlieWin(rules, hand) {
  if (hand.busted()) return false;
  const n = hand.cardCount;
  return (n === 5 && rules.autoWinFiveCards) || (n === 6 && rules.autoWinSixCards) || (n === 7 && rules.autoWinSevenCards);
}

/**
 * Extra amount a blackjack pays on top of an even-money win, as a multiple of
 * the bet (0.5 means 3:2).
 */
export function blackjackPremium(rules, hand) {
  const b = rules.bonuses;
  if (b.diamondBlackjack && hand.isDiamondPair) return 1;
  if (b.suitedAceJack && hand.isSuitedAceJack) return 1;
  if (b.heartsAceJack && hand.isHeartsAceJack) return 1;
  switch (rules.blackjackPayout) {
    case '2:1': return 1;
    case '1:1': return 0;
    case '6:5': return 0.2;
    default: return 0.5;
  }
}

/** Rounds a blackjack premium the way the table does. */
export const roundPremium = (rules, amount) => (rules.blackjackRoundUp ? Math.floor(amount + 0.5) : amount);

/** The value a hand busts above. */
export const bustValue = () => 21;

/** True when three cards are a suited 6-7-8. */
export function isSuited678(cards) {
  if (cards.length < 3) return false;
  const three = cards.slice(0, 3);
  const suits = new Set(three.map(c => Math.floor((c - 1) / 13)));
  if (suits.size !== 1) return false;
  return three.map(valueOf).sort((a, b) => a - b).join() === '6,7,8';
}

/** Describes a three-of-sevens hand: none, unsuited or suited. */
export function sevensKind(cards) {
  if (cards.length < 3) return 'none';
  const three = cards.slice(0, 3);
  if (!three.every(c => valueOf(c) === 7)) return 'none';
  const suits = new Set(three.map(c => Math.floor((c - 1) / 13)));
  return suits.size === 1 ? 'suited' : 'unsuited';
}

/** True when a card is a ten-valued card but not a ten (a face card). */
export const isFaceCard = card => rankOf(card) > 10;
