// The count as the player has seen it. The session's count is already final
// when the first card is drawn, so the table's readout follows this one
// instead: it counts each card the moment the replay shows it face up, as the
// original did.

import { Counter } from '@/core/counting';
import type { CounterSettings } from '@/core/counting';
import type { Strategy } from '@/core/strategy/strategy-tables';
import type { TableEvent } from './table-state';

export function createShownCount({
  strategy,
  settings,
  decks,
}: {
  strategy: Strategy;
  settings: CounterSettings;
  decks: number;
}) {
  const counter = new Counter(strategy, settings);
  counter.reset(decks);
  /** Cards already counted, so a flashed hole card counts once. */
  const counted = new Set<string>();

  return {
    get running(): number {
      return counter.running;
    },

    get trueCount(): number {
      return counter.trueCount;
    },

    /** Counts what an event shows; `dealt` is the cards drawn from the shoe so far. */
    see(event: TableEvent, dealt: number) {
      if (event.type === 'shuffle' || event.type === 'clear') {
        if (event.type === 'shuffle') counter.reset(decks);
        counted.clear();
        return;
      }
      // A split moves the second card to a new hand; its counted mark moves with it.
      if (event.type === 'split') {
        if (counted.delete(`${event.hand}:1`)) counted.add(`${event.newHand}:0`);
        return;
      }
      if (event.type !== 'card' && event.type !== 'burn' && event.type !== 'reveal' && event.type !== 'peek') return;
      const faceUp = event.type === 'reveal' || event.type === 'peek' || event.faceUp;
      if (!faceUp) return;
      // A hole card that flashed is turned over again later; count it once.
      if (event.type !== 'burn') {
        const seen = `${event.hand}:${event.cardIndex}`;
        if (counted.has(seen)) return;
        counted.add(seen);
      }
      counter.addCard(event.card, dealt);
    },
  };
}
