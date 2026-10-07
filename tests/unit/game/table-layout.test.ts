import { describe, it, expect } from 'vitest';
import {
  tableLayout,
  visibleSeats,
  cardSlot,
  seatSlot,
  dealerSlot,
  railEdgeY,
  traySilhouette,
  DEALER_SPREAD_CARDS,
  MAX_PORTRAIT_SEATS,
  CARDS_PER_HAND,
  HANDS_PER_SEAT,
} from '@/game/table/layout';
import type { TableLayoutOptions } from '@/game/table/layout';
import type { HandKey } from '@/game/engine/hand';

interface Size {
  width: number;
  height: number;
}

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

const layoutFor = (size: Size, over: Partial<TableLayoutOptions> = {}) =>
  tableLayout({ ...size, seatCount: 4, humanSeats: [1, 2], ...over });

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
  for (const [name, size] of [
    ['portrait', PORTRAIT],
    ['landscape', LANDSCAPE],
  ] as [string, Size][]) {
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

      it('keeps the dealer hand on screen', () => {
        for (let count = 1; count <= 10; count++) {
          for (let index = 0; index < count; index++) {
            const slot = dealerSlot(layout.dealer, index, { count, holeHidden: false });
            expect(slot.x).toBeGreaterThanOrEqual(0);
            expect(slot.x + layout.cardWidth).toBeLessThanOrEqual(size.width);
          }
        }
      });

      it('puts the rail along the bottom', () => {
        expect(layout.rail.y).toBeGreaterThan(size.height * 0.7);
        expect(layout.rail.y + layout.rail.height).toBe(size.height);
      });

      it('puts the discard tray in the top-left corner', () => {
        expect(layout.tray!.x).toBeLessThan(4);
        expect(layout.tray!.y).toBeLessThan(4);
        expect(layout.tray!.width).toBeLessThan(size.width / 2);
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
    expect(layout.shoe!.x + layout.shoe!.width).toBe(layout.width);
    expect(layout.shoe!.x).toBeGreaterThan(layout.dealer.right + layout.cardWidth);
  });

  it('narrows the shoe on a small screen rather than let it crowd the felt', () => {
    const layout = tableLayout({ width: 320, height: 200, seatCount: 4, humanSeats: [1, 2] });
    expect(layout.shoe!.width).toBe(Math.round(layout.width * 0.33 - layout.cardWidth * 0.1));
    // The photograph keeps its shape as it shrinks.
    expect(layout.shoe!.width / layout.shoe!.height).toBeCloseTo(276 / 140, 1);
    expect(layout.shoe!.x + layout.shoe!.width).toBe(layout.width);
  });

  it('hides the tray and shoe when asked', () => {
    const layout = layoutFor(LANDSCAPE, { showTray: false, showShoe: false });
    expect(layout.tray).toBe(null);
    expect(layout.shoe).toBe(null);
  });

  it('gives the bankroll label the whole width in portrait with no tray', () => {
    const withTray = layoutFor(PORTRAIT);
    const without = layoutFor(PORTRAIT, { showTray: false });
    expect(withTray.bankroll.x).toBe(withTray.tray!.x + withTray.tray!.width + 4);
    expect(without.bankroll.x).toBe(4);
    expect(without.bankroll.width).toBe(without.width - 8);
    // The dealer's row is held down by the seats, not the tray, so it does not move.
    expect(without.dealer.y).toBe(withTray.dealer.y);
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
    expect(layoutFor(LANDSCAPE, { decks: 2 }).tray!.silhouette).toBe('2deck');
  });
});

describe('the table edge', () => {
  it('follows the rail photograph: high at the sides, lowest in the middle', () => {
    const layout = layoutFor(LANDSCAPE);
    const at = (x: number) => railEdgeY(layout.rail, layout.width, x);
    expect(at(0)).toBe(layout.rail.y);
    expect(at(layout.width / 4)).toBeGreaterThan(at(0));
    expect(at(layout.width / 2)).toBeGreaterThan(at(layout.width / 4));
    expect(at(layout.width * 0.25)).toBeCloseTo(at(layout.width * 0.75), 5);
    expect(at(layout.width / 2)).toBeLessThanOrEqual(layout.height);
  });
});

describe('bet circles', () => {
  for (const [name, size] of [
    ['portrait', PORTRAIT],
    ['landscape', LANDSCAPE],
  ] as [string, Size][]) {
    for (const seatCount of [1, 2, 4, 6]) {
      it(`sit under their seats, apart and on the table (${name}, ${seatCount} seats)`, () => {
        const layout = layoutFor(size, { seatCount, humanSeats: [1] });
        for (const seat of layout.seats) {
          expect(seat.circle.x).toBe(Math.round(seat.hands[0][0].x + layout.cardWidth / 2));
          expect(seat.circle.y + seat.circle.ry).toBeLessThanOrEqual(layout.height);
        }
        const xs = layout.seats.map(s => s.circle).sort((a, b) => a.x - b.x);
        for (let i = 1; i < xs.length; i++)
          expect(xs[i].x - xs[i - 1].x).toBeGreaterThanOrEqual(xs[i].rx + xs[i - 1].rx);
        // Every circle is the same gap above the table's curved edge.
        const gaps = layout.seats.map(({ circle: c }) => {
          const edge = Math.min(...[c.x - c.rx, c.x, c.x + c.rx].map(x => railEdgeY(layout.rail, layout.width, x)));
          return edge - (c.y + c.ry);
        });
        for (const gap of gaps) {
          expect(gap).toBeGreaterThan(0);
          expect(Math.abs(gap - layout.cardHeight * 0.12)).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});

describe('the dealer hand', () => {
  for (const [name, size] of [
    ['portrait', PORTRAIT],
    ['landscape', LANDSCAPE],
  ] as [string, Size][]) {
    describe(name, () => {
      const layout = layoutFor(size);
      const xs = (count: number, holeHidden = false, dealer = layout.dealer) =>
        Array.from({ length: count }, (_, i) => dealerSlot(dealer, i, { count, holeHidden }).x);
      const w = layout.cardWidth;

      it('tucks the face-down hole card under the left of the up card', () => {
        const [up, hole] = xs(2, true);
        expect(hole).toBeLessThan(up);
        expect(up - hole).toBeLessThan(w);
      });

      it('turns the hole card over to the right of the up card, clear of it', () => {
        const [up, hole] = xs(2);
        expect(hole).toBe(layout.dealer.right);
        expect(hole - up).toBeGreaterThanOrEqual(w);
        // The up card stays where it was dealt.
        expect(up).toBe(xs(2, true)[0]);
      });

      it('lays draws out to the left, side by side up to four cards', () => {
        const [up, hole, third, fourth] = xs(DEALER_SPREAD_CARDS);
        expect(hole).toBe(layout.dealer.right);
        expect(up - third).toBeGreaterThanOrEqual(w);
        expect(third - fourth).toBeGreaterThanOrEqual(w);
      });

      it('overlaps the whole hand from the fifth card on', () => {
        const [up, hole, ...draws] = xs(DEALER_SPREAD_CARDS + 1);
        expect(hole).toBe(layout.dealer.right);
        expect(hole - up).toBeLessThan(w);
        for (let i = 1; i < draws.length; i++) expect(draws[i - 1] - draws[i]).toBe(hole - up);
        expect(up - draws[0]).toBe(hole - up);
      });

      it('with no hole card, moves the up card right when the second card comes', () => {
        const dealer = layoutFor(size, { noHoleCard: true }).dealer;
        const [alone] = xs(1, false, dealer);
        const [up, second] = xs(2, false, dealer);
        expect(alone).toBe(xs(2, true)[0]);
        expect(up).toBe(dealer.right);
        expect(up - second).toBeGreaterThanOrEqual(w);
      });
    });
  }
});

describe('finding a card slot', () => {
  const layout = layoutFor(LANDSCAPE);

  it('finds the dealer', () => {
    const hand = { count: 3, holeHidden: false };
    expect(cardSlot(layout, '0-0', 2, hand)).toEqual(dealerSlot(layout.dealer, 2, hand));
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

describe('where split hands sit', () => {
  const layout = tableLayout({ width: 800, height: 400, seatCount: 4, humanSeats: [1], decks: 6 });
  const column = (key: HandKey, handsInSeat: number) => cardSlot(layout, key, 0, undefined, { handsInSeat })!.x;

  it('puts one split at the two ends of the seat box, as the original did', () => {
    const [seat] = layout.seats;
    expect(column('1-0', 2)).toBe(seat.hands[0][0].x);
    expect(column('1-1', 2)).toBe(seat.hands[3][0].x);
  });

  it('sits three or four hands side by side', () => {
    const [seat] = layout.seats;
    expect([0, 1, 2].map(i => column(`1-${i}`, 3))).toEqual([0, 1, 2].map(i => seat.hands[i][0].x));
    expect([0, 1, 2, 3].map(i => column(`1-${i}`, 4))).toEqual([0, 1, 2, 3].map(i => seat.hands[i][0].x));
  });

  it('leaves an unsplit hand where it was', () => {
    expect(column('1-0', 1)).toBe(layout.seats[0].hands[0][0].x);
  });
});
