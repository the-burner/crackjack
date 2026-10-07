// A single hand at the table.

import { handTotals, valueOf, rankOf, suitOf } from '@/core/cards';
import type { CardId, HandTotals } from '@/core/cards';
import type { Result } from './settlement';

/** Who is playing a hand. */
export const PLAYER = { human: 'human', computer: 'computer' } as const;
export type Player = (typeof PLAYER)[keyof typeof PLAYER];

/** A hand's key: `${seat}-${index}`. */
export type HandKey = `${number}-${number}`;

export const handKey = (seat: number, index: number): HandKey => `${seat}-${index}`;

/** The seat and index a hand key names. */
export function parseHandKey(key: HandKey): { seat: number; index: number } {
  const [seat, index] = key.split('-').map(Number);
  return { seat, index };
}

export interface HandOptions {
  /** Seat number 1..6 (0 is the dealer). */
  seat: number;
  /** Position within the seat: 0 is the first hand, 1.. are split hands. */
  index?: number;
  owner?: Player;
  bet?: number;
}

export class Hand {
  seat: number;
  index: number;
  owner: Player;
  bet: number;
  /** Extra wager from doubling (and redoubling). */
  doubleBet = 0;
  insuranceBet = 0;
  /** Side bets by name, e.g. {main: 5, second: 2}. */
  sideBets: Record<string, number> = {};
  /** Card ids, in the order they were dealt. */
  cards: CardId[] = [];
  /** Whether each card is face up. */
  faceUp: boolean[] = [];
  /** Whether each card has been counted, so a card seen twice counts once. */
  counted: boolean[] = [];
  doubled = false;
  surrendered = false;
  /** Set when the dealer wrongly called this hand a bust. */
  mistakenBust = false;
  stood = false;
  splitFrom: HandKey | null = null;
  /** How many times this seat has split (0 means not split). */
  splitCount = 0;
  /** A natural made by switching cards does not count as a blackjack. */
  switched = false;
  result: Result | null = null;
  payout = 0;
  /** The value this hand busts above: 22 where a player 22 counts as 21. */
  bustCeiling = 21;

  constructor({ seat, index = 0, owner = PLAYER.human, bet = 0 }: HandOptions) {
    this.seat = seat;
    this.index = index;
    this.owner = owner;
    this.bet = bet;
  }

  /** The hand's own unique key, used by the UI to track it. */
  get key(): HandKey {
    return handKey(this.seat, this.index);
  }

  get values(): number[] {
    return this.cards.map(valueOf);
  }

  get cardCount(): number {
    return this.cards.length;
  }

  /** True while the hand still has no cards. */
  get empty(): boolean {
    return this.cards.length === 0;
  }

  get isSplit(): boolean {
    return this.splitCount > 0;
  }

  /** Totals, where `bust` is the value a hand busts above (21 normally). */
  totals(bust = this.bustCeiling): HandTotals {
    const t = handTotals(this.values, bust);
    // A 22 that does not bust counts as 21, as the original did.
    if (bust !== 22) return t;
    return { ...t, total: t.total === 22 ? 21 : t.total, hardTotal: t.hardTotal === 22 ? 21 : t.hardTotal };
  }

  get total(): number {
    return this.totals().total;
  }

  get hardTotal(): number {
    return this.totals().hardTotal;
  }

  get soft(): boolean {
    return this.totals().soft;
  }

  busted(bust = this.bustCeiling): boolean {
    return this.totals(bust).total > bust;
  }

  /** A two-card 21 on an unsplit hand. */
  isNatural(): boolean {
    return this.cardCount === 2 && this.total === 21 && !this.isSplit && !this.switched;
  }

  /** A pair that can be split: equal values (optionally requiring equal ranks). */
  isPair({ sameRankOnly = false }: { sameRankOnly?: boolean } = {}): boolean {
    if (this.cardCount !== 2) return false;
    const [a, b] = this.cards;
    if (valueOf(a) !== valueOf(b)) return false;
    return !sameRankOnly || rankOf(a) === rankOf(b);
  }

  isAcePair(): boolean {
    return this.isPair() && valueOf(this.cards[0]) === 1;
  }

  addCard(card: CardId, faceUp = true): void {
    this.cards.push(card);
    this.faceUp.push(faceUp);
  }

  /** Total amount wagered (the stake already taken from the bankroll). */
  get wagered(): number {
    return this.bet + this.doubleBet + this.insuranceBet + Object.values(this.sideBets).reduce((a, b) => a + b, 0);
  }

  /** True when both cards are diamonds (for the diamond-blackjack bonus). */
  get isDiamondPair(): boolean {
    return this.cardCount === 2 && this.cards.every(c => suitOf(c) === 3);
  }

  /** True for a suited ace-jack (the two cards are the same suit, ace and jack). */
  get isSuitedAceJack(): boolean {
    if (this.cardCount !== 2) return false;
    const ranks = this.cards.map(rankOf).sort((a, b) => a - b);
    return ranks[0] === 1 && ranks[1] === 11 && suitOf(this.cards[0]) === suitOf(this.cards[1]);
  }

  /** True for an ace and jack of hearts. */
  get isHeartsAceJack(): boolean {
    if (this.cardCount !== 2) return false;
    const hearts = this.cards.filter(c => suitOf(c) === 2).map(rankOf);
    return hearts.includes(1) && hearts.includes(11);
  }
}
