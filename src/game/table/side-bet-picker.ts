// Choosing the side bets for the next round: the bet picker opens once per
// side-bet spot, since a game may offer two.

import { alert } from '@/components/dialogs';
import { money } from '@/core/money';
import type { BetSelectParams } from '@/game/screens/bet-select';
import type { SideBetSpot } from '@/game/engine/side-bets';

/** Side-bet amounts by spot id. */
export type SideBets = Record<string, number>;

/** How the chosen side bets read in the betting overlay's heading. */
export const sideBetLabel = (sideBets: SideBets): string =>
  Object.entries(sideBets)
    .map(([id, amount]) => `${id} side bet ${money(amount)}`)
    .join(', ');

/**
 * @param open  Shows the picker for spot `index` (replacing the one showing when `replace`).
 * @param chipValue  Read as each picker opens.
 * @param onChange  Runs with the side bets after each pick.
 */
export function createSideBetPicker({
  open,
  chipValue,
  onChange,
}: {
  open: (index: number, replace: boolean) => void;
  chipValue: () => number;
  onChange: (sideBets: SideBets) => void;
}) {
  /** Side-bet amounts chosen for the next round, by spot label. */
  let pending: SideBets = {};
  /** The spots being chosen for. */
  let spots: SideBetSpot[] = [];

  function params(index: number): BetSelectParams | null {
    const spot = spots[index];
    if (!spot) return null;
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
        open(index + 1, true);
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

    /** What the picker for spot `index` shows, or null when there is no such spot. */
    paramsFor: params,

    /** Picks the amount to put on each side-bet spot for the next round. */
    choose(offered: SideBetSpot[]) {
      if (offered.length === 0) {
        alert('The selected game has no side bet.');
        return;
      }
      spots = offered;
      open(0, false);
    },
  };
}
