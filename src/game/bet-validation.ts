// Whether a bet may be placed: the table limits, the bankroll and the side-bet
// multiple. Pure, so the table screen only shows the message.

import { money } from '../core/money.ts';
import { checkAffordable } from './engine/game.ts';
import type { SideBetSpot } from './engine/side-bets.ts';

export interface BetCheck {
  /** Bet on each hand. */
  amount: number;
  /** Hands actually bet (no more than the player's seats). */
  hands: number;
  /** The table's minimum and maximum bet. */
  limits: readonly number[];
  bankroll: number;
  /** Side-bet amounts for the round, by spot id. */
  sideBets: Record<string, number>;
  spots: readonly Pick<SideBetSpot, 'id' | 'maxMultipleOfBet'>[];
}

/** Why the bet cannot be placed, or null when it can. */
export function betError({ amount, hands, limits: [low, high], bankroll, sideBets, spots }: BetCheck): string | null {
  if (amount < low) return `Bet below the table minimum of ${money(low)}.`;
  if (amount > high) return `Bet above the table maximum of ${money(high)}.`;
  if (!checkAffordable({ bankroll, betPerHand: amount, hands, sideBets }))
    return 'Not enough in the bankroll for that bet.';
  const overTheMultiple = sideBetOverTheMultiple(amount, sideBets, spots);
  if (overTheMultiple) return `Side bet cannot be greater than ${overTheMultiple} times the main bet.`;
  return null;
}

/** The limit a pending side bet breaks against this main bet, if any. */
export function sideBetOverTheMultiple(
  betPerHand: number,
  sideBets: Record<string, number>,
  spots: BetCheck['spots'],
): number {
  for (const spot of spots) {
    const staked = sideBets[spot.id] ?? 0;
    if (staked > betPerHand * spot.maxMultipleOfBet) return spot.maxMultipleOfBet;
  }
  return 0;
}
