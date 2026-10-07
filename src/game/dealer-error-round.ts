// A dealer error in a round: which one the round carries, how the round's
// events show it, and the error waiting to be called. No DOM and no bankroll:
// the table screen changes the bankroll through the session.

import { valueOf } from '../core/cards.ts';
import type { CardId } from '../core/cards.ts';
import { dealerPeeks } from './engine/rules.ts';
import type { Rules } from './engine/rules.ts';
import type { Hand, HandKey } from './engine/hand.ts';
import type { GameEvent, GameEventOf } from './engine/events.ts';
import {
  pickDealerError,
  errorHandFrom,
  bustedGoodHandShortfall,
  dealerStandsByMistake,
  bustsGoodHandByMistake,
  claimFoul,
  DEALER_ERROR,
  ERROR_LABELS,
} from './dealer-errors.ts';
import type { DealerError, DealerErrorType } from './dealer-errors.ts';

/** True when a blackjack could still be under an ace or ten the dealer never checked. */
export function blackjackUnknown(rules: Rules, upcard: CardId | undefined): boolean {
  if (upcard === undefined) return false;
  const value = valueOf(upcard);
  return (value === 1 || value === 10) && !dealerPeeks(rules, upcard);
}

/** The total the last human hand left behind, which is what the original compared. */
export const lastPlayerTotal = (humanHands: readonly Pick<Hand, 'total'>[]): number =>
  humanHands.length ? humanHands[humanHands.length - 1].total : 0;

const settledOf = (events: readonly GameEvent[], key: HandKey) =>
  events.find((event): event is GameEventOf<'settled'> => event.type === 'settled' && event.hand === key);

/** What a hand's side bets paid, read from its settled event. */
export const sideBetWinOf = (events: readonly GameEvent[], key: HandKey): number =>
  (settledOf(events, key)?.sideBets ?? []).reduce((sum, bet) => sum + Math.max(0, bet.payout - bet.stake), 0);

/** Everything a hand's side bets returned, stakes included. */
export const sideBetPaidOf = (events: readonly GameEvent[], key: HandKey): number =>
  (settledOf(events, key)?.sideBets ?? []).reduce((sum, bet) => sum + bet.payout, 0);

/** Picks the mistake, if any, the dealer makes in a settled round. */
export function pickRoundError({
  events,
  humanHands,
  dealer,
  stoodOnSixteen,
  dealerBlackjack,
  rules,
  enabled,
  random,
}: {
  /** The settled round's events. */
  events: readonly GameEvent[];
  humanHands: readonly Hand[];
  dealer: Hand;
  /** Set when the dealer wrongly stood on a hard 16 this round. */
  stoodOnSixteen: boolean;
  dealerBlackjack: boolean;
  rules: Rules;
  /** From enabledErrors(). */
  enabled: readonly DealerErrorType[];
  random: () => number;
}): DealerError | null {
  const hands = humanHands.map(hand =>
    errorHandFrom(hand, {
      sideBetWin: sideBetWinOf(events, hand.key),
      sideBetPaid: sideBetPaidOf(events, hand.key),
    }),
  );
  return pickDealerError({
    hands,
    dealer: { total: dealer.total, cardCount: dealer.cardCount, busted: dealer.busted(), stoodOnSixteen },
    dealerBlackjack,
    dealerPeeked: !blackjackUnknown(rules, dealer.cards[0]),
    blackjackBonus: rules.blackjackPayout !== '1:1',
    enabled,
    random,
  });
}

/**
 * The round's events as the player sees them with the error in. A mistake made
 * during play has cost the hand already; one made at the payoff is made here:
 * the chips never arrive. `bankroll` is the bankroll once the error is in.
 */
export function withDealerError(events: readonly GameEvent[], error: DealerError, bankroll: number): GameEvent[] {
  return events.map(event => {
    if (event.type === 'roundEnd') return { ...event, bankroll };
    if (event.type !== 'settled' || error.alreadyPaid) return event;
    const affected = error.hands.find(hand => hand.key === event.hand);
    if (!affected) return event;
    return { ...event, result: affected.result ?? event.result, payout: event.payout - affected.shortfall };
  });
}

/** The error when the dealer has wrongly called a good hand a bust. */
export function bustedGoodHandError({
  key,
  bet,
  total,
  dealerTotal,
}: {
  key: HandKey;
  bet: number;
  total: number;
  dealerTotal: number;
}): DealerError {
  // The hand pays nothing, so the bankroll is already short by what it owed.
  const shortfall = bustedGoodHandShortfall({ bet, playerTotal: total, dealerTotal });
  return {
    type: DEALER_ERROR.bustedGoodHand,
    label: ERROR_LABELS[DEALER_ERROR.bustedGoodHand],
    amount: shortfall,
    hands: [{ key, shortfall, result: 'Bust' }],
  };
}

/**
 * The dealer-error state of a table: the error waiting to be called and
 * whether the dealer stood on 16 this round.
 * @param enabled  The mistakes the player's options allow (enabledErrors()), read each time.
 */
export function createDealerErrorRound({
  enabled,
  random = Math.random,
}: {
  enabled: () => readonly DealerErrorType[];
  random?: () => number;
}) {
  /** A dealer mistake the player has not called yet. */
  let pending: DealerError | null = null;
  /** Set when the dealer wrongly stood on a hard 16 this round. */
  let stoodOnSixteen = false;

  return {
    get pending(): DealerError | null {
      return pending;
    },

    /** The engine asks before each dealer draw: false makes the dealer wrongly stand on 16. */
    dealerDraws(dealer: Hand, humanHands: readonly Hand[]): boolean {
      const dealt = { ...dealer.totals(), cardCount: dealer.cardCount };
      const playerTotal = lastPlayerTotal(humanHands);
      if (!dealerStandsByMistake({ dealer: dealt, playerTotal, enabled: enabled(), random })) return true;
      stoodOnSixteen = true;
      return false;
    },

    /** The engine asks as a card lands: true makes the dealer call a good hand a bust. */
    bustsGoodHand(hand: Hand, dealerTotal: number): boolean {
      if (pending) return false;
      const judged = { total: hand.total, cardCount: hand.cardCount, doubled: hand.doubled };
      if (!bustsGoodHandByMistake({ hand: judged, enabled: enabled(), random })) return false;
      pending = bustedGoodHandError({ key: hand.key, bet: hand.bet, total: hand.total, dealerTotal });
      return true;
    },

    /** Lets the dealer make one of the enabled mistakes in a settled round; returns it, if made. */
    settle(
      round: Omit<Parameters<typeof pickRoundError>[0], 'stoodOnSixteen' | 'enabled' | 'random'>,
    ): DealerError | null {
      const allowed = enabled();
      if (allowed.length === 0 || pending) return null;
      pending = pickRoundError({ ...round, stoodOnSixteen, enabled: allowed, random });
      return pending;
    },

    /** Settles a Foul claim; a caught error is no longer pending. */
    claim() {
      const result = claimFoul(pending);
      if (result.caught) pending = null;
      return result;
    },

    /** At the next bet: the error the player let go, if any, which is then forgotten. */
    takeMissed(): DealerError | null {
      stoodOnSixteen = false;
      const missed = pending;
      pending = null;
      return missed;
    },
  };
}
