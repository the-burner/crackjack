// Where everything sits on the table, worked out from the viewport size.
//
// Pure geometry: no DOM, no canvas. The renderer and the screen read the
// returned layout. Proportions follow the original `genlocs`: the seats arc
// along the bottom of the felt, each hand fans up and to the right, split
// hands step to the left, the dealer's hand sits above the middle, the discard
// tray is top left and the shoe top right.

import { cardWidthFor, CARD_ASPECT } from '../../ui/card-sprites.js';

/** Seats shown in portrait; a 6-seat table drops its leftmost seats. */
export const MAX_PORTRAIT_SEATS = 4;
/** Hand columns per seat: the base hand plus three split hands. */
export const HANDS_PER_SEAT = 4;
/** Card slots laid out per hand (hands are capped at 7 cards in play). */
export const CARDS_PER_HAND = 10;
/** Card slots laid out for the dealer. */
export const DEALER_CARDS = 8;
/** Cards a hand's fan is sized for. */
const FAN_CARDS = 7;
/** Fraction of the height where the padded rail begins. */
const RAIL_TOP = { landscape: 0.77, portrait: 0.93 };
/** Aspect ratio of the shoe photographs. */
const SHOE_ASPECT = 276 / 140;
/** How far each dealer card is offset from the one before it. */
const DEALER_STEP = 0.45;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The seats that fit the orientation, keeping the human seats. */
export function visibleSeats({ seatCount, humanSeats = [], portrait }) {
  const all = Array.from({ length: seatCount }, (_, i) => i + 1);
  if (!portrait || seatCount <= MAX_PORTRAIT_SEATS) return all;
  const kept = new Set(humanSeats.filter(seat => seat <= seatCount).slice(0, MAX_PORTRAIT_SEATS));
  // Seat 1 is nearest the player, so fill the remaining places from there.
  for (const seat of all) {
    if (kept.size >= MAX_PORTRAIT_SEATS) break;
    kept.add(seat);
  }
  return all.filter(seat => kept.has(seat));
}

/** Height of a card for a table of this size. */
function cardHeightFor({ width, height, seatsShown, portrait }) {
  if (portrait) {
    // Narrow tables need smaller cards so every seat still fits side by side.
    const perSeat = Math.floor(((width / seatsShown) * 0.72) / CARD_ASPECT);
    return Math.max(34, Math.min(Math.floor(height * 0.12), perSeat));
  }
  const base = Math.floor(height * (seatsShown > 4 ? 0.164 : 0.178));
  const perSeat = Math.floor(((width / seatsShown) * 0.8) / CARD_ASPECT);
  return Math.max(34, Math.min(base, perSeat));
}

/**
 * Works out the whole table layout.
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {number} o.seatCount         Seats at the table (1, 2, 4 or 6).
 * @param {number[]} [o.humanSeats]    Seats the player occupies.
 * @param {number} [o.decks]           Chooses the discard-tray silhouette.
 * @param {boolean} [o.showTray]
 * @param {boolean} [o.showShoe]
 * @returns {object} the layout
 */
export function tableLayout({ width, height, seatCount, humanSeats = [1], decks = 6, showTray = true, showShoe = true }) {
  const portrait = height > width;
  const seats = visibleSeats({ seatCount, humanSeats, portrait });
  const shown = seats.length;
  const cardHeight = cardHeightFor({ width, height, seatsShown: shown, portrait });
  const cardWidth = cardWidthFor(cardHeight);

  const boxExpand = portrait ? 1.26 : 1.24;
  const sepRatio = shown > 2 ? 0.75 : 0.6;
  const boxHeight = height * (shown > 2 ? 0.52 : 0.6) * (portrait ? 1.03 : 1);
  const boxWidth = (boxExpand * (width - 2)) / shown;
  const stepUp = (boxHeight - cardHeight) / (FAN_CARDS - 1);
  // Cards must step far enough right to leave each one's rank index showing,
  // which a narrow seat box on its own does not guarantee.
  const stepRight = Math.max(Math.round(cardWidth * 0.26), Math.floor((boxWidth * sepRatio - cardWidth) / FAN_CARDS));
  const splitStep = Math.max(6, Math.floor((boxWidth * (1 - sepRatio)) / 3));
  /** Horizontal room one seat's hands take up. */
  const seatWidth = cardWidth + splitStep * 3;
  const baseY = height * (shown > 4 ? 0.28 : shown > 2 ? 0.35 : 0.34) + boxHeight - cardHeight;

  const seatLayouts = seats.map((seat, i) => {
    // Seat 1 sits at the right; outer seats ride higher, which bows the row.
    const column = shown - 1 - i;
    const middle = (shown - 1) / 2;
    const arc = Math.round(Math.abs(column - middle) * cardHeight * 0.4) * -1;
    const x = Math.floor((column * (width - 2)) / (shown - 1 + boxExpand) + boxWidth * (1 - sepRatio)) + 2;
    const y = Math.round(baseY + arc + cardHeight * 0.4);
    return buildSeat({ seat, x, y, cardWidth, cardHeight, stepUp, stepRight, splitStep, seatWidth, width, portrait });
  });

  const topOfSeats = Math.min(...seatLayouts.map(s => s.hands[0][FAN_CARDS - 1].y));
  const tray = showTray ? trayRect({ width, cardWidth, cardHeight, decks, portrait, seatLayouts }) : null;
  // The shoe photo only fits beside the dealer in landscape.
  const shoe = showShoe && !portrait ? shoeRect({ width, topOfSeats, cardWidth }) : null;
  const dealer = dealerSlots({ width, cardWidth, cardHeight, portrait, topOfSeats, tray });

  const railY = Math.round(height * (portrait ? RAIL_TOP.portrait : RAIL_TOP.landscape));
  return {
    width, height, portrait, cardWidth, cardHeight,
    seatCount, seats: seatLayouts, hiddenSeats: seatCount - shown,
    dealer, tray, shoe,
    rail: { y: railY, height: height - railY },
    bankroll: bankrollBox({ width, height, portrait, dealer, cardHeight, tray }),
    status: statusBox({ width, portrait, tray, shoe }),
  };
}

/** One seat: its hand columns, its bet circle and its chip label. */
function buildSeat({ seat, x, y, cardWidth, cardHeight, stepUp, stepRight, splitStep, seatWidth, width, portrait }) {
  const hands = [];
  for (let hand = 0; hand < HANDS_PER_SEAT; hand++) {
    const slots = [];
    for (let card = 0; card < CARDS_PER_HAND; card++) {
      slots.push({
        x: Math.round(x - splitStep * hand + stepRight * card),
        y: Math.round(y - stepUp * card),
      });
    }
    hands.push(slots);
  }
  const circleWidth = Math.min(seatWidth, width / 5) * (portrait ? 1.4 : 1);
  const left = x - splitStep * (HANDS_PER_SEAT - 1);
  const centerX = Math.round(left + splitStep * 1.5 + circleWidth / 2);
  const centerY = Math.round(y + cardHeight);
  return {
    seat,
    hands,
    circle: { x: centerX, y: centerY, rx: Math.round((circleWidth - 8) / 2), ry: Math.round(((circleWidth - 8) / 2) * 0.75) },
    chip: {
      x: Math.round(centerX - seatWidth / 2),
      y: Math.round(y + cardHeight + 1),
      width: Math.round(seatWidth),
      height: Math.round(cardHeight * 0.3),
    },
  };
}

/**
 * Dealer card slots. The hole card takes the leftmost slot so the up card and
 * every card after it stay readable (the original swapped the same two slots).
 */
function dealerSlots({ width, cardWidth, cardHeight, portrait, topOfSeats, tray }) {
  const step = Math.max(10, Math.round(cardWidth * DEALER_STEP));
  const rightEdge = portrait ? width - 2 : Math.floor(width * 0.62) + cardWidth;
  // Room is kept for a five-card fan; a longer hand stacks at the right edge.
  const x = Math.max(2, rightEdge - cardWidth - step * 4);
  const lastX = width - cardWidth - 2;
  const y = portrait
    ? Math.max(tray ? tray.y + tray.height + 6 : 6, topOfSeats - cardHeight - 6)
    : Math.round(cardHeight * 0.86);
  const slots = [];
  for (let card = 0; card < DEALER_CARDS; card++) {
    slots.push({ x: Math.min(x + step * dealerSlotIndex(card), lastX), y });
  }
  return { slots, step, y };
}

/** Slot order: the hole card first (leftmost), then the up card, then the draws. */
export function dealerSlotIndex(cardIndex) {
  if (cardIndex === 0) return 1;
  if (cardIndex === 1) return 0;
  return cardIndex;
}

/** The discard tray sits in the top-left corner, as tall as the shortest seat fan. */
function trayRect({ width, cardWidth, cardHeight, decks, portrait, seatLayouts }) {
  const silhouette = traySilhouette(decks);
  const maxWidth = portrait ? width - (cardWidth + 2) * 4 : width * 0.3;
  const available = Math.max(...seatLayouts.map(s => s.hands[0][5].y)) - 2;
  const byHeight = Math.min(available, cardHeight * 2.4);
  let height = Math.max(60, byHeight);
  let boxWidth = (height * silhouette.width) / silhouette.height;
  if (boxWidth > maxWidth) {
    boxWidth = Math.max(40, maxWidth);
    height = (boxWidth * silhouette.height) / silhouette.width;
  }
  return { x: 1, y: 1, width: Math.round(boxWidth), height: Math.round(height), silhouette: silhouette.name };
}

/** The tray photo series and mask for a shoe of this many decks. */
export function traySilhouette(decks) {
  if (decks > 6) return { name: '8deck', width: 115, height: 189 };
  if (decks > 2) return { name: '6deck', width: 133, height: 189 };
  return { name: '2deck', width: 134, height: 131 };
}

/** The shoe photo sits in the top-right corner, left of nothing else. */
function shoeRect({ width, topOfSeats, cardWidth }) {
  let height = clamp(topOfSeats, 60, 220);
  let boxWidth = Math.floor(height * SHOE_ASPECT);
  const maxWidth = Math.max(80, width * 0.33 - cardWidth * 0.1);
  if (boxWidth > maxWidth) {
    boxWidth = Math.round(maxWidth);
    height = Math.round(boxWidth / SHOE_ASPECT);
  }
  return { x: width - boxWidth, y: 1, width: boxWidth, height: Math.round(height) };
}

/** The bankroll label: centred over the felt, above the dealer's cards. */
function bankrollBox({ width, height, portrait, dealer, cardHeight, tray }) {
  const boxHeight = Math.round(clamp(cardHeight * 0.32, 18, 34));
  if (portrait) {
    const left = tray ? tray.x + tray.width + 4 : 4;
    return { x: left, y: Math.max(4, dealer.y - boxHeight - 6), width: width - left - 4, height: boxHeight };
  }
  const boxWidth = Math.round(width * 0.3);
  return { x: Math.round((width - boxWidth) / 2), y: Math.max(2, dealer.y - boxHeight - 6), width: boxWidth, height: boxHeight };
}

/** The status band: between the tray and the shoe along the top. */
function statusBox({ width, portrait, tray, shoe }) {
  const left = portrait && tray ? tray.x + tray.width + 4 : Math.round(width * 0.26);
  const right = shoe ? shoe.x - 4 : width - 4;
  return { x: left, y: portrait ? 40 : 2, width: Math.max(80, right - left), height: 34 };
}

/**
 * The slot a card occupies.
 * @param {object} layout
 * @param {string} handKey  "seat-index"; seat 0 is the dealer.
 * @param {number} cardIndex
 * @returns {{x: number, y: number}|null} null when the seat is not shown.
 */
export function cardSlot(layout, handKey, cardIndex) {
  const [seat, index] = handKey.split('-').map(Number);
  if (seat === 0) return layout.dealer.slots[Math.min(cardIndex, DEALER_CARDS - 1)] ?? null;
  const seatLayout = layout.seats.find(s => s.seat === seat);
  if (!seatLayout) return null;
  const column = seatLayout.hands[Math.min(index, HANDS_PER_SEAT - 1)];
  return column[Math.min(cardIndex, CARDS_PER_HAND - 1)] ?? null;
}

/** The seat's layout, or null when that seat is not shown. */
export const seatSlot = (layout, seat) => layout.seats.find(s => s.seat === seat) ?? null;
