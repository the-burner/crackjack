// @ts-nocheck
// Playing cards. A card id is 1..52: suit * 13 + rank, with rank 1..13
// (ace..king) and suit 0..3.

export const RANKS_PER_SUIT = 13;
export const CARDS_PER_DECK = 52;

export const rankOf = id => ((id - 1) % RANKS_PER_SUIT) + 1;
export const suitOf = id => Math.floor((id - 1) / RANKS_PER_SUIT);
/** Blackjack value 1..10 (ace = 1, tens and faces = 10). */
export const valueOf = id => Math.min(rankOf(id), 10);
export const cardId = (rank, suit) => suit * RANKS_PER_SUIT + rank;

const RANK_NAMES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const rankName = id => RANK_NAMES[rankOf(id) - 1];
/** Name of a card value 1..10 as shown in strategy tables (A, 2..9, T). */
export const valueName = value => (value === 1 ? 'A' : value === 10 ? 'T' : String(value));

/**
 * Totals of a hand of card values (1..10).
 * @returns {{total: number, hardTotal: number, soft: boolean}} `total` counts one ace as 11 when it doesn't bust.
 */
export function handTotals(values, bust = 21) {
  let hardTotal = 0;
  let hasAce = false;
  for (const v of values) {
    hardTotal += v;
    if (v === 1) hasAce = true;
  }
  const soft = hasAce && hardTotal + 10 <= bust;
  return { total: soft ? hardTotal + 10 : hardTotal, hardTotal, soft };
}
