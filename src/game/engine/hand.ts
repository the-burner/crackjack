// @ts-nocheck
// A single hand at the table.

import { handTotals, valueOf, rankOf, suitOf } from '../../core/cards.ts';

/** Who is playing a hand. */
export const PLAYER = { human: 'human', computer: 'computer' };

export class Hand {
  /**
   * @param {object} o
   * @param {number} o.seat        Seat number 1..6 (0 is the dealer).
   * @param {number} o.index       Position within the seat: 0 is the first hand, 1.. are split hands.
   * @param {string} o.owner       A PLAYER value.
   * @param {number} [o.bet]
   */
  constructor({ seat, index = 0, owner = PLAYER.human, bet = 0 }) {
    this.seat = seat;
    this.index = index;
    this.owner = owner;
    this.bet = bet;
    /** Extra wager from doubling (and redoubling). */
    this.doubleBet = 0;
    this.insuranceBet = 0;
    /** Side bets by name, e.g. {main: 5, second: 2}. */
    this.sideBets = {};
    /** Card ids, in the order they were dealt. */
    this.cards = [];
    /** Whether each card is face up. */
    this.faceUp = [];
    /** Whether each card has been counted, so a card seen twice counts once. */
    this.counted = [];
    this.doubled = false;
    this.surrendered = false;
    /** Set when the dealer wrongly called this hand a bust. */
    this.mistakenBust = false;
    this.stood = false;
    this.splitFrom = null;
    /** How many times this seat has split (0 means not split). */
    this.splitCount = 0;
    /** A natural made by switching cards does not count as a blackjack. */
    this.switched = false;
    this.result = null;
    this.payout = 0;
    /** The value this hand busts above: 22 where a player 22 counts as 21. */
    this.bustCeiling = 21;
  }

  /** The hand's own unique key, used by the UI to track it. */
  get key() {
    return `${this.seat}-${this.index}`;
  }

  get values() {
    return this.cards.map(valueOf);
  }

  get cardCount() {
    return this.cards.length;
  }

  /** True while the hand still has no cards. */
  get empty() {
    return this.cards.length === 0;
  }

  get isSplit() {
    return this.splitCount > 0;
  }

  /** Totals, where `bust` is the value a hand busts above (21 normally). */
  totals(bust = this.bustCeiling) {
    const t = handTotals(this.values, bust);
    // A 22 that does not bust counts as 21, as the original did.
    if (bust !== 22) return t;
    return { ...t, total: t.total === 22 ? 21 : t.total, hardTotal: t.hardTotal === 22 ? 21 : t.hardTotal };
  }

  get total() {
    return this.totals().total;
  }

  get hardTotal() {
    return this.totals().hardTotal;
  }

  get soft() {
    return this.totals().soft;
  }

  busted(bust = this.bustCeiling) {
    return this.totals(bust).total > bust;
  }

  /** A two-card 21 on an unsplit hand. */
  isNatural() {
    return this.cardCount === 2 && this.total === 21 && !this.isSplit && !this.switched;
  }

  /** A pair that can be split: equal values (optionally requiring equal ranks). */
  isPair({ sameRankOnly = false } = {}) {
    if (this.cardCount !== 2) return false;
    const [a, b] = this.cards;
    if (valueOf(a) !== valueOf(b)) return false;
    return !sameRankOnly || rankOf(a) === rankOf(b);
  }

  isAcePair() {
    return this.isPair() && valueOf(this.cards[0]) === 1;
  }

  addCard(card, faceUp = true) {
    this.cards.push(card);
    this.faceUp.push(faceUp);
  }

  /** Total amount wagered (the stake already taken from the bankroll). */
  get wagered() {
    return this.bet + this.doubleBet + this.insuranceBet + Object.values(this.sideBets).reduce((a, b) => a + b, 0);
  }

  /** True when both cards are diamonds (for the diamond-blackjack bonus). */
  get isDiamondPair() {
    return this.cardCount === 2 && this.cards.every(c => suitOf(c) === 3);
  }

  /** True for a suited ace-jack (the two cards are the same suit, ace and jack). */
  get isSuitedAceJack() {
    if (this.cardCount !== 2) return false;
    const ranks = this.cards.map(rankOf).sort((a, b) => a - b);
    return ranks[0] === 1 && ranks[1] === 11 && suitOf(this.cards[0]) === suitOf(this.cards[1]);
  }

  /** True for an ace and jack of hearts. */
  get isHeartsAceJack() {
    if (this.cardCount !== 2) return false;
    const hearts = this.cards.filter(c => suitOf(c) === 2).map(rankOf);
    return hearts.includes(1) && hearts.includes(11);
  }
}
