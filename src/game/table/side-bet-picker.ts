// Choosing the side bets for the next round: the bet picker opens once per
// side-bet spot, since a game may offer two.

import { alert } from '../../ui/dialogs.ts';
import { money } from '../../core/money.ts';
import type { App } from '../../app/app.ts';
import type { SideBetSpot } from '../engine/side-bets.ts';

/** Side-bet amounts by spot id. */
export type SideBets = Record<string, number>;

/** How the chosen side bets read in the betting overlay's heading. */
export const sideBetLabel = (sideBets: SideBets): string =>
  Object.entries(sideBets)
    .map(([id, amount]) => `${id} side bet ${money(amount)}`)
    .join(', ');

/**
 * @param chipValue  Read as each picker opens.
 * @param onChange  Runs with the side bets after each pick.
 */
export function createSideBetPicker({
  app,
  chipValue,
  onChange,
}: {
  app: App;
  chipValue: () => number;
  onChange: (sideBets: SideBets) => void;
}) {
  /** Side-bet amounts chosen for the next round, by spot label. */
  let pending: SideBets = {};

  function params(spots: SideBetSpot[], index: number) {
    const spot = spots[index];
    return {
      mode: 'sideBet',
      title: spots.length > 1 ? `${spot.id} side bet` : undefined,
      chipValue: chipValue(),
      onPick: ({ amount }: { amount: number }): boolean => {
        if (amount > spot.maxAmount) {
          alert(`The maximum ${spot.id} bet is ${money(spot.maxAmount)}.`);
          // Stay on the picker so another amount can be chosen.
          return true;
        }
        pending = { ...pending };
        if (amount > 0) pending[spot.id] = amount;
        else delete pending[spot.id];
        onChange(pending);
        if (!spots[index + 1]) return false;
        // Swap this picker for the next spot's, so Back still lands on the table.
        app.router.replace('game.betSelect', params(spots, index + 1));
        return true;
      },
    };
  }

  return {
    /** The side bets chosen so far. */
    get pending(): SideBets {
      return pending;
    },

    /** Hands over the side bets for the round being dealt, and starts afresh. */
    take(): SideBets {
      const taken = pending;
      pending = {};
      return taken;
    },

    /** Picks the amount to put on each side-bet spot for the next round. */
    choose(spots: SideBetSpot[]) {
      if (spots.length === 0) {
        alert('The selected game has no side bet.');
        return;
      }
      app.open('game.betSelect', params(spots, 0));
    },
  };
}
