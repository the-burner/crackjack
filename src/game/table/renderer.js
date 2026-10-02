// Drawing the table onto a canvas: the felt photograph, the padded rail, a bet
// circle per seat, the cards, the discard tray, the shoe and the turn pointer.
//
// The felt, rail and circles never change while the layout holds still, so they
// are built once into a background buffer and copied in front of every frame.

import { setupCanvas, drawCard, loadCardImages } from '../../ui/card-sprites.js';
import { cardSlot } from './layout.js';
import { trayPhoto, shoePhoto, trayMaskSrc, SHOE_MASK_SRC, drawMasked, loadImage } from './photos.js';

const FELT_SRC = 'assets/table/felt.jpg';
const RAIL_SRC = 'assets/table/rail.png';
const RAIL_SHADOW_SRC = 'assets/table/rail-shadow.png';
const POINTER_SRC = 'assets/table/pointer.png';
/** The rail artwork is 1600 x 232; a short rail is cropped, not squashed. */
const RAIL_SIZE = { width: 1600, height: 232 };
const POINTER_SIZE = { width: 24, height: 50 };
const CIRCLE_COLOR = 'rgb(230, 205, 127)';
const FELT_FALLBACK = '#044f36';

/**
 * @param {HTMLCanvasElement} canvas  The visible table canvas.
 * @returns {{resize: Function, render: Function, whenReady: Function}}
 */
export function createTableRenderer(canvas) {
  const background = document.createElement('canvas');
  let layout = null;
  let ctx = null;
  let redraw = () => {};

  /** Re-runs the last render once a photograph finishes loading. */
  const onPhotoLoad = () => redraw();

  const buildBackground = () => {
    const ratio = window.devicePixelRatio || 1;
    background.width = Math.round(layout.width * ratio);
    background.height = Math.round(layout.height * ratio);
    const bg = background.getContext('2d');
    bg.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawFelt(bg, layout);
    drawRail(bg, layout);
    drawBetCircles(bg, layout);
  };

  return {
    /** Sizes the canvas for a new layout and rebuilds the background. */
    resize(next) {
      layout = next;
      ctx = setupCanvas(canvas, layout.width, layout.height);
      buildBackground();
    },

    /**
     * Draws one frame.
     * @param {object} state
     * @param {object[]} state.hands        Player hands: {key, cards, faceUp}.
     * @param {object} state.dealer         The dealer's hand, same shape.
     * @param {string|null} [state.pointerHand]  The hand the pointer points at.
     * @param {number} [state.trayCards]    Cards in the discard tray.
     * @param {number} [state.shoeCards]    Cards left in the shoe.
     * @param {boolean} [state.spanish]     Spanish decks show a queen for a ten.
     */
    render(state) {
      if (!ctx) return;
      redraw = () => this.render(state);
      ctx.clearRect(0, 0, layout.width, layout.height);
      ctx.drawImage(background, 0, 0, background.width, background.height, 0, 0, layout.width, layout.height);
      drawTray(ctx, layout, state.trayCards ?? 0, onPhotoLoad);
      drawShoe(ctx, layout, state.shoeCards ?? 0, onPhotoLoad);
      for (const hand of [state.dealer, ...state.hands]) {
        if (hand) drawHand(ctx, layout, hand, state.spanish);
      }
      drawPointer(ctx, layout, state);
    },

    /** Resolves once the card sheet and the felt are available. */
    whenReady() {
      return Promise.all([loadCardImages(), loadImage(FELT_SRC).ready, loadImage(RAIL_SRC).ready]);
    },
  };
}

/** The felt photograph, stretched over the whole table as the original did. */
function drawFelt(ctx, layout) {
  ctx.fillStyle = FELT_FALLBACK;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const felt = loadImage(FELT_SRC);
  if (felt.img.naturalWidth) ctx.drawImage(felt.img, 0, 0, layout.width, layout.height);
}

/** The padded rail and its shadow along the bottom edge. */
function drawRail(ctx, layout) {
  const { y, height } = layout.rail;
  const sourceHeight = Math.min(RAIL_SIZE.height, (RAIL_SIZE.width * height) / layout.width);
  for (const src of [RAIL_SHADOW_SRC, RAIL_SRC]) {
    const image = loadImage(src);
    if (!image.img.naturalWidth) continue;
    ctx.drawImage(image.img, 0, 0, RAIL_SIZE.width, sourceHeight, 0, y, layout.width, height);
  }
}

/** One stroked ellipse per seat, where the chips would go. */
function drawBetCircles(ctx, layout) {
  ctx.save();
  ctx.strokeStyle = CIRCLE_COLOR;
  ctx.lineWidth = layout.width < 500 ? 2 : 4;
  ctx.globalAlpha = 0.7;
  for (const seat of layout.seats) {
    ctx.beginPath();
    ctx.ellipse(seat.circle.x, seat.circle.y, seat.circle.rx, seat.circle.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A hand's cards, drawn left to right so each one overlaps the one before. */
function drawHand(ctx, layout, hand, spanish) {
  const placed = [];
  hand.cards.forEach((card, index) => {
    const slot = cardSlot(layout, hand.key, index);
    if (slot) placed.push({ slot, card, faceUp: hand.faceUp[index] });
  });
  placed.sort((a, b) => a.slot.x - b.slot.x);
  for (const { slot, card, faceUp } of placed) {
    drawCard(ctx, faceUp ? card : 0, slot.x, slot.y, layout.cardWidth, layout.cardHeight, { spanish });
  }
}

function drawTray(ctx, layout, cards, onLoad) {
  if (!layout.tray) return;
  const { src } = trayPhoto(cards, layout.tray.silhouette);
  drawMasked(ctx, { photoSrc: src, maskSrc: trayMaskSrc(layout.tray.silhouette), ...layout.tray }, onLoad);
}

function drawShoe(ctx, layout, cards, onLoad) {
  if (!layout.shoe) return;
  const { src } = shoePhoto(cards);
  drawMasked(ctx, { photoSrc: src, maskSrc: SHOE_MASK_SRC, ...layout.shoe }, onLoad);
}

/** The pointing hand above the hand whose turn it is. */
function drawPointer(ctx, layout, { pointerHand, hands }) {
  if (!pointerHand) return;
  const hand = hands.find(h => h.key === pointerHand);
  const slot = cardSlot(layout, pointerHand, Math.max(0, (hand?.cards.length ?? 1) - 1));
  const pointer = loadImage(POINTER_SRC);
  if (!slot || !pointer.img.naturalWidth) return;
  ctx.drawImage(
    pointer.img,
    Math.round(slot.x + layout.cardWidth / 2 - POINTER_SIZE.width / 2),
    Math.round(slot.y - POINTER_SIZE.height),
    POINTER_SIZE.width, POINTER_SIZE.height,
  );
}
