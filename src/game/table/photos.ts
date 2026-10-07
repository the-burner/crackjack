// @ts-nocheck
// The discard-tray and shoe photographs on the table.
//
// Both are stills of real equipment: one photo per depth. The photo is a plain
// rectangle, so a silhouette mask cuts the tray (or shoe) out of it and the
// felt shows through around it.

/** Lowest and highest photo in each discard-tray series. */
const TRAY_SERIES = {
  '8deck': { full: 242, empty: 303 },
  '6deck': { full: 304, empty: 351 },
  '2deck': { full: 366, empty: 382 },
};
/** Cards one photo step represents. */
const CARDS_PER_STEP = 6.5;
const SHOE_EMPTY = 180;
const SHOE_FULLEST = 145;
/** Cards one shoe photo step represents. */
const CARDS_PER_SHOE_STEP = 13;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * The discard-tray photo for a tray holding `cards` cards.
 * @param {number} cards
 * @param {string} silhouette  '8deck', '6deck' or '2deck' (see traySilhouette).
 * @returns {{src: string, number: number}}
 */
export function trayPhoto(cards, silhouette) {
  const series = TRAY_SERIES[silhouette] ?? TRAY_SERIES['6deck'];
  const number =
    cards <= 0
      ? series.empty
      : clamp(series.empty - 1 - Math.floor(cards / CARDS_PER_STEP), series.full, series.empty - 1);
  return { number, src: `assets/trays/table/${number}.jpg` };
}

/**
 * The shoe photo for a shoe holding `cards` cards. 180 is an empty shoe.
 * @returns {{src: string, number: number}}
 */
export function shoePhoto(cards) {
  const number =
    cards <= 0 ? SHOE_EMPTY : clamp(SHOE_EMPTY - Math.floor(cards / CARDS_PER_SHOE_STEP), SHOE_FULLEST, SHOE_EMPTY - 1);
  return { number, src: `assets/shoe/${number}.jpg` };
}

/** Mask that is opaque inside the tray silhouette. */
export const trayMaskSrc = silhouette => `assets/trays/table/mask-${silhouette}-inside.png`;
/** Mask that is opaque inside the shoe silhouette. */
export const SHOE_MASK_SRC = 'assets/shoe/mask-inside.png';

const images = new Map();

/** Loads an image once and remembers it. Resolves even when the file is missing. */
export function loadImage(src) {
  if (!images.has(src)) {
    const img = new Image();
    const ready = new Promise(resolve => {
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => resolve(null), { once: true });
    });
    img.src = src;
    images.set(src, { img, ready: img.complete ? Promise.resolve(img) : ready });
  }
  return images.get(src);
}

/** True when the image has loaded and can be drawn. */
const isReady = src => Boolean(images.get(src)?.img.naturalWidth);

/**
 * Draws `photoSrc` clipped to `maskSrc` into the given rectangle. Nothing is
 * drawn until both images are loaded; `onLoad` runs when they arrive.
 * @returns {boolean} whether anything was drawn
 */
export function drawMasked(ctx, { photoSrc, maskSrc, x, y, width, height }, onLoad) {
  const photo = loadImage(photoSrc);
  const mask = loadImage(maskSrc);
  if (!isReady(photoSrc) || !isReady(maskSrc)) {
    Promise.all([photo.ready, mask.ready]).then(() => onLoad?.());
    return false;
  }
  const buffer = scratch(width, height);
  buffer.ctx.clearRect(0, 0, width, height);
  buffer.ctx.globalCompositeOperation = 'source-over';
  buffer.ctx.drawImage(photo.img, 0, 0, width, height);
  buffer.ctx.globalCompositeOperation = 'destination-in';
  buffer.ctx.drawImage(mask.img, 0, 0, width, height);
  ctx.drawImage(buffer.canvas, 0, 0, width, height, x, y, width, height);
  return true;
}

let buffer = null;

/** A shared offscreen canvas for masking, grown as needed. */
function scratch(width, height) {
  if (!buffer) {
    const canvas = document.createElement('canvas');
    buffer = { canvas, ctx: canvas.getContext('2d') };
  }
  if (buffer.canvas.width < width || buffer.canvas.height < height) {
    buffer.canvas.width = Math.ceil(width);
    buffer.canvas.height = Math.ceil(height);
  }
  return buffer;
}
