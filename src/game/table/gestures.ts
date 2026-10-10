// Gestures on the felt: the four swipes and a double tap (core/gestures), so
// the table can be played with the action buttons hidden or from a remote.
// Which play each makes is the player's mapping (Settings → Gestures).
import { doubleTapDetector } from '@/lib/double-tap';
import { MIN_SWIPE, swipeOf } from '@/core/gestures';
import type { Gesture } from '@/core/gestures';

/**
 * Reports swipes and double taps on an element. Taps on buttons and the bet
 * panel are theirs, not gestures. Returns a function that detaches the listeners.
 */
export function attachGestures(
  el: HTMLElement,
  onGesture: (gesture: Gesture, event: PointerEvent) => void,
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
      if (event.target instanceof Element && event.target.closest('button, [data-slot="bet-overlay"]')) return;
      if (doubleTap({ x: event.clientX, y: event.clientY, t: event.timeStamp })) onGesture('doubleTap', event);
      return;
    }
    const swipe = swipeOf({ dx, dy });
    if (swipe) onGesture(swipe, event);
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
