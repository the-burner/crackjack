// What the engine reports as a round plays out; the table animates these.

import type { CardId } from '@/core/cards';
import type { GameAction } from './game';
import type { HandKey, Player } from './hand';
import type { Result } from './settlement';

/** A side bet (or main-bet bonus) as settled. */
export interface SideBetDetail {
  name: string;
  stake: number;
  payout: number;
  /** -1 when the side bet lost. */
  multiplier: number;
  label: string;
}

/** Text the dealer announces. */
export type MessageText = 'Blackjack' | 'Dealer has Blackjack' | Result;

export type GameEvent =
  | { type: 'shuffle' }
  | { type: 'burn'; card: CardId; faceUp: boolean }
  | { type: 'roundStart'; round: number }
  | { type: 'card'; hand: HandKey; card: CardId; faceUp: boolean; cardIndex: number }
  | { type: 'reveal'; hand: HandKey; cardIndex: number; card: CardId }
  /** The hole card flashes face up, then is concealed again. */
  | { type: 'peek'; hand: HandKey; cardIndex: number; card: CardId }
  | { type: 'conceal'; hand: HandKey; cardIndex: number }
  | { type: 'dealt'; upcard: CardId }
  | { type: 'offerInsurance' }
  | { type: 'insuranceTaken' }
  | { type: 'insuranceDeclined' }
  | { type: 'insuranceLost' }
  /** `hand` is absent for the dealer's own announcements. */
  | { type: 'message'; text: MessageText; hand?: HandKey }
  | { type: 'turn'; hand: HandKey }
  | { type: 'action'; hand: HandKey; action: GameAction }
  | { type: 'double'; hand: HandKey; amount: number }
  | { type: 'split'; hand: HandKey; newHand: HandKey; card: CardId }
  | { type: 'dealerTurn' }
  | {
      type: 'settled';
      hand: HandKey;
      result: Result;
      payout: number;
      net: number;
      seat: number;
      owner: Player;
      sideBets: SideBetDetail[];
    }
  | { type: 'roundEnd'; bankroll: number; needsShuffle: boolean }
  | { type: 'clear' };

export type GameEventType = GameEvent['type'];

/** The event of one type. */
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;
