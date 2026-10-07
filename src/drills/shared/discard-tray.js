// Discard-tray photographs, used by the Depth and Count drills to show how
// many decks have been dealt.
//
// The photos are stills of real trays at 1/4-deck steps (assets/trays/drill).
// Each tray style has its own series and crop.

/** Tray styles, in the order the options screen lists them. */
/**
 * `base` is the photograph of an empty tray; the numbers count down as it
 * fills, two per quarter deck. The original app's bases were one step low, so
 * every picture held a quarter deck more than the drill claimed and the deepest
 * step of two styles fell out of its own series. Corrected here on purpose.
 */
export const TRAY_STYLES = {
  eightDeckFront: { base: 303, crop: { width: 201, height: 332 }, minEmptyPercent: 0 },
  sixDeckFront: { base: 351, crop: { width: 201, height: 287 }, minEmptyPercent: 25 },
  doubleDeckFront: { base: 382, crop: { width: 186, height: 182 }, minEmptyPercent: 75 },
  sixDeckRear: { base: 431, crop: { width: 201, height: 277 }, minEmptyPercent: 25 },
  doubleDeckRear: { base: 447, crop: { width: 185, height: 188 }, minEmptyPercent: 75 },
};

const FALLBACK_STYLE = 'eightDeckFront';
const FIRST_IMAGE = 242;
/** The photos are of an eight-deck tray. */
const TRAY_CAPACITY_DECKS = 8;

/**
 * Picks the tray photo for `decksInTray`.
 *
 * Styles that only fit 2 or 6 decks fall back to the 8-deck tray's series when
 * more decks than they can hold would be shown; the crop stays that of the
 * chosen style.
 * @returns {{src: string, crop: {width: number, height: number}}|null} null when no photo can show that depth.
 */
export function trayImage(decksInTray, style) {
  const emptyPercent = (100 / TRAY_CAPACITY_DECKS) * (TRAY_CAPACITY_DECKS - decksInTray);
  const chosen = TRAY_STYLES[style] ?? TRAY_STYLES[FALLBACK_STYLE];
  const series = emptyPercent <= chosen.minEmptyPercent ? TRAY_STYLES[FALLBACK_STYLE] : chosen;
  const quarterDecksInTray = Math.floor((100 - emptyPercent) / (100 / (TRAY_CAPACITY_DECKS * 4)));
  const number = series.base - 2 * quarterDecksInTray;
  if (number < FIRST_IMAGE) return null;
  return { src: `assets/trays/drill/${number}.jpg`, crop: chosen.crop };
}

/** The deepest depth a style can show, in decks (used to validate options). */
export function maxDecksInTray(style) {
  for (let decks = TRAY_CAPACITY_DECKS; decks > 0; decks -= 0.25) {
    if (trayImage(decks, style)) return decks;
  }
  return 0;
}

const cache = new Map();

/** Loads a tray photo (cached). */
export function loadTrayImage(src) {
  if (!cache.has(src)) {
    const img = new Image();
    img.src = src;
    cache.set(src, img);
  }
  return cache.get(src);
}

/**
 * Draws a tray photo centred in the given box, scaled to fit.
 * `thicknessPercent` (100-110) stretches the cards vertically, as thicker cards
 * fill more of the tray.
 */
export function drawTray(ctx, image, { x, y, width, height }, crop, thicknessPercent = 100) {
  const sourceHeight = crop.height;
  const scale = Math.min(width / crop.width, height / (sourceHeight * (thicknessPercent / 100)));
  const drawWidth = crop.width * scale;
  const drawHeight = sourceHeight * (thicknessPercent / 100) * scale;
  ctx.drawImage(image, 0, 0, crop.width, sourceHeight,
    x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}
