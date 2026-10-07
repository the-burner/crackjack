// What the labels laid over the felt say: one chip label per seat, showing
// what the seat has bet, its result and what it was paid.

import { money } from '@/core/money';
import type { Box } from './layout';
import type { Chip } from './table-state';

/** An absolutely positioned label's style, where the layout says. */
export const boxStyle = (rect: Box) => ({
  left: `${rect.x}px`,
  top: `${rect.y}px`,
  width: `${rect.width}px`,
  height: `${rect.height}px`,
});

/** What a chip label says when it shows no result. */
export const chipText = (held: Chip): string => {
  if (held.result) return ` ${held.result} `;
  if (held.paid !== null) return money(held.paid);
  if (held.amount === 0) return '';
  return money(held.amount) + (held.sideBet > 0 ? `, SB:$${held.sideBet}` : '');
};
