// The bets the betting panel offers: up to a 6 x 3 block, one per bet the
// player's ramp allows.

import { normalizeRamp } from '@/settings/bet-ramp';
import type { Ramp } from '@/settings/bet-ramp';

export const COLUMNS = 6;
export const ROWS = 3;

/** One bet the grid offers. */
export interface BetCell {
  chips: number;
  hands: number;
  amount: number;
  label: string;
}

/**
 * The bets the ramp offers, one per tile. Rows that repeat the row before them
 * collapse into one tile, so a flat ramp shows a single bet.
 * @param ramp  A betting.ramp value.
 */
export function betCells({ ramp, chipValue }: { ramp: Partial<Ramp>; chipValue: number }): BetCell[] {
  const { rows } = normalizeRamp(ramp);
  const cells: BetCell[] = [];
  for (const row of rows) {
    const last = cells[cells.length - 1];
    if (last && last.chips === row.chips && last.hands === row.hands) continue;
    const amount = row.chips * chipValue;
    cells.push({ chips: row.chips, hands: row.hands, amount, label: betLabel(amount, row.hands) });
  }
  return cells.slice(0, COLUMNS * ROWS);
}

/** "25", "2x25" for two hands, "1.5K" for a thousand or more. */
export function betLabel(amount: number, hands = 1): string {
  const text = amount > 999 ? `${amount / 1000}K` : String(amount);
  return hands > 1 ? `${hands}x${text}` : text;
}
