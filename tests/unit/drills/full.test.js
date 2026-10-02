import { describe, it, expect } from 'vitest';
import {
  tableSlots, scatterSlots, dealRound, handComplete, fullAnswer, partialView, spotsFor,
  isAceCountDrill, DEALER_SPOT, SCATTER_CARDS, SLOTS_PER_SPOT, TWO_TABLE_PHASES,
} from '../../../src/drills/full/logic.js';
import { cardId } from '../../../src/core/cards.js';
import { seededRandom } from '../../../src/core/random.js';

/** A card of the given blackjack value, in spades. */
const card = value => cardId(value, 0);
const cards = values => values.map(card);

describe('table slots', () => {
  const { spots, cardWidth, cardHeight } = tableSlots(1000, 500);

  it('sizes the cards from the table height', () => {
    expect(cardHeight).toBe(175);
    expect(cardWidth).toBe(Math.floor(175 * 150 / 215));
  });

  it('has seven spots of four slots', () => {
    expect(spots).toHaveLength(7);
    for (const spot of spots) expect(spot).toHaveLength(SLOTS_PER_SPOT);
  });

  it('puts spot 0 at the top right, spot 5 at the top left and the dealer at the top centre', () => {
    expect(spots[0][0].y).toBe(2);
    expect(spots[0][0].x).toBe(1000 - cardWidth - 2);
    expect(spots[0][1].x).toBeLessThan(spots[0][0].x);
    expect(spots[5][0]).toEqual({ x: 2, y: 2 });
    expect(spots[5][1].x).toBeGreaterThan(spots[5][0].x);
    expect(spots[DEALER_SPOT][0].y).toBe(2);
    expect(spots[DEALER_SPOT][0].x).toBeGreaterThan(spots[5][3].x);
  });

  it('runs the four seats along the bottom from right to left, the outer two raised', () => {
    const bottom = [1, 2, 3, 4].map(i => spots[i][0]);
    expect(bottom[0].x).toBeGreaterThan(bottom[1].x);
    expect(bottom[1].x).toBeGreaterThan(bottom[2].x);
    expect(bottom[2].x).toBeGreaterThan(bottom[3].x);
    expect(bottom[1].y).toBe(500 - cardHeight);
    expect(bottom[0].y).toBeLessThan(bottom[1].y);
    expect(bottom[3].y).toBeLessThan(bottom[2].y);
    // Later cards of a hand step up and to the right.
    expect(spots[2][1].x).toBeGreaterThan(spots[2][0].x);
    expect(spots[2][1].y).toBeLessThan(spots[2][0].y);
  });
});

describe('scattered cards', () => {
  it('places fifteen cards without stacking them', () => {
    const { places, cardHeight } = scatterSlots(1000, 500, seededRandom(4));
    expect(places).toHaveLength(SCATTER_CARDS);
    for (const p of places) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000 - cardHeight);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(500 - cardHeight);
    }
  });

  it('gives the same positions for the same seed', () => {
    const a = scatterSlots(800, 400, seededRandom(11)).places;
    const b = scatterSlots(800, 400, seededRandom(11)).places;
    expect(a).toEqual(b);
  });
});

describe('spotsFor', () => {
  it('uses the outer seats only with six players, and always deals the dealer last', () => {
    expect(spotsFor(6)).toEqual([0, 1, 2, 3, 4, 5, DEALER_SPOT]);
    expect(spotsFor(4)).toEqual([1, 2, 3, 4, DEALER_SPOT]);
    expect(spotsFor(2)).toEqual([2, 3, DEALER_SPOT]);
  });
});

describe('handComplete', () => {
  it('stops on a soft 17 to 21', () => {
    expect(handComplete(cards([1, 6]), { spot: 1 })).toBe(true);
    expect(handComplete(cards([1, 10]), { spot: 1 })).toBe(true);
    expect(handComplete(cards([1, 5]), { spot: 1 })).toBe(false);
  });

  it('stops on a hard total over fourteen', () => {
    expect(handComplete(cards([10, 5]), { spot: 1 })).toBe(true);
    expect(handComplete(cards([10, 4]), { spot: 1 })).toBe(false);
  });

  it('lets the Two Tables dealer go to sixteen', () => {
    expect(handComplete(cards([10, 5]), { spot: DEALER_SPOT, dealerStopsAt16: true })).toBe(false);
    expect(handComplete(cards([10, 7]), { spot: DEALER_SPOT, dealerStopsAt16: true })).toBe(true);
  });
});

describe('dealRound', () => {
  const dealer = () => {
    let next = 0;
    const deck = Array.from({ length: 60 }, (_, i) => cardId((i % 13) + 1, i % 4));
    return () => (next < deck.length ? deck[next++] : null);
  };

  it('deals two cards to each player and one to the dealer in "First Two Cards"', () => {
    const { hands, stopped } = dealRound({ players: 6, handStyle: 'firstTwoCards', draw: dealer() });
    expect(stopped).toBe(false);
    expect(hands).toHaveLength(7);
    for (const hand of hands) expect(hand.cards).toHaveLength(hand.spot === DEALER_SPOT ? 1 : 2);
  });

  it('deals up to four cards, stopping on the hand rules', () => {
    const { hands } = dealRound({ players: 2, handStyle: 'twoToFourCards', draw: dealer() });
    for (const hand of hands) {
      expect(hand.cards.length).toBeGreaterThanOrEqual(1);
      expect(hand.cards.length).toBeLessThanOrEqual(4);
    }
  });

  it('reports when the shoe runs out mid-round', () => {
    let left = 3;
    const { hands, stopped } = dealRound({ players: 6, handStyle: 'firstTwoCards', draw: () => (left-- > 0 ? card(5) : null) });
    expect(stopped).toBe(true);
    expect(hands.flatMap(h => h.cards)).toHaveLength(3);
  });
});

describe('fullAnswer', () => {
  it('reads the value of the chosen drill', () => {
    const counts = { runningCount: 4, acesLeft: 19, aces: 5, tens: -2 };
    expect(fullAnswer('runningCount', counts)).toBe(4);
    expect(fullAnswer('acesLeft', counts)).toBe(19);
    expect(fullAnswer('acesDealt', counts)).toBe(5);
    expect(fullAnswer('tenSideCount', counts)).toBe(-2);
    expect(fullAnswer('twoTables', counts)).toBe(4);
  });

  it('knows the drills that end with the last ace', () => {
    expect(['acesLeft', 'acesDealt'].every(isAceCountDrill)).toBe(true);
    expect(isAceCountDrill('tenSideCount')).toBe(false);
  });
});

describe('the Two Tables partial view', () => {
  const hands = [
    { spot: 0, cards: cards([5, 5, 5, 5]) },
    { spot: 1, cards: cards([5, 5, 5]) },
    { spot: 2, cards: cards([5, 5, 5]) },
    { spot: DEALER_SPOT, cards: cards([5, 5, 5]) },
  ];

  it('shows two cards of every hand, every card of the first spots, and one dealer card', () => {
    expect(partialView(hands, 0)).toEqual([
      [true, true, true, true],
      [true, true, false],
      [true, true, false],
      [true, false, false],
    ]);
    expect(partialView(hands, 1)).toEqual([
      [true, true, true, true],
      [true, true, true],
      [true, true, false],
      [true, false, false],
    ]);
  });

  it('asks about each table twice, partly then fully', () => {
    expect(TWO_TABLE_PHASES).toEqual([
      { table: 0, partial: true }, { table: 1, partial: true },
      { table: 0, partial: false }, { table: 1, partial: false },
    ]);
  });
});
