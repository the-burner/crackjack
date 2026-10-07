// Drawing cards from the sprite sheet (assets/cards/cards.png): a 14 x 4 grid
// of 150 x 215 cells. Rows are spades, clubs, hearts, diamonds; columns 0..12
// are A..K and column 13 holds a joker, two card backs and the cut card.

import { suitOf, rankOf } from '@/core/cards';

export const CARD_WIDTH = 150;
export const CARD_HEIGHT = 215;
export const CARD_ASPECT = CARD_WIDTH / CARD_HEIGHT;

let sheet: HTMLImageElement | null = null;
let back: HTMLImageElement | null = null;

function loadImage(src: string): HTMLImageElement {
  const img = new Image();
  img.src = src;
  return img;
}

function images(): { sheet: HTMLImageElement; back: HTMLImageElement } {
  sheet ??= loadImage('assets/cards/cards.png');
  back ??= loadImage('assets/cards/card-back.png');
  return { sheet, back };
}

/** Starts loading the card images; resolves when both are ready. */
export function loadCardImages(): Promise<void[]> {
  const { sheet, back } = images();
  return Promise.all([sheet, back].map(img => (img.complete ? Promise.resolve() : img.decode().catch(() => {}))));
}

/** Width of a card drawn `height` pixels tall. */
export const cardWidthFor = (height: number): number => Math.floor((height * CARD_WIDTH) / CARD_HEIGHT);

/**
 * Draws a card. `id` 1..52 draws the face; 0 draws the back; 'cut' draws the cut card.
 * `spanish`: Spanish decks have no 10s: show a queen instead.
 */
export function drawCard(
  ctx: CanvasRenderingContext2D,
  id: number | 'cut',
  x: number,
  y: number,
  width: number,
  height: number,
  { spanish = false }: { spanish?: boolean } = {},
): void {
  loadCardImages();
  const { sheet, back } = images();
  if (id === 0) {
    ctx.drawImage(back, 0, 0, CARD_WIDTH, CARD_HEIGHT, x, y, width, height);
    return;
  }
  let col;
  let row;
  if (id === 'cut') {
    col = 13;
    row = 3;
  } else {
    col = rankOf(id) - 1;
    row = suitOf(id);
    if (spanish && col === 9) col = 11;
  }
  ctx.drawImage(sheet, col * CARD_WIDTH, row * CARD_HEIGHT, CARD_WIDTH, CARD_HEIGHT, x, y, width, height);
}

/**
 * Sizes a canvas's backing store for the device pixel ratio and returns its
 * 2D context scaled so drawing uses CSS pixels.
 */
export function setupCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
  const ratio = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}
