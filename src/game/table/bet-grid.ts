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

/** Where an option of the betting panel sits: its row, and the grid columns it spans. */
export interface Slot {
  row: number;
  start: number;
  width: number;
}

/** The buttons under the bets, in the panel's order; Foul only when a dealer error can be claimed. */
export const OVERLAY_BUTTONS = ['wong', 'resetBank', 'shuffle', 'sideBet', 'customize', 'foul'] as const;
export type OverlayButtonName = (typeof OVERLAY_BUTTONS)[number];
export const overlayButtons = (foul: boolean): OverlayButtonName[] =>
  OVERLAY_BUTTONS.filter(name => name !== 'foul' || foul);

/** Buttons a row below the bets, each two bet columns wide. */
const BUTTONS_PER_ROW = 3;

/** The panel's options in order, bets then buttons, laid out as the panel shows them. */
export function overlaySlots(bets: number, buttons: number): Slot[] {
  const slots: Slot[] = Array.from({ length: bets }, (_, i) => ({
    row: Math.floor(i / COLUMNS),
    start: i % COLUMNS,
    width: 1,
  }));
  const firstRow = Math.ceil(bets / COLUMNS);
  const width = COLUMNS / BUTTONS_PER_ROW;
  for (let i = 0; i < buttons; i++) {
    const inRow = Math.min(BUTTONS_PER_ROW, buttons - (i - (i % BUTTONS_PER_ROW)));
    // A short row is centred.
    const offset = (COLUMNS - inRow * width) / 2;
    slots.push({
      row: firstRow + Math.floor(i / BUTTONS_PER_ROW),
      start: offset + (i % BUTTONS_PER_ROW) * width,
      width,
    });
  }
  return slots;
}

/** The option the highlight moves to from `selected`: along the order, or to the nearest one a row up or down. */
export function moveHighlight(
  selected: number,
  slots: readonly Slot[],
  direction: 'left' | 'right' | 'up' | 'down',
): number {
  const count = slots.length;
  if (direction === 'left' || direction === 'right')
    return (selected + (direction === 'right' ? 1 : -1) + count) % count;
  const rows = slots[count - 1].row + 1;
  const from = slots[selected];
  const row = (from.row + (direction === 'down' ? 1 : -1) + rows) % rows;
  const centre = (slot: Slot) => slot.start + slot.width / 2;
  let best = selected;
  slots.forEach((slot, i) => {
    if (slot.row !== row || row === from.row) return;
    if (best === selected || Math.abs(centre(slot) - centre(from)) < Math.abs(centre(slots[best]) - centre(from)))
      best = i;
  });
  return best;
}

/** What the player picked last round: a bet, by its label, or Wong; null before the first. */
export type LastPick = { bet: string } | 'wong' | null;

/** Where the highlight starts a round of betting: on the last pick, or the lowest bet before there is one. */
export function startingHighlight(cells: readonly BetCell[], foul: boolean, last: LastPick): number {
  if (last === 'wong') return cells.length + overlayButtons(foul).indexOf('wong');
  return Math.max(0, last ? cells.findIndex(cell => cell.label === last.bet) : 0);
}
