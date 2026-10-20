// Where Crackjack deliberately plays differently from the recorded original apps: the tests that compare
// against those recordings expect the correction there, and the original everywhere else.

import type { Grid } from '@/core/strategy/strategy-file';

/**
 * High-Low (system 30): the original never surrendered a pair of sevens against a ten, though it surrenders
 * any other hard 14 against a ten from its index. Crackjack's High-Low surrenders the sevens from that index
 * too, wherever its own indices are played (an index set that drops the play leaves basic strategy, as before).
 */
export const HIGH_LOW = 30;
/** The surrender table's cells: a pair of sevens, and any other hard 14, against a ten. */
const SEVENS_V_TEN = [8, 8] as const;
const FOURTEEN_V_TEN = [3, 8] as const;

/** A recorded surrender table, corrected for High-Low played with all its indices: the sevens take the fourteen's value. */
export function correctedSurrender<T>(system: number, allIndices: boolean, table: T[][]): T[][] {
  if (system !== HIGH_LOW || !allIndices) return table;
  const fixed = table.map(row => [...row]);
  fixed[SEVENS_V_TEN[0]][SEVENS_V_TEN[1]] = table[FOURTEEN_V_TEN[0]][FOURTEEN_V_TEN[1]];
  return fixed;
}

/**
 * High-Low's surrender index for a pair of sevens against a ten as built, or null when this is no such decision.
 * Without `hand`, any High-Low hand against a ten: the advisor reports the last surrender cell it read, as the
 * original did, so a hand it does not surrender reads the sevens' index too.
 */
export function sevensIndex(
  system: number,
  hand: { card1: number; card2: number } | null,
  upcard: number,
  surrender: Grid,
): number | null {
  if (system !== HIGH_LOW || upcard !== 10 || (hand && (hand.card1 !== 7 || hand.card2 !== 7))) return null;
  const index = surrender[SEVENS_V_TEN[0]][SEVENS_V_TEN[1]];
  return index >= -99 && index <= 99 ? index : null;
}
