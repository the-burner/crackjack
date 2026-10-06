// Full table drills: a whole table of hands is dealt at once and the player is
// asked for a count. This module owns the table layout and the dealing rules.

import { valueOf } from '../../core/cards.js';

/** Card sprites are 150 x 215. */
const CARD_ASPECT = 150 / 215;

/** The seven hand spots: 0 top right, 1..4 along the bottom arc, 5 top left, 6 the dealer. */
export const DEALER_SPOT = 6;
const SPOTS_PER_PLAYER_COUNT = { 6: [0, 1, 2, 3, 4, 5], 4: [1, 2, 3, 4], 2: [2, 3] };
export const SLOTS_PER_SPOT = 4;
/** Loose cards in the "Scattered Cards" layout. */
export const SCATTER_CARDS = 15;

export const FULL_DRILL_LABELS = {
  runningCount: 'Running Count', acesLeft: 'Aces Left', acesDealt: 'Aces Dealt',
  tenSideCount: 'Ten Side Count', twoTables: 'Two Tables',
};

/** The spots in dealing order, the dealer last. */
export const spotsFor = players => [...SPOTS_PER_PLAYER_COUNT[players], DEALER_SPOT];

/**
 * Where each hand's cards go on a table `width` x `height`.
 * @returns {{spots: {x: number, y: number}[][], cardWidth: number, cardHeight: number}}
 */
export function tableSlots(width, height) {
  const cardHeight = Math.floor(height * 0.35);
  const cardWidth = Math.floor(cardHeight * CARD_ASPECT);
  const step = Math.floor(cardHeight * 0.22);
  const run = (x, y, dx, dy) => Array.from({ length: SLOTS_PER_SPOT },
    (_, i) => ({ x: Math.floor(x + i * dx), y: Math.floor(y + i * dy) }));
  const spots = [];
  spots[0] = run(width - cardWidth - 2, 2, -step * 1.3, 0);
  // The four bottom seats, right to left; the outer two sit a little higher.
  [4.3, 2.9, 1.5, 0.17].forEach((across, seat) => {
    const raised = seat === 0 || seat === 3;
    spots[seat + 1] = run(
      ((width - cardWidth) / 5) * across,
      height - cardHeight - (raised ? 2 + cardHeight / 6 : 0),
      step, -step,
    );
  });
  spots[5] = run(2, 2, step * 1.3, 0);
  spots[DEALER_SPOT] = run((width - cardWidth * 1.8) / 2, 2, step * 1.3, 0);
  return { spots, cardWidth, cardHeight };
}

/**
 * Positions for the loose cards of the scattered layout: random, but not on top
 * of each other.
 */
export function scatterSlots(width, height, random) {
  const cardHeight = Math.floor(height * 0.34);
  const cardWidth = Math.floor(cardHeight * CARD_ASPECT);
  const apart = cardHeight / 2;
  const places = [];
  for (let i = 0; i < SCATTER_CARDS; i++) {
    let place;
    for (let tries = 0; tries < 150; tries++) {
      place = { x: random() * (width - cardHeight), y: random() * (height - cardHeight) };
      if (!places.some(p => Math.abs(p.x - place.x) < apart && Math.abs(p.y - place.y) < apart)) break;
    }
    places.push({ x: Math.floor(place.x), y: Math.floor(place.y) });
  }
  return { places, cardWidth, cardHeight };
}

/** A hand stops on a soft 17 to 21, or on a hard total over the spot's limit. */
export function handComplete(cards, { spot, dealerStopsAt16 = false } = {}) {
  const hard = cards.reduce((sum, id) => sum + valueOf(id), 0);
  const aces = cards.filter(id => valueOf(id) === 1).length;
  if (hard + 10 * aces > 16 && hard + 10 * aces < 22) return true;
  return hard > (dealerStopsAt16 && spot === DEALER_SPOT ? 16 : 14);
}

/**
 * Deals one round of hands.
 * @param {object} o
 * @param {number} o.players
 * @param {string} o.handStyle  twoToFourCards | firstTwoCards | scattered
 * @param {boolean} [o.dealerStopsAt16]
 * @param {() => *} o.draw      Returns the next card, or null to stop dealing.
 * @returns {{hands: {spot: number, cards: *[]}[], stopped: boolean}}
 */
export function dealRound({ players, handStyle, dealerStopsAt16 = false, draw }) {
  // "Scattered Cards" shows loose cards instead of hands, so none are dealt.
  if (handStyle === 'scattered') return { hands: [], stopped: false };
  const hands = [];
  for (const spot of spotsFor(players)) {
    const cards = [];
    // "First Two Cards" shows the opening deal: two each, one for the dealer.
    const limit = handStyle === 'firstTwoCards' ? (spot === DEALER_SPOT ? 1 : 2) : SLOTS_PER_SPOT;
    for (let i = 0; i < limit; i++) {
      const card = draw();
      if (card === null) {
        hands.push({ spot, cards });
        return { hands, stopped: true };
      }
      cards.push(card);
      if (handStyle === 'twoToFourCards' && handComplete(cards, { spot, dealerStopsAt16 })) break;
    }
    hands.push({ spot, cards });
  }
  return { hands, stopped: false };
}

/** The value the drill asks for. */
export function fullAnswer(drill, counts) {
  switch (drill) {
    case 'acesLeft': return counts.acesLeft;
    case 'acesDealt': return counts.aces;
    case 'tenSideCount': return counts.tens;
    default: return counts.runningCount;
  }
}

/** Drills that stop once every ace has been dealt. */
export const isAceCountDrill = drill => drill === 'acesLeft' || drill === 'acesDealt';

/** The count a question asks for: Two Tables and the first of two counts ask the running count. */
export const fullQuestionDrill = (drill, askingRunningCount) =>
  (drill === 'twoTables' || askingRunningCount ? 'runningCount' : drill);

/** Two Counts adds the running count, which the Running Count drill already asks for. */
export const asksTwoCounts = (drill, twoCounts) =>
  twoCounts && drill !== 'runningCount' && drill !== 'twoTables';

/**
 * Which cards of a round are shown in a Two Tables partial view: the first two
 * cards of every hand, every card of the first `fullyShownUpTo` spots, and only
 * the dealer's first card.
 * @returns {boolean[][]} one flag per card of each hand, in `hands` order
 */
export function partialView(hands, fullyShownUpTo) {
  return hands.map(({ spot, cards }) => cards.map((_, i) => {
    if (spot === DEALER_SPOT) return i === 0;
    return i < 2 || spot <= fullyShownUpTo;
  }));
}

/**
 * The spot limit for a partial view: the first seat in play, so that seat's whole
 * hand shows, or -1 for none of them. (A spot number only suits the seats dealt.)
 */
export function fullyShownLimit(hands, random) {
  if (random() < 0.5) return -1;
  const seat = hands.find(hand => hand.spot !== DEALER_SPOT);
  return seat ? seat.spot : -1;
}

/** The four questions of the Two Tables cycle: which table, and how much of it. */
export const TWO_TABLE_PHASES = [
  { table: 0, partial: true }, { table: 1, partial: true },
  { table: 0, partial: false }, { table: 1, partial: false },
];

/** The question after this one; after the last comes the first of a fresh pair of tables. */
export const nextTwoTablePhase = phase => (phase + 1) % TWO_TABLE_PHASES.length;

/** Cards left in a shoe below which a Two Tables cycle cannot be dealt. */
export const TWO_TABLE_MINIMUM_CARDS = 20;
