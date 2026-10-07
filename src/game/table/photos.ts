// The discard-tray and shoe photographs on the table.
//
// Both are stills of real equipment: one photo per depth. The photo is a plain
// rectangle, so a silhouette mask cuts the tray (or shoe) out of it and the
// felt shows through around it.

/** Lowest and highest photo in each discard-tray series. */
const TRAY_SERIES: Record<string, { full: number; empty: number }> = {
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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A photograph in one of the series, by number. */
export interface Photo {
  src: string;
  number: number;
}

/**
 * The discard-tray photo for a tray holding `cards` cards.
 * @param silhouette  '8deck', '6deck' or '2deck' (see traySilhouette).
 */
export function trayPhoto(cards: number, silhouette: string): Photo {
  const series = TRAY_SERIES[silhouette] ?? TRAY_SERIES['6deck'];
  const number =
    cards <= 0
      ? series.empty
      : clamp(series.empty - 1 - Math.floor(cards / CARDS_PER_STEP), series.full, series.empty - 1);
  return { number, src: `assets/trays/table/${number}.jpg` };
}

/** The shoe photo for a shoe holding `cards` cards. 180 is an empty shoe. */
export function shoePhoto(cards: number): Photo {
  const number =
    cards <= 0 ? SHOE_EMPTY : clamp(SHOE_EMPTY - Math.floor(cards / CARDS_PER_SHOE_STEP), SHOE_FULLEST, SHOE_EMPTY - 1);
  return { number, src: `assets/shoe/${number}.jpg` };
}

/** Mask that is opaque inside the tray silhouette. */
export const trayMaskSrc = (silhouette: string): string => `assets/trays/table/mask-${silhouette}-inside.png`;
/** Mask that is opaque inside the shoe silhouette. */
export const SHOE_MASK_SRC = 'assets/shoe/mask-inside.png';

/** An image and a promise of it: null when the file is missing. */
export interface LoadedImage {
  img: HTMLImageElement;
  ready: Promise<HTMLImageElement | null>;
}

const images = new Map<string, LoadedImage>();

/** Loads an image once and remembers it. Resolves even when the file is missing. */
export function loadImage(src: string): LoadedImage {
  let loaded = images.get(src);
  if (!loaded) {
    const img = new Image();
    const ready = new Promise<HTMLImageElement | null>(resolve => {
      img.addEventListener('load', () => resolve(img), { once: true });
      img.addEventListener('error', () => resolve(null), { once: true });
    });
    img.src = src;
    loaded = { img, ready: img.complete ? Promise.resolve(img) : ready };
    images.set(src, loaded);
  }
  return loaded;
}

/** True when the image has loaded and can be drawn. */
const isReady = (src: string) => Boolean(images.get(src)?.img.naturalWidth);

/**
 * Draws `photoSrc` clipped to `maskSrc` into the given rectangle. Nothing is
 * drawn until both images are loaded; `onLoad` runs when they arrive.
 * @returns {boolean} whether anything was drawn
 */
/** The photo pairs each redraw callback is already waiting on, so a frame drawn while they load adds no more. */
const waiting = new WeakMap<() => void, Set<string>>();

export function drawMasked(
  ctx: CanvasRenderingContext2D,
  {
    photoSrc,
    maskSrc,
    x,
    y,
    width,
    height,
  }: { photoSrc: string; maskSrc: string; x: number; y: number; width: number; height: number },
  onLoad?: () => void,
): boolean {
  const photo = loadImage(photoSrc);
  const mask = loadImage(maskSrc);
  if (!isReady(photoSrc) || !isReady(maskSrc)) {
    if (onLoad) {
      const pairs = waiting.get(onLoad) ?? new Set<string>();
      waiting.set(onLoad, pairs);
      const pair = `${photoSrc} ${maskSrc}`;
      if (!pairs.has(pair)) {
        pairs.add(pair);
        Promise.all([photo.ready, mask.ready]).then(() => {
          pairs.delete(pair);
          onLoad();
        });
      }
    }
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

let buffer: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;

/** A shared offscreen canvas for masking, grown as needed. */
function scratch(width: number, height: number) {
  if (!buffer) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas context');
    buffer = { canvas, ctx };
  }
  if (buffer.canvas.width < width || buffer.canvas.height < height) {
    buffer.canvas.width = Math.ceil(width);
    buffer.canvas.height = Math.ceil(height);
  }
  return buffer;
}
