// Count drills: cards are flashed one group at a time and the player is asked
// for a count. This module decides how many cards a flash holds, where they go,
// how often a test comes and what the answer is.

import { randomInt } from '../../core/random.js';
import { isAceNeutral } from '../shared/count-answers.js';

/** Card sprites are 150 x 215. */
const CARD_ASPECT = 150 / 215;

/** How many cards one flash may hold, per "Cards" option. */
export const FLASH_SIZES = {
  1: [1], 2: [2], 3: [3], 4: [4], '1-2': [1, 2], '1-3': [1, 2, 3], '1-4': [1, 2, 3, 4],
};

/** The most cards a flash can hold, which fixes the card size and the spacing. */
export const maxFlashSize = option => Math.max(...FLASH_SIZES[option]);

/** How many cards this flash holds. */
export const flashSize = (option, random) => {
  const sizes = FLASH_SIZES[option];
  return sizes[randomInt(sizes.length, random)];
};

/** Cards between tests, per "Test" option. */
const TEST_SPACING = { everyCard: 1, about8: 8, about16: 16, about36: 36 };

/**
 * How many cards to deal before the next test. The spacing varies by half, so
 * the player cannot predict when a test is coming.
 */
export function cardsUntilTest(testEvery, random) {
  if (testEvery === 'never') return Infinity;
  if (testEvery === 'everyCard') return 1;
  return Math.floor(TEST_SPACING[testEvery] * (random() + 0.5));
}

const POSITIONS = ['vertical', 'horizontal', 'diagonal', 'mixed'];

/** Whether this flash is turned on its side. */
export const flashRotated = (orientation, random) =>
  (orientation === 'mixed' ? randomInt(2, random) === 1 : orientation === 'horizontal');

/** How this flash is arranged. */
export const flashLayout = (positions, random) =>
  (positions === 'mixed' ? POSITIONS[randomInt(3, random)] : positions);

/**
 * Where the cards of one flash go.
 *
 * Positions are in the flash's own space: when the flash is rotated, that space
 * is the drawing area turned a quarter turn, so x runs down the screen.
 * @param {object} o
 * @param {string} o.layout     vertical | horizontal | diagonal
 * @param {boolean} o.rotated
 * @param {number} o.cards      Cards in this flash.
 * @param {number} o.maxCards   The most a flash can hold (fixes size and spacing).
 * @param {number} o.width      Drawing area width.
 * @param {number} o.height     Drawing area height.
 * @returns {{cards: {x: number, y: number}[], cardWidth: number, cardHeight: number}}
 */
export function flashPositions({ layout, rotated, cards, maxCards, width, height }) {
  const boxWidth = rotated ? height : width;
  const boxHeight = rotated ? width : height;
  // More cards per flash means smaller cards, so they all fit.
  const cardHeight = Math.floor(boxHeight * 0.82 ** (maxCards - 1));
  const cardWidth = Math.floor(cardHeight * CARD_ASPECT);
  const stepY = maxCards > 1 ? Math.floor((boxHeight - cardHeight) / (maxCards - 1)) : 0;
  const stepX = maxCards > 1 ? Math.floor((boxWidth - cardWidth) / (maxCards - 1)) : 0;
  const centreX = (boxWidth - cardWidth) / 2;
  const centreY = (boxHeight - cardHeight) / 2;
  const places = [];
  for (let i = 0; i < cards; i++) {
    if (layout === 'vertical') places.push({ x: centreX, y: i * stepY });
    else if (layout === 'horizontal') places.push({ x: i * stepX, y: centreY });
    else places.push({ x: maxCards === 1 ? centreX : i * stepX, y: stepY * (maxCards - 1) - i * stepY });
  }
  return { cards: places, cardWidth, cardHeight };
}

export const COUNT_DRILL_LABELS = {
  runningCount: 'Running Count', trueCount: 'True Count', acesLeft: 'Aces Left', acesDealt: 'Aces Dealt',
  aceBetCount: 'Ace Bet Count', acePlayCount: 'Ace Play Count', aceInsureCount: 'Ace Insure Count',
  tenSideCount: 'Ten Side Count',
};

/** Drills that only make sense for one kind of counting system. */
export const ACE_DRILLS = { aceBetCount: 'neutral', acePlayCount: 'reckoned', aceInsureCount: 'reckoned' };

/** Drills that stop once every ace has been dealt. */
export const isAceCountDrill = drill => drill === 'acesLeft' || drill === 'acesDealt';

/**
 * Whether an ace drill suits the counting system: the bet count needs a system
 * that ignores aces, the play and insurance counts one that counts them.
 */
export function aceDrillSuits(drill, strategy) {
  const needs = ACE_DRILLS[drill];
  if (!needs) return true;
  return needs === 'neutral' ? isAceNeutral(strategy) : !isAceNeutral(strategy);
}

/** The value the drill asks for. */
export function countAnswer(drill, counts) {
  switch (drill) {
    case 'trueCount': return counts.trueCount;
    case 'acesLeft': return counts.acesLeft;
    case 'acesDealt': return counts.aces;
    case 'aceBetCount': return counts.betCount;
    case 'acePlayCount': return counts.playCount;
    case 'aceInsureCount': return counts.insureCount;
    case 'tenSideCount': return counts.tens;
    default: return counts.runningCount;
  }
}

/**
 * Half-point systems move the running count by halves, so the grid steps by a
 * half and "within 1" means within half a point.
 */
export const halfSteps = (drill, strategy) => drill === 'runningCount' && Boolean(strategy.halves);

/** The answer as a grid index (two indices per point for half-point systems). */
export const answerIndex = (value, inHalfSteps) => (inHalfSteps ? Math.round(value * 2) : value);
