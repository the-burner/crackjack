// Count drills: cards are flashed one group at a time and the player is asked
// for a count. This module decides how many cards a flash holds, where they go,
// how often a test comes and what the answer is.

import { randomInt } from '@/core/random';
import type { Random } from '@/core/random';
import type { Strategy } from '@/core/strategy/strategy-tables';
import { CARD_ASPECT } from '@/ui/card-sprites';
import { isAceNeutral } from '@/drills/shared/count-answers';
import type { DrillCounts } from '@/drills/shared/count-answers';

export { isAceCountDrill } from '@/drills/shared/count-answers';

/** The "Cards" option: how many cards a flash holds. */
export type FlashSizeOption = '1' | '2' | '3' | '4' | '1-2' | '1-3' | '1-4';
export type TestEvery = 'everyCard' | 'about8' | 'about16' | 'about36' | 'never';
export type FlashLayout = 'vertical' | 'horizontal' | 'diagonal';
export type CountDrill =
  | 'runningCount'
  | 'trueCount'
  | 'acesLeft'
  | 'acesDealt'
  | 'aceBetCount'
  | 'acePlayCount'
  | 'aceInsureCount'
  | 'tenSideCount';

/** How many cards one flash may hold, per "Cards" option. */
export const FLASH_SIZES: Readonly<Record<FlashSizeOption, readonly number[]>> = {
  1: [1],
  2: [2],
  3: [3],
  4: [4],
  '1-2': [1, 2],
  '1-3': [1, 2, 3],
  '1-4': [1, 2, 3, 4],
};

/** The most cards a flash can hold, which fixes the card size and the spacing. */
export const maxFlashSize = (option: FlashSizeOption): number => Math.max(...FLASH_SIZES[option]);

/** How many cards this flash holds. */
export const flashSize = (option: FlashSizeOption, random: Random): number => {
  const sizes = FLASH_SIZES[option];
  return sizes[randomInt(sizes.length, random)];
};

/** Cards between tests, per "Test" option. */
const TEST_SPACING: Readonly<Record<Exclude<TestEvery, 'never'>, number>> = {
  everyCard: 1,
  about8: 8,
  about16: 16,
  about36: 36,
};

/**
 * How many cards to deal before the next test. The spacing varies by half, so
 * the player cannot predict when a test is coming.
 */
export function cardsUntilTest(testEvery: TestEvery, random: Random): number {
  if (testEvery === 'never') return Infinity;
  if (testEvery === 'everyCard') return 1;
  return Math.floor(TEST_SPACING[testEvery] * (random() + 0.5));
}

const LAYOUTS: readonly FlashLayout[] = ['vertical', 'horizontal', 'diagonal'];

/** Whether this flash is turned on its side. */
export const flashRotated = (orientation: 'vertical' | 'horizontal' | 'mixed', random: Random): boolean =>
  orientation === 'mixed' ? randomInt(2, random) === 1 : orientation === 'horizontal';

/** How this flash is arranged. */
export const flashLayout = (positions: FlashLayout | 'mixed', random: Random): FlashLayout =>
  positions === 'mixed' ? LAYOUTS[randomInt(3, random)] : positions;

/**
 * Where the cards of one flash go.
 *
 * Positions are in the flash's own space: when the flash is rotated, that space
 * is the drawing area turned a quarter turn, so x runs down the screen.
 */
export function flashPositions({
  layout,
  rotated,
  cards,
  maxCards,
  width,
  height,
}: {
  layout: string;
  rotated: boolean;
  /** Cards in this flash. */
  cards: number;
  /** The most a flash can hold (fixes size and spacing). */
  maxCards: number;
  /** Drawing area width. */
  width: number;
  /** Drawing area height. */
  height: number;
}): { cards: { x: number; y: number }[]; cardWidth: number; cardHeight: number } {
  const boxWidth = rotated ? height : width;
  const boxHeight = rotated ? width : height;
  // More cards per flash means smaller cards, so they all fit.
  const cardHeight = Math.floor(boxHeight * 0.82 ** (maxCards - 1));
  const cardWidth = Math.floor(cardHeight * CARD_ASPECT);
  const stepY = maxCards > 1 ? Math.floor((boxHeight - cardHeight) / (maxCards - 1)) : 0;
  const stepX = maxCards > 1 ? Math.floor((boxWidth - cardWidth) / (maxCards - 1)) : 0;
  const centreX = (boxWidth - cardWidth) / 2;
  const centreY = (boxHeight - cardHeight) / 2;
  const places: { x: number; y: number }[] = [];
  for (let i = 0; i < cards; i++) {
    if (layout === 'vertical') places.push({ x: centreX, y: i * stepY });
    else if (layout === 'horizontal') places.push({ x: maxCards === 1 ? centreX : i * stepX, y: centreY });
    else places.push({ x: maxCards === 1 ? centreX : i * stepX, y: stepY * (maxCards - 1) - i * stepY });
  }
  return { cards: places, cardWidth, cardHeight };
}

export const COUNT_DRILL_LABELS: Readonly<Record<CountDrill, string>> = {
  runningCount: 'Running Count',
  trueCount: 'True Count',
  acesLeft: 'Aces Left',
  acesDealt: 'Aces Dealt',
  aceBetCount: 'Ace Bet Count',
  acePlayCount: 'Ace Play Count',
  aceInsureCount: 'Ace Insure Count',
  tenSideCount: 'Ten Side Count',
};

/** Drills that only make sense for one kind of counting system. */
export const ACE_DRILLS: Readonly<Partial<Record<string, 'neutral' | 'reckoned'>>> = {
  aceBetCount: 'neutral',
  acePlayCount: 'reckoned',
  aceInsureCount: 'reckoned',
};

/**
 * Whether an ace drill suits the counting system: the bet count needs a system
 * that ignores aces, the play and insurance counts one that counts them.
 */
export function aceDrillSuits(drill: string, strategy: Pick<Strategy, 'countValues'>): boolean {
  const needs = ACE_DRILLS[drill];
  if (!needs) return true;
  return needs === 'neutral' ? isAceNeutral(strategy) : !isAceNeutral(strategy);
}

/** The value the drill asks for. */
export function countAnswer(drill: string, counts: DrillCounts): number {
  switch (drill) {
    case 'trueCount':
      return counts.trueCount;
    case 'acesLeft':
      return counts.acesLeft;
    case 'acesDealt':
      return counts.aces;
    case 'aceBetCount':
      return counts.betCount;
    case 'acePlayCount':
      return counts.playCount;
    case 'aceInsureCount':
      return counts.insureCount;
    case 'tenSideCount':
      return counts.tens;
    default:
      return counts.runningCount;
  }
}

/**
 * Half-point systems move the running count by halves, so the grid steps by a
 * half and "within 1" means within half a point.
 */
export const halfSteps = (drill: string, strategy: Pick<Strategy, 'halves'>): boolean =>
  drill === 'runningCount' && Boolean(strategy.halves);

/** The answer as a grid index (two indices per point for half-point systems). */
export const answerIndex = (value: number, inHalfSteps: boolean): number =>
  inHalfSteps ? Math.round(value * 2) : value;
