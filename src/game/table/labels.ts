// The labels laid over the felt: one chip label per seat, showing what the
// seat has bet, its result and what it was paid.

import { h } from '@/ui/dom';
import { money } from '@/core/money';
import { RESULT_TONES } from './animator';
import type { Box, SeatLayout } from './layout';
import type { Chip } from './table-state';

/** Puts an absolutely positioned label where the layout says. */
export const placeBox = (node: HTMLElement, rect: Box) =>
  Object.assign(node.style, {
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

/** The seats' chip labels, added to `parent`. */
export function createChipLabels(parent: HTMLElement) {
  const labels = new Map<number, HTMLDivElement>();

  return {
    /** Puts a label at each shown seat. */
    place(seats: readonly SeatLayout[]) {
      for (const [, label] of labels) label.remove();
      labels.clear();
      for (const seat of seats) {
        const label = h('div', { class: 'table__chip', dataset: { seat: String(seat.seat) } });
        placeBox(label, seat.chip);
        labels.set(seat.seat, label);
        parent.append(label);
      }
    },

    /** Shows what each seat holds. */
    update(chips: ReadonlyMap<number, Chip>) {
      for (const [seat, label] of labels) {
        const held = chips.get(seat);
        if (held?.result) {
          // A result is shown as a pill, like the app's other pop-ups.
          const shown = label.firstElementChild;
          if (
            !(shown instanceof HTMLElement) ||
            shown.textContent !== held.result ||
            shown.dataset.tone !== RESULT_TONES[held.result]
          ) {
            label.replaceChildren(
              h(
                'span',
                { class: 'table__result', dataset: { tone: RESULT_TONES[held.result] ?? 'push' } },
                held.result,
              ),
            );
          }
        } else {
          label.textContent = held ? chipText(held) : '';
        }
      }
    },
  };
}
