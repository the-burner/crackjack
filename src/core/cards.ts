// Playing cards. A card id is 1..52: suit * 13 + rank, with rank 1..13
// (ace..king) and suit 0..3.

/** A card id, 1..52. */
export type CardId = number;

export const RANKS_PER_SUIT = 13;
export const CARDS_PER_DECK = 52;

export const rankOf = (id: CardId): number => ((id - 1) % RANKS_PER_SUIT) + 1;
export const suitOf = (id: CardId): number => Math.floor((id - 1) / RANKS_PER_SUIT);
/** Blackjack value 1..10 (ace = 1, tens and faces = 10). */
export const valueOf = (id: CardId): number => Math.min(rankOf(id), 10);
export const cardId = (rank: number, suit: number): CardId => suit * RANKS_PER_SUIT + rank;

const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const rankName = (id: CardId): string => RANK_NAMES[rankOf(id) - 1];
/** Name of a card value 1..10 as shown in strategy tables (A, 2..9, T). */
export const valueName = (value: number): string => (value === 1 ? 'A' : value === 10 ? 'T' : String(value));

/** Totals of a hand; `total` counts one ace as 11 when it doesn't bust. */
export interface HandTotals {
  total: number;
  hardTotal: number;
  soft: boolean;
}

/** Totals of a hand of card values (1..10). */
export function handTotals(values: readonly number[], bust = 21): HandTotals {
  let hardTotal = 0;
  let hasAce = false;
  for (const v of values) {
    hardTotal += v;
    if (v === 1) hasAce = true;
  }
  const soft = hasAce && hardTotal + 10 <= bust;
  return { total: soft ? hardTotal + 10 : hardTotal, hardTotal, soft };
}
