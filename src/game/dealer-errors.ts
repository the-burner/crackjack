// Dealers make mistakes. With the options under "Dealer Errors" on, the table
// occasionally shorts the player, who is meant to notice and call "Foul".
//
// This module is pure: it decides which mistake a settled round can carry, what
// it costs the player, and what a Foul claim or a missed error is worth. The
// table screen applies the result.
//
// The refund for a caught error and the cost reported for
// a missed one are the same number: exactly what the player was short.

import { money } from '../core/money.ts';
import type { Random } from '../core/random.ts';
import type { AppSettings, SettingKey } from '../settings/schema.ts';
import type { Hand, HandKey } from './engine/hand.ts';
import type { Result } from './engine/settlement.ts';

/** The mistakes a dealer can make. */
export const DEALER_ERROR = {
  insuranceMispaid: 'insuranceMispaid',
  blackjackMispaid: 'blackjackMispaid',
  bustedGoodHand: 'bustedGoodHand',
  shouldHaveBusted: 'shouldHaveBusted',
  winNotPaid: 'winNotPaid',
  chipsOnPush: 'chipsOnPush',
  stoodOn16: 'stoodOn16',
  bonusNotPaid: 'bonusNotPaid',
} as const;
export type DealerErrorType = (typeof DEALER_ERROR)[keyof typeof DEALER_ERROR];

/** What each mistake is called in the messages. */
export const ERROR_LABELS: Record<DealerErrorType, string> = {
  insuranceMispaid: 'Insurance Mispaid',
  blackjackMispaid: 'BJ Mispaid',
  bustedGoodHand: 'Busted a good hand',
  shouldHaveBusted: 'Dealer should have Busted',
  winNotPaid: 'Winning hand not paid',
  chipsOnPush: 'Dealer took chips on a Push',
  stoodOn16: 'Dealer stood on 16',
  bonusNotPaid: 'Bonus not paid',
};

/** The setting that turns each mistake on. */
export const ERROR_SETTINGS = {
  insuranceMispaid: 'dealerErrors.insurancePayoff',
  blackjackMispaid: 'dealerErrors.blackjackPayoff',
  bustedGoodHand: 'dealerErrors.bustOn21OrLess',
  shouldHaveBusted: 'dealerErrors.shouldHaveBusted',
  winNotPaid: 'dealerErrors.noPayOnWin',
  chipsOnPush: 'dealerErrors.loseOnPush',
  stoodOn16: 'dealerErrors.standOn16',
  bonusNotPaid: 'dealerErrors.noBonusPayoff',
} as const satisfies Record<DealerErrorType, SettingKey>;

/** How often each mistake happens when its option is on. */
export const ERROR_CHANCE: Record<DealerErrorType, number> = {
  insuranceMispaid: 0.35,
  blackjackMispaid: 0.385,
  bustedGoodHand: 0.14,
  shouldHaveBusted: 0.525,
  winNotPaid: 0.525,
  chipsOnPush: 0.35,
  stoodOn16: 0.07,
  bonusNotPaid: 0.385,
};

/** A natural the dealer never peeked for, settled at the showdown, is mispaid more often. */
export const UNPEEKED_BLACKJACK_CHANCE = 0.525;

/** How often a mistake happens in this situation. */
function chanceOf(type: DealerErrorType, { dealerPeeked }: { dealerPeeked: boolean }): number {
  if (type === DEALER_ERROR.blackjackMispaid && !dealerPeeked) return UNPEEKED_BLACKJACK_CHANCE;
  return ERROR_CHANCE[type];
}

/** Every mistake this table can make. */
export const SUPPORTED_ERRORS: DealerErrorType[] = [
  DEALER_ERROR.insuranceMispaid,
  DEALER_ERROR.blackjackMispaid,
  DEALER_ERROR.bustedGoodHand,
  DEALER_ERROR.shouldHaveBusted,
  DEALER_ERROR.winNotPaid,
  DEALER_ERROR.chipsOnPush,
  DEALER_ERROR.stoodOn16,
  DEALER_ERROR.bonusNotPaid,
];

/**
 * Whether the dealer stops drawing on this hand by mistake. The caller asks
 * before each draw; a stand on 16, soft or hard, is the mistake players must
 * catch. It only happens on a long dealer hand the player is not already
 * beating, so the stand costs the player something.
 */
export function dealerStandsByMistake({
  dealer,
  playerTotal,
  enabled,
  random,
}: {
  dealer: { total: number; hardTotal: number; cardCount: number };
  /** The total of the last player hand to act. */
  playerTotal: number;
  enabled: readonly DealerErrorType[];
  random: Random;
}): boolean {
  if (!enabled.includes(DEALER_ERROR.stoodOn16)) return false;
  if (dealer.total !== 16 && dealer.hardTotal !== 16) return false;
  if (!(dealer.cardCount >= 4 && playerTotal < 17)) return false;
  return random() < ERROR_CHANCE[DEALER_ERROR.stoodOn16];
}

/** The mistakes the player's options allow, in the order they are considered. */
export function enabledErrors(
  settings: Pick<AppSettings, 'get'>,
  { supported = SUPPORTED_ERRORS }: { supported?: readonly DealerErrorType[] } = {},
): DealerErrorType[] {
  return supported.filter(type => settings.get(ERROR_SETTINGS[type]));
}

/** True when any dealer-error option is on, which is when "Foul" is offered. */
export const dealerErrorsOn = (settings: Pick<AppSettings, 'get'>): boolean =>
  Object.values(ERROR_SETTINGS).some(key => settings.get(key));

export interface ErrorHand {
  key: HandKey;
  /** What the side bets won. */
  sideBetWin: number;
  /** Everything the side bets returned, stakes included, which is in `payout`. */
  sideBetPaid?: number;
  bet: number;
  insuranceBet: number;
  /** What the hand actually paid out. */
  payout: number;
  total: number;
  cardCount: number;
  doubled: boolean;
  isNatural: boolean;
  splitCount: number;
  result: Result | null;
}

/** The dealer's hand as the mistakes judge it. */
export interface ErrorDealer {
  total: number;
  cardCount: number;
  busted: boolean;
  /** Set when the dealer stood on 16 by mistake this round. */
  stoodOnSixteen?: boolean;
}

/** A hand a mistake touched, and what it lost. */
export interface AffectedHand {
  key: HandKey;
  shortfall: number;
  /** What the hand is shown as instead. */
  result: Result | null;
}

/** A mistake the dealer made, waiting to be caught. */
export interface DealerError {
  type: DealerErrorType;
  label: string;
  amount: number;
  hands: AffectedHand[];
  /** True when the hand already paid for it during play. */
  alreadyPaid?: boolean;
}

/** Picks the mistake a settled round carries, if any. At most one per round. */
export function pickDealerError({
  hands,
  dealer,
  dealerBlackjack,
  dealerPeeked = true,
  blackjackBonus = true,
  enabled,
  random,
}: {
  /** The player's settled hands. */
  hands: readonly ErrorHand[];
  dealer: ErrorDealer;
  dealerBlackjack: boolean;
  /** False when the dealer never checked the hole card. */
  dealerPeeked?: boolean;
  /** False when blackjacks pay even money. */
  blackjackBonus?: boolean;
  /** From enabledErrors(). */
  enabled: readonly DealerErrorType[];
  random: Random;
}): DealerError | null {
  for (const type of enabled) {
    const affected = affectedHands(type, { hands, dealer, dealerBlackjack, blackjackBonus });
    const amount = affected.reduce((sum, hand) => sum + hand.shortfall, 0);
    if (affected.length === 0 || amount <= 0) continue;
    // A mistake made during play has already happened; only one made at the
    // payoff is still a matter of chance.
    const madeInPlay = MADE_IN_PLAY.has(type);
    if (!madeInPlay && random() >= chanceOf(type, { dealerPeeked })) continue;
    return { type, label: ERROR_LABELS[type], amount: round2(amount), hands: affected, alreadyPaid: madeInPlay };
  }
  return null;
}

/** Mistakes the dealer makes while playing, whose cost the hand has already paid. */
const MADE_IN_PLAY = new Set<DealerErrorType>([DEALER_ERROR.stoodOn16]);

/**
 * Whether the dealer wrongly calls a good hand a bust, judged as the card lands.
 * A doubled 21 is left alone; a doubled 20 is not.
 */
export function bustsGoodHandByMistake({
  hand,
  enabled,
  random,
}: {
  hand: { total: number; cardCount: number; doubled: boolean };
  enabled: readonly DealerErrorType[];
  random: Random;
}): boolean {
  if (!enabled.includes(DEALER_ERROR.bustedGoodHand)) return false;
  if (hand.cardCount < 3) return false;
  if (random() >= ERROR_CHANCE[DEALER_ERROR.bustedGoodHand]) return false;
  return hand.total === 20 || (hand.total === 21 && !hand.doubled);
}

/**
 * What the dealer owes for a hand it wrongly busted. The original judged this
 * against the dealer's total at that moment, before it had drawn.
 */
export function bustedGoodHandShortfall({
  bet,
  playerTotal,
  dealerTotal,
}: {
  bet: number;
  playerTotal: number;
  dealerTotal: number;
}): number {
  if (dealerTotal < playerTotal) return bet * 2;
  if (dealerTotal === playerTotal) return bet;
  return 0;
}

/** The dealer can claim 21 on 22 with four cards, or on 22 or 23 with five. */
const canClaim21 = (dealer: ErrorDealer): boolean =>
  (dealer.cardCount >= 4 && dealer.total === 22) ||
  (dealer.cardCount >= 5 && (dealer.total === 22 || dealer.total === 23));

/** The hands a mistake of this type would touch, and what each one loses. */
function affectedHands(
  type: DealerErrorType,
  {
    hands,
    dealer,
    dealerBlackjack,
    blackjackBonus,
  }: { hands: readonly ErrorHand[]; dealer: ErrorDealer; dealerBlackjack: boolean; blackjackBonus: boolean },
): AffectedHand[] {
  const plain = (hand: ErrorHand) =>
    hand.cardCount >= 3 && !hand.doubled && hand.insuranceBet === 0 && hand.splitCount <= 1;
  switch (type) {
    // Insurance paid at 1:1 instead of 2:1, on a hand the blackjack beat.
    case DEALER_ERROR.insuranceMispaid:
      if (!dealerBlackjack || !blackjackBonus) return [];
      return hands
        .filter(h => h.insuranceBet > 0 && h.result === 'Lose')
        .map(h => ({ key: h.key, shortfall: h.insuranceBet, result: h.result }));
    // A natural paid at even money instead of the blackjack premium. A side bet
    // the hand also won is in its payout, and is not what the dealer shorted.
    case DEALER_ERROR.blackjackMispaid:
      return hands
        .map(h => ({ hand: h, premium: h.payout - (h.sideBetPaid ?? h.sideBetWin ?? 0) - h.bet * 2 }))
        .filter(({ hand: h, premium }) => h.isNatural && premium > 0)
        .map(({ hand: h, premium }) => ({ key: h.key, shortfall: premium, result: 'Win' }));
    // The dealer busted but counted the hand as 21.
    case DEALER_ERROR.shouldHaveBusted:
      if (!dealer.busted || !canClaim21(dealer)) return [];
      return hands
        .filter(h => h.payout > 0 && !h.isNatural && h.total <= 21)
        .map((h): AffectedHand => ({
          key: h.key,
          // A hand of 21 would push against the claimed 21; anything less loses.
          shortfall: h.total === 21 ? Math.max(0, h.payout - h.bet) : h.payout,
          result: h.total === 21 ? 'Push' : 'Lose',
        }))
        .filter(h => h.shortfall > 0);
    // A hand that won by one point paid as a push.
    case DEALER_ERROR.winNotPaid:
      if (dealer.busted) return [];
      return hands
        .filter(h => plain(h) && h.result === 'Win' && h.total - dealer.total === 1)
        .map(h => ({ key: h.key, shortfall: h.bet, result: 'Push' }));
    // Chips taken on a push.
    case DEALER_ERROR.chipsOnPush:
      return hands
        .filter(h => plain(h) && h.result === 'Push')
        .map(h => ({ key: h.key, shortfall: h.bet, result: 'Lose' }));
    // The dealer stood on 16. The hands that lost to it are the ones the
    // player was cheated of, since a drawing dealer busts more often than not.
    case DEALER_ERROR.stoodOn16:
      if (dealer.stoodOnSixteen !== true) return [];
      return hands
        .filter(h => h.payout === 0 && h.total <= 21 && !h.isNatural)
        .map(h => ({ key: h.key, shortfall: h.bet + (h.doubled ? h.bet : 0), result: 'Lose' }));
    // A winning side bet was not paid.
    case DEALER_ERROR.bonusNotPaid:
      return hands.filter(h => h.sideBetWin > 0).map(h => ({ key: h.key, shortfall: h.sideBetWin, result: h.result }));
    default:
      return [];
  }
}

/** Settles a Foul claim. `pending` is the error from pickDealerError, or null. */
export function claimFoul(pending: DealerError | null): {
  caught: boolean;
  refund: number;
  message: string;
  tone: 'error' | 'good';
} {
  if (!pending) return { caught: false, refund: 0, message: ' No dealer errors ', tone: 'error' };
  return { caught: true, refund: pending.amount, message: ' You caught a dealer error ', tone: 'good' };
}

/** What to say at the start of the next round when the player did not notice. */
export function missedMessage(pending: DealerError): string {
  return `You missed a dealer error, ${pending.label}, costing ${money(pending.amount)}`;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Reads the fields pickDealerError needs off an engine hand and its settlement. */
export function errorHandFrom(
  hand: Hand,
  { sideBetWin = 0, sideBetPaid = 0 }: { sideBetWin?: number; sideBetPaid?: number } = {},
): ErrorHand {
  return {
    key: hand.key,
    sideBetWin,
    /** Everything the side bets returned, stakes included, which is in `payout`. */
    sideBetPaid,
    bet: hand.bet,
    insuranceBet: hand.insuranceBet,
    payout: hand.payout,
    total: hand.total,
    cardCount: hand.cardCount,
    doubled: hand.doubled,
    isNatural: hand.isNatural(),
    splitCount: hand.splitCount,
    result: hand.result,
  };
}
