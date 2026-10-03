// "Dealer points out stupid plays" (`mechanics.dealerPointsOutStupidPlays`):
// before an obviously bad decision goes through, the dealer asks whether the
// player is sure. The question is asked once; pressing again plays the hand.

import { ACTION } from '../engine/game.js';

/**
 * Whether an action is obviously wrong for this hand, whatever the count says.
 * @param {string} action            An ACTION value.
 * @param {{total: number, hardTotal: number}} totals  From hand.totals().
 * @returns {boolean}
 */
export function obviouslyBad(action, { total, hardTotal }) {
  if (action === ACTION.hit) return hardTotal > 16;
  if (action === ACTION.stand) return total < 12;
  if (action === ACTION.double) return hardTotal > 11;
  return false;
}

/** How the dealer asks. */
export const areYouSure = action => `Are you sure that you want to ${action[0].toUpperCase()}${action.slice(1)}?`;
