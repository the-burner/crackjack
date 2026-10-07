// Gestures on the felt, so the table can be played with the action buttons
// hidden: swipe down = Hit, left = Stand, up = Double, right = Split, and a
// double tap = Surrender. While insurance is offered, vertical = Insure and
// horizontal = Pass. Diagonal swipes mean nothing.

import { doubleTapDetector } from '@/ui/double-tap';
import type { GameAction } from '@/game/engine/game';

/** What a gesture asks for: a play, or an answer to the insurance offer. */
export type SwipeAction = GameAction | 'insure' | 'pass';

/** A swipe shorter than this is a tap, not a gesture. */
export const MIN_SWIPE = 30;
/** How far from a diagonal a swipe may be and still count as one (and be ignored). */
const DIAGONAL_RATIO = 1.5;

/**
 * The action a swipe asks for.
 * @param dx  End x minus start x.
 * @param dy  End y minus start y (down is positive).
 * @param insurance  True while the insurance offer is up.
 * @returns an ACTION value, 'insure', 'pass', or null for a tap
 */
export function swipeAction({
  dx,
  dy,
  insurance = false,
  minDistance = MIN_SWIPE,
}: {
  dx: number;
  dy: number;
  insurance?: boolean;
  minDistance?: number;
}): Exclude<SwipeAction, 'surrender'> | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Measure the real distance, so a short swipe is dropped whatever its
  // direction.
  if (Math.hypot(dx, dy) < minDistance) return null;
  if (ax < DIAGONAL_RATIO * ay && ay < DIAGONAL_RATIO * ax) return null;
  if (ax > ay) return insurance ? 'pass' : dx < 0 ? 'stand' : 'split';
  return insurance ? 'insure' : dy < 0 ? 'double' : 'hit';
}

/**
 * Reports swipes and double taps on an element. Taps on buttons and the bet
 * panel are theirs, not gestures. Returns a function that detaches the listeners.
 */
export function attachSwipes(
  el: HTMLElement,
  onSwipe: (action: SwipeAction, event: PointerEvent) => void,
  { insurance = () => false }: { insurance?: () => boolean } = {},
): () => void {
  let start: { x: number; y: number } | null = null;
  const doubleTap = doubleTapDetector();
  const down = (event: PointerEvent) => {
    start = { x: event.clientX, y: event.clientY };
  };
  const up = (event: PointerEvent) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.hypot(dx, dy) < MIN_SWIPE) {
      if (event.target instanceof Element && event.target.closest('button, .bet-overlay')) return;
      if (doubleTap({ x: event.clientX, y: event.clientY, t: event.timeStamp })) onSwipe('surrender', event);
      return;
    }
    const action = swipeAction({ dx, dy, insurance: insurance() });
    if (action) onSwipe(action, event);
  };
  const cancel = () => {
    start = null;
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
