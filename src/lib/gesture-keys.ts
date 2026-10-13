// The gestures from a keyboard, or a remote that types keys: each gesture's key (Settings → Gestures).

import { gestureOfKey } from '@/core/gestures';
import type { Gesture, KeyMap } from '@/core/gestures';

/** Keys typed here are theirs: a field, a select, a dialog. */
const NOT_GESTURES = 'input, select, textarea, [contenteditable], [role="dialog"], [role="alertdialog"]';

/** Reports the gestures made on the keyboard, by the keys `keys` gives; returns a function that stops. */
export function attachGestureKeys(keys: () => KeyMap, onGesture: (gesture: Gesture) => void): () => void {
  const down = (event: KeyboardEvent) => {
    const gesture = gestureOfKey(event, keys());
    if (!gesture || event.repeat) return;
    if (event.target instanceof Element && event.target.closest(NOT_GESTURES)) return;
    event.preventDefault();
    onGesture(gesture);
  };
  window.addEventListener('keydown', down);
  return () => window.removeEventListener('keydown', down);
}
