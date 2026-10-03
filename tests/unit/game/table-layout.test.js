import { describe, it, expect } from 'vitest';
import {
  tableLayout, visibleSeats, cardSlot, seatSlot, dealerSlotIndex, traySilhouette,
  MAX_PORTRAIT_SEATS, CARDS_PER_HAND, HANDS_PER_SEAT,
} from '../../../public/src/game/table/layout.js';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

const layoutFor = (size, over = {}) => tableLayout({ ...size, seatCount: 4, humanSeats: [1, 2], ...over });

describe('visible seats', () => {
  it('shows every seat in landscape', () => {
    expect(visibleSeats({ seatCount: 6, humanSeats: [1, 2], portrait: false })).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('reduces a six-seat table in portrait instead of refusing to play', () => {
    const seats = visibleSeats({ seatCount: 6, humanSeats: [1, 2], portrait: true });
    expect(seats).toHaveLength(MAX_PORTRAIT_SEATS);
    expect(seats).toEqual([1, 2, 3, 4]);
  });

  it('keeps the human seats when it reduces', () => {
    const seats = visibleSeats({ seatCount: 6, humanSeats: [5, 6], portrait: true });
    expect(seats).toContain(5);
    expect(seats).toContain(6);
    expect(seats).toHaveLength(MAX_PORTRAIT_SEATS);
  });

  it('leaves small tables alone in portrait', () => {
    expect(visibleSeats({ seatCount: 2, humanSeats: [1], portrait: true })).toEqual([1, 2]);
  });
});

describe('table layout', () => {
  for (const [name, size] of [['portrait', PORTRAIT], ['landscape', LANDSCAPE]]) {
    describe(name, () => {
      const layout = layoutFor(size);

      it('reports the orientation', () => {
        expect(layout.portrait).toBe(size.height > size.width);
      });

      it('keeps cards a sensible size with the right aspect', () => {
        expect(layout.cardHeight).toBeGreaterThan(30);
        expect(layout.cardHeight).toBeLessThan(size.height / 3);
        expect(layout.cardWidth).toBe(Math.floor((layout.cardHeight * 150) / 215));
      });

      it('fits every seat on the felt', () => {
        for (const seat of layout.seats) {
          const first = seat.hands[0][0];
          expect(first.x).toBeGreaterThanOrEqual(0);
          expect(first.x + layout.cardWidth).toBeLessThanOrEqual(size.width);
          expect(first.y + layout.cardHeight).toBeLessThanOrEqual(size.height);
        }
      });

      it('fans each hand up and to the right', () => {
        const [slots] = layout.seats[0].hands;
        for (let i = 1; i < CARDS_PER_HAND; i++) {
          expect(slots[i].x).toBeGreaterThan(slots[i - 1].x);
          expect(slots[i].y).toBeLessThan(slots[i - 1].y);
        }
      });

      it('steps split hands to the left of the base hand', () => {
        const { hands } = layout.seats[0];
        for (let i = 1; i < HANDS_PER_SEAT; i++) {
          expect(hands[i][0].x).toBeLessThan(hands[i - 1][0].x);
          expect(hands[i][0].y).toBe(hands[0][0].y);
        }
      });

      it('puts the bet circle below the first card row', () => {
        for (const seat of layout.seats) {
          expect(seat.circle.y).toBeGreaterThan(seat.hands[0][0].y);
          expect(seat.circle.rx).toBeGreaterThan(seat.circle.ry);
        }
      });

      it('puts the dealer above the players', () => {
        const topOfSeats = Math.min(...layout.seats.map(s => s.hands[0][0].y));
        expect(layout.dealer.y).toBeLessThan(topOfSeats);
        expect(layout.dealer.y).toBeGreaterThanOrEqual(0);
      });

      it('keeps the dealer fan on screen', () => {
        for (const slot of layout.dealer.slots) {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x + layout.cardWidth).toBeLessThanOrEqual(size.width);
        }
      });

      it('puts the rail along the bottom', () => {
        expect(layout.rail.y).toBeGreaterThan(size.height * 0.7);
        expect(layout.rail.y + layout.rail.height).toBe(size.height);
      });

      it('puts the discard tray in the top-left corner', () => {
        expect(layout.tray.x).toBeLessThan(4);
        expect(layout.tray.y).toBeLessThan(4);
        expect(layout.tray.width).toBeLessThan(size.width / 2);
      });
    });
  }

  it('seats the player on the right', () => {
    const layout = layoutFor(LANDSCAPE);
    const [seat1, seat2] = layout.seats;
    expect(seat1.seat).toBe(1);
    expect(seat1.hands[0][0].x).toBeGreaterThan(seat2.hands[0][0].x);
  });

  it('bows the row of seats, with the outer seats higher', () => {
    const layout = layoutFor(LANDSCAPE, { seatCount: 4 });
    const ys = layout.seats.map(s => s.hands[0][0].y);
    expect(Math.max(...ys)).toBe(Math.max(ys[1], ys[2]));
    expect(ys[0]).toBeLessThan(Math.max(...ys));
    expect(ys[3]).toBeLessThan(Math.max(...ys));
  });

  it('shows the shoe only in landscape', () => {
    expect(layoutFor(LANDSCAPE).shoe).not.toBe(null);
    expect(layoutFor(PORTRAIT).shoe).toBe(null);
  });

  it('keeps the shoe in the top-right corner, clear of the dealer', () => {
    const layout = layoutFor(LANDSCAPE);
    expect(layout.shoe.x + layout.shoe.width).toBe(layout.width);
    expect(layout.shoe.x).toBeGreaterThan(layout.dealer.slots[1].x + layout.cardWidth);
  });

  it('hides the tray and shoe when asked', () => {
    const layout = layoutFor(LANDSCAPE, { showTray: false, showShoe: false });
    expect(layout.tray).toBe(null);
    expect(layout.shoe).toBe(null);
  });

  it('shrinks cards so six seats still fit side by side', () => {
    const four = layoutFor(LANDSCAPE, { seatCount: 4 });
    const six = layoutFor(LANDSCAPE, { seatCount: 6 });
    expect(six.cardHeight).toBeLessThan(four.cardHeight);
  });

  it('counts the seats it had to hide', () => {
    expect(layoutFor(PORTRAIT, { seatCount: 6 }).hiddenSeats).toBe(6 - MAX_PORTRAIT_SEATS);
    expect(layoutFor(LANDSCAPE, { seatCount: 6 }).hiddenSeats).toBe(0);
  });

  it('picks the tray silhouette from the deck count', () => {
    expect(traySilhouette(8).name).toBe('8deck');
    expect(traySilhouette(6).name).toBe('6deck');
    expect(traySilhouette(2).name).toBe('2deck');
    expect(layoutFor(LANDSCAPE, { decks: 2 }).tray.silhouette).toBe('2deck');
  });
});

describe('finding a card slot', () => {
  const layout = layoutFor(LANDSCAPE);

  it('finds the dealer', () => {
    expect(cardSlot(layout, '0-0', 0)).toEqual(layout.dealer.slots[0]);
    expect(cardSlot(layout, '0-0', 2)).toEqual(layout.dealer.slots[2]);
  });

  it('places the hole card left of the up card so both stay readable', () => {
    expect(dealerSlotIndex(1)).toBeLessThan(dealerSlotIndex(0));
    expect(dealerSlotIndex(2)).toBeGreaterThan(dealerSlotIndex(0));
    expect(cardSlot(layout, '0-0', 1).x).toBeLessThan(cardSlot(layout, '0-0', 0).x);
  });

  it('finds a split hand', () => {
    expect(cardSlot(layout, '1-1', 0)).toEqual(layout.seats[0].hands[1][0]);
  });

  it('clamps a hand that somehow grew past its slots', () => {
    expect(cardSlot(layout, '1-0', 99)).toEqual(layout.seats[0].hands[0][CARDS_PER_HAND - 1]);
  });

  it('returns nothing for a seat that is not shown', () => {
    const portrait = layoutFor(PORTRAIT, { seatCount: 6 });
    expect(cardSlot(portrait, '6-0', 0)).toBe(null);
    expect(seatSlot(portrait, 6)).toBe(null);
    expect(seatSlot(portrait, 1)).not.toBe(null);
  });
});
