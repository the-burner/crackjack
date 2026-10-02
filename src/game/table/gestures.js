// Swipe gestures on the felt, so the table can be played with the action
// buttons hidden: down = Hit, left = Stand, up = Double, right = Split, any
// diagonal = Surrender. While insurance is offered, vertical = Insure and
// horizontal = Pass.

/** A swipe shorter than this is a tap, not a gesture. */
export const MIN_SWIPE = 30;
/** How far from a diagonal a swipe may be and still count as one. */
const DIAGONAL_RATIO = 1.5;

/**
 * The action a swipe asks for.
 * @param {object} o
 * @param {number} o.dx          End x minus start x.
 * @param {number} o.dy          End y minus start y (down is positive).
 * @param {boolean} [o.insurance]  True while the insurance offer is up.
 * @param {number} [o.minDistance]
 * @returns {string|null} an ACTION value, 'insure', 'pass', or null for a tap
 */
export function swipeAction({ dx, dy, insurance = false, minDistance = MIN_SWIPE }) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  // Measure the real distance, so a short swipe is dropped whatever its
  // direction.
  if (Math.hypot(dx, dy) < minDistance) return null;
  if (ax < DIAGONAL_RATIO * ay && ay < DIAGONAL_RATIO * ax) return 'surrender';
  if (ax > ay) return insurance ? 'pass' : dx < 0 ? 'stand' : 'split';
  return insurance ? 'insure' : dy < 0 ? 'double' : 'hit';
}

/**
 * Reports swipes on an element. Returns a function that detaches the listeners.
 * @param {HTMLElement} el
 * @param {(action: string, event: PointerEvent) => void} onSwipe
 */
export function attachSwipes(el, onSwipe, { insurance = () => false } = {}) {
  let start = null;
  const down = event => { start = { x: event.clientX, y: event.clientY }; };
  const up = event => {
    if (!start) return;
    const action = swipeAction({ dx: event.clientX - start.x, dy: event.clientY - start.y, insurance: insurance() });
    start = null;
    if (action) onSwipe(action, event);
  };
  const cancel = () => { start = null; };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
