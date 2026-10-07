// Where everything sits on the table, worked out from the viewport size.
//
// Pure geometry: no DOM, no canvas. The renderer and the screen read the
// returned layout. The seats arc along the bottom of the felt, each hand fans
// up and to the right, split hands step to the left, the dealer's hand sits
// above the middle, the discard tray is top left and the shoe top right.

import { cardWidthFor, CARD_ASPECT } from '@/lib/card-sprites';
import { parseHandKey } from '@/game/engine/hand';
import type { HandKey } from '@/game/engine/hand';
import { MAX_CARDS_PER_HAND } from '@/game/engine/rules';

/** Seats shown in portrait; a 6-seat table drops its leftmost seats. */
export const MAX_PORTRAIT_SEATS = 4;
/** Hand columns per seat: the base hand plus three split hands. */
export const HANDS_PER_SEAT = 4;
/** Card slots laid out per hand (hands are capped at 7 cards in play). */
export const CARDS_PER_HAND = 10;
/** Dealer hands up to this long sit side by side; longer ones overlap. */
export const DEALER_SPREAD_CARDS = 4;
/** Cards a hand's fan is sized for. */
const FAN_CARDS = MAX_CARDS_PER_HAND;
/** Fraction of the height where the padded rail begins. */
const RAIL_TOP = { landscape: 0.77, portrait: 0.93 };
/** Size of the rail photograph. */
export const RAIL_SIZE = { width: 1600, height: 232 };
/**
 * How far down the rail photograph its felt edge runs, in source pixels, every
 * 50 pixels across. The edge bows down to the middle and is symmetric.
 */
const RAIL_EDGE = [0, 32, 55, 72, 87, 99, 109, 118, 126, 132, 138, 142, 146, 148, 150, 151, 152];
/** Space between a bet circle and the table's edge, in card heights. */
const CIRCLE_GAP = 0.12;
/** Aspect ratio of the shoe photographs. */
const SHOE_ASPECT = 276 / 140;
/** How far the face-down hole card peeks out from under the up card. */
const HOLE_PEEK = 0.45;
/** Smallest card height, in pixels. */
const MIN_CARD_HEIGHT = 34;
/** A bet circle's height over its width. */
const CIRCLE_ASPECT = 0.75;
/** A chip label's height, in card heights. */
const CHIP_LABEL_HEIGHT = 0.3;
/** Top of the burn-card row, in pixels. */
const BURN_ROW_Y = 37;
/** The discard tray's height: at most this many card heights, at least MIN_TRAY_HEIGHT pixels. */
const TRAY_HEIGHT_IN_CARDS = 2.4;
const MIN_TRAY_HEIGHT = 60;
/** Smallest and largest shoe photo height, in pixels. */
const SHOE_HEIGHT = { min: 60, max: 220 };
/** Height of the status band, in pixels. */
const STATUS_HEIGHT = 34;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One seat: its hand columns (card slots per hand), its bet circle and its chip label. */
export interface SeatLayout {
  seat: number;
  hands: Point[][];
  circle: { x: number; y: number; rx: number; ry: number };
  chip: Box;
}

/** The dealer's row (see dealerSlot). */
export interface DealerRow {
  right: number;
  y: number;
  spread: number;
  overlap: number;
  peek: number;
  noHoleCard: boolean;
}

export interface TrayBox extends Box {
  /** '8deck', '6deck' or '2deck'. */
  silhouette: string;
}

export interface Rail {
  y: number;
  height: number;
  /** Rows of the rail photograph shown. */
  sourceHeight: number;
}

export interface BurnRow extends Box {
  step: number;
}

export interface TableLayout {
  width: number;
  height: number;
  portrait: boolean;
  cardWidth: number;
  cardHeight: number;
  seatCount: number;
  seats: SeatLayout[];
  hiddenSeats: number;
  dealer: DealerRow;
  tray: TrayBox | null;
  shoe: Box | null;
  burns: BurnRow;
  rail: Rail;
  bankroll: Box;
  status: Box;
}

/** Cards in the dealer's hand, and whether the hole card is still face down. */
export interface DealerHandShape {
  count: number;
  holeHidden: boolean;
}

/** The seats that fit the orientation, keeping the human seats. */
export function visibleSeats({
  seatCount,
  humanSeats = [],
  portrait,
}: {
  seatCount: number;
  humanSeats?: number[];
  portrait: boolean;
}): number[] {
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
function cardHeightFor({
  width,
  height,
  seatsShown,
  portrait,
}: {
  width: number;
  height: number;
  seatsShown: number;
  portrait: boolean;
}) {
  if (portrait) {
    // Narrow tables need smaller cards so every seat still fits side by side.
    const perSeat = Math.floor(((width / seatsShown) * 0.72) / CARD_ASPECT);
    return Math.max(MIN_CARD_HEIGHT, Math.min(Math.floor(height * 0.12), perSeat));
  }
  const base = Math.floor(height * (seatsShown > 4 ? 0.164 : 0.178));
  const perSeat = Math.floor(((width / seatsShown) * 0.8) / CARD_ASPECT);
  return Math.max(MIN_CARD_HEIGHT, Math.min(base, perSeat));
}

export interface TableLayoutOptions {
  width: number;
  height: number;
  /** Seats at the table (1, 2, 4 or 6). */
  seatCount: number;
  /** Seats the player occupies. */
  humanSeats?: number[];
  /** Chooses the discard-tray silhouette. */
  decks?: number;
  showTray?: boolean;
  showShoe?: boolean;
  /** The dealer takes a second card only after the players. */
  noHoleCard?: boolean;
}

/** Works out the whole table layout. */
export function tableLayout({
  width,
  height,
  seatCount,
  humanSeats = [1],
  decks = 6,
  showTray = true,
  showShoe = true,
  noHoleCard = false,
}: TableLayoutOptions): TableLayout {
  const portrait = height > width;
  const seats = visibleSeats({ seatCount, humanSeats, portrait });
  const shown = seats.length;
  const cardHeight = cardHeightFor({ width, height, seatsShown: shown, portrait });
  const cardWidth = cardWidthFor(cardHeight);

  const boxExpand = portrait ? 1.26 : 1.24;
  const sepRatio = shown > 2 ? 0.75 : 0.6;
  // Every table uses the row of the fullest one, which keeps the seats on the felt.
  const boxHeight = height * 0.52 * (portrait ? 1.03 : 1);
  const boxWidth = (boxExpand * (width - 2)) / shown;
  const stepUp = (boxHeight - cardHeight) / (FAN_CARDS - 1);
  // Cards must step far enough right to leave each one's rank index showing,
  // which a narrow seat box on its own does not guarantee.
  const stepRight = Math.max(Math.round(cardWidth * 0.26), Math.floor((boxWidth * sepRatio - cardWidth) / FAN_CARDS));
  // Split hands step left from the base hand.
  const splitStep = Math.max(6, Math.floor((boxWidth * (1 - sepRatio)) / (HANDS_PER_SEAT - 1)));
  /** Horizontal room one seat's hands take up. */
  const seatWidth = cardWidth + splitStep * (HANDS_PER_SEAT - 1);
  const railY = Math.round(height * (portrait ? RAIL_TOP.portrait : RAIL_TOP.landscape));
  const rail: Rail = {
    y: railY,
    height: height - railY,
    sourceHeight: Math.min(RAIL_SIZE.height, (RAIL_SIZE.width * (height - railY)) / width),
  };
  const edge = (x: number) => railEdgeY(rail, width, x);

  const seatLayouts = seats.map((seat, i) => {
    // Seat 1 sits at the right.
    const column = shown - 1 - i;
    const x = Math.floor((column * (width - 2)) / (shown - 1 + boxExpand) + boxWidth * (1 - sepRatio)) + 2;
    return buildSeat({ seat, x, cardWidth, cardHeight, stepUp, stepRight, splitStep, seatWidth, width, edge });
  });

  const topOfSeats = Math.min(...seatLayouts.map(s => s.hands[0][FAN_CARDS - 1].y));
  const tray = showTray ? trayRect({ width, cardWidth, cardHeight, decks, portrait, seatLayouts }) : null;
  // The shoe photo only fits beside the dealer in landscape.
  const shoe = showShoe && !portrait ? shoeRect({ width, topOfSeats, cardWidth }) : null;
  const dealer = dealerRow({ width, cardWidth, cardHeight, portrait, topOfSeats, tray, noHoleCard });

  return {
    width,
    height,
    portrait,
    cardWidth,
    cardHeight,
    seatCount,
    seats: seatLayouts,
    hiddenSeats: seatCount - shown,
    dealer,
    tray,
    shoe,
    burns: burnRow({ cardWidth, cardHeight, portrait, tray }),
    rail,
    bankroll: bankrollBox({ width, height, portrait, dealer, cardHeight, tray }),
    status: statusBox({ width, portrait, tray, shoe }),
  };
}

/**
 * Where the felt meets the rail at `x`: the rail photograph is drawn across
 * the full width from `rail.y`, showing `rail.sourceHeight` rows of it.
 */
export function railEdgeY(rail: Rail, width: number, x: number): number {
  const at = clamp(x / width, 0, 1) * (RAIL_SIZE.width / 50);
  const i = Math.min(Math.floor(Math.min(at, 32 - at)), RAIL_EDGE.length - 2);
  const t = Math.min(at, 32 - at) - i;
  const row = RAIL_EDGE[i] + (RAIL_EDGE[i + 1] - RAIL_EDGE[i]) * t;
  return rail.y + (Math.min(row, rail.sourceHeight) * rail.height) / rail.sourceHeight;
}

/**
 * One seat: its hand columns, its bet circle and its chip label. The circle
 * sits under the first card, the same gap above the table's edge at every
 * seat; the cards stand on it.
 */
function buildSeat({
  seat,
  x,
  cardWidth,
  cardHeight,
  stepUp,
  stepRight,
  splitStep,
  seatWidth,
  width,
  edge,
}: {
  seat: number;
  x: number;
  cardWidth: number;
  cardHeight: number;
  stepUp: number;
  stepRight: number;
  splitStep: number;
  seatWidth: number;
  width: number;
  edge: (x: number) => number;
}): SeatLayout {
  const circleWidth = Math.min(seatWidth, width / 5, cardWidth * 2);
  const rx = Math.round((circleWidth - 8) / 2);
  const ry = Math.round(rx * CIRCLE_ASPECT);
  const centerX = Math.round(x + cardWidth / 2);
  // The edge is highest at the circle's outer side.
  const edgeY = Math.min(edge(centerX - rx), edge(centerX), edge(centerX + rx));
  const centerY = Math.round(edgeY - cardHeight * CIRCLE_GAP - ry);
  const y = centerY - cardHeight;
  const hands: Point[][] = [];
  for (let hand = 0; hand < HANDS_PER_SEAT; hand++) {
    const slots: Point[] = [];
    for (let card = 0; card < CARDS_PER_HAND; card++) {
      slots.push({
        x: Math.round(x - splitStep * hand + stepRight * card),
        y: Math.round(y - stepUp * card),
      });
    }
    hands.push(slots);
  }
  return {
    seat,
    hands,
    circle: { x: centerX, y: centerY, rx, ry },
    chip: {
      x: Math.round(centerX - seatWidth / 2),
      y: Math.round(y + cardHeight + 1),
      width: Math.round(seatWidth),
      height: Math.round(cardHeight * CHIP_LABEL_HEIGHT),
    },
  };
}

/**
 * The dealer's row, laid out as in the original: the hand runs right to left
 * from `right`, side by side up to DEALER_SPREAD_CARDS cards and overlapping
 * after that.
 */
function dealerRow({
  width,
  cardWidth,
  cardHeight,
  portrait,
  topOfSeats,
  tray,
  noHoleCard,
}: {
  width: number;
  cardWidth: number;
  cardHeight: number;
  portrait: boolean;
  topOfSeats: number;
  tray: TrayBox | null;
  noHoleCard: boolean;
}): DealerRow {
  const right = portrait ? width - cardWidth - 2 : Math.floor(width * 0.62);
  const y = portrait
    ? Math.max(tray ? tray.y + tray.height + 6 : 6, topOfSeats - cardHeight - 6)
    : Math.round(cardHeight * 0.86);
  return {
    right,
    y,
    spread: cardWidth + (portrait ? 3 : 1),
    overlap: Math.round(portrait ? (cardWidth * 3 + 4) / 9 : cardWidth / 2),
    peek: Math.max(10, Math.round(cardWidth * HOLE_PEEK)),
    noHoleCard,
  };
}

/**
 * Where the dealer's card `index` sits. The face-down hole card peeks out to
 * the left from under the up card; once turned it moves to the right of it.
 * With no hole card, the up card moves right when the second card comes.
 * @param dealer  `layout.dealer`
 */
export function dealerSlot(dealer: DealerRow, index: number, { count, holeHidden }: DealerHandShape): Point {
  const { right, y, spread, overlap, peek } = dealer;
  if (holeHidden || count === 1) return { x: right - spread - (index === 1 ? peek : 0), y };
  // Places from the right: the turned hole card first, or the up card when there is none.
  const place = !dealer.noHoleCard && index < 2 ? 1 - index : index;
  return { x: right - place * (count > DEALER_SPREAD_CARDS ? overlap : spread), y };
}

/** Burn cards are dealt in a row just right of the discard tray. */
function burnRow({
  cardWidth,
  cardHeight,
  portrait,
  tray,
}: {
  cardWidth: number;
  cardHeight: number;
  portrait: boolean;
  tray: TrayBox | null;
}): BurnRow {
  return {
    x: (tray ? tray.width : 0) + cardWidth / 2,
    y: BURN_ROW_Y,
    step: portrait ? cardWidth * 0.5 : cardWidth + 2,
    width: cardWidth,
    height: cardHeight,
  };
}

/** The discard tray sits in the top-left corner, as tall as the shortest seat fan. */
function trayRect({
  width,
  cardWidth,
  cardHeight,
  decks,
  portrait,
  seatLayouts,
}: {
  width: number;
  cardWidth: number;
  cardHeight: number;
  decks: number;
  portrait: boolean;
  seatLayouts: SeatLayout[];
}): TrayBox {
  const silhouette = traySilhouette(decks);
  const maxWidth = portrait ? width - (cardWidth + 2) * 4 : width * 0.3;
  const available = Math.max(...seatLayouts.map(s => s.hands[0][5].y)) - 2;
  const byHeight = Math.min(available, cardHeight * TRAY_HEIGHT_IN_CARDS);
  let height = Math.max(MIN_TRAY_HEIGHT, byHeight);
  let boxWidth = (height * silhouette.width) / silhouette.height;
  if (boxWidth > maxWidth) {
    boxWidth = Math.max(40, maxWidth);
    height = (boxWidth * silhouette.height) / silhouette.width;
  }
  return { x: 1, y: 1, width: Math.round(boxWidth), height: Math.round(height), silhouette: silhouette.name };
}

/** The tray photo series and mask for a shoe of this many decks. */
export function traySilhouette(decks: number): { name: string; width: number; height: number } {
  if (decks > 6) return { name: '8deck', width: 115, height: 189 };
  if (decks > 2) return { name: '6deck', width: 133, height: 189 };
  return { name: '2deck', width: 134, height: 131 };
}

/** The shoe photo sits in the top-right corner, left of nothing else. */
function shoeRect({ width, topOfSeats, cardWidth }: { width: number; topOfSeats: number; cardWidth: number }): Box {
  let height = clamp(topOfSeats, SHOE_HEIGHT.min, SHOE_HEIGHT.max);
  let boxWidth = Math.floor(height * SHOE_ASPECT);
  const maxWidth = Math.max(80, width * 0.33 - cardWidth * 0.1);
  if (boxWidth > maxWidth) {
    boxWidth = Math.round(maxWidth);
    height = Math.round(boxWidth / SHOE_ASPECT);
  }
  return { x: width - boxWidth, y: 1, width: boxWidth, height: Math.round(height) };
}

/** The bankroll label: centred over the felt, above the dealer's cards. */
function bankrollBox({
  width,
  portrait,
  dealer,
  cardHeight,
  tray,
}: {
  width: number;
  height: number;
  portrait: boolean;
  dealer: DealerRow;
  cardHeight: number;
  tray: TrayBox | null;
}): Box {
  const boxHeight = Math.round(clamp(cardHeight * 0.32, 18, 34));
  if (portrait) {
    const left = tray ? tray.x + tray.width + 4 : 4;
    return { x: left, y: Math.max(4, dealer.y - boxHeight - 6), width: width - left - 4, height: boxHeight };
  }
  const boxWidth = Math.round(width * 0.3);
  return {
    x: Math.round((width - boxWidth) / 2),
    y: Math.max(2, dealer.y - boxHeight - 6),
    width: boxWidth,
    height: boxHeight,
  };
}

/** The status band: between the tray and the shoe along the top. */
function statusBox({
  width,
  portrait,
  tray,
  shoe,
}: {
  width: number;
  portrait: boolean;
  tray: TrayBox | null;
  shoe: Box | null;
}): Box {
  const left = portrait && tray ? tray.x + tray.width + 4 : Math.round(width * 0.26);
  const right = shoe ? shoe.x - 4 : width - 4;
  return { x: left, y: portrait ? 40 : 2, width: Math.max(80, right - left), height: STATUS_HEIGHT };
}

/**
 * The slot a card occupies.
 * @param key  Seat 0 is the dealer.
 * @param dealerHand  For the dealer (see dealerSlot).
 * @returns null when the seat is not shown.
 */
export function cardSlot(
  layout: TableLayout,
  key: HandKey,
  cardIndex: number,
  dealerHand: DealerHandShape = { count: cardIndex + 1, holeHidden: false },
  { handsInSeat = 0 }: { handsInSeat?: number } = {},
): Point | null {
  const { seat, index } = parseHandKey(key);
  if (seat === 0) return dealerSlot(layout.dealer, cardIndex, dealerHand);
  const seatLayout = layout.seats.find(s => s.seat === seat);
  if (!seatLayout) return null;
  const column = seatLayout.hands[splitColumn(index, handsInSeat)];
  return column[Math.min(cardIndex, CARDS_PER_HAND - 1)] ?? null;
}

/**
 * Which column a hand sits in. A single split puts its two hands at the two
 * ends of the seat's box, as the original did; three or four sit side by side.
 */
export function splitColumn(index: number, handsInSeat = 0): number {
  if (handsInSeat === 2 && index === 1) return HANDS_PER_SEAT - 1;
  return Math.min(index, HANDS_PER_SEAT - 1);
}

/** The seat's layout, or null when that seat is not shown. */
export const seatSlot = (layout: TableLayout, seat: number): SeatLayout | null =>
  layout.seats.find(s => s.seat === seat) ?? null;
