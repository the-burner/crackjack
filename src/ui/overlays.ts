// Modal overlays that sit above the screens (dialogs, the duration sheet).
//
// They live on document.body rather than inside a screen, so a back request has
// to dismiss the top one instead of closing the screen underneath it — which
// would leave the overlay covering the wrong screen, swallowing every tap.

/** Dismiss functions for the overlays now open, newest last. */
const open: (() => void)[] = [];

/**
 * Registers an open overlay. `dismiss` closes it as cancelling would.
 * Returns a function to call when it closes, however that happened.
 */
export function registerOverlay(dismiss: () => void): () => void {
  open.push(dismiss);
  return () => {
    const at = open.indexOf(dismiss);
    if (at >= 0) open.splice(at, 1);
  };
}

/**
 * Dismisses the overlay on top, if there is one; answers whether one was.
 */
export function dismissTopOverlay(): boolean {
  const dismiss = open[open.length - 1];
  if (!dismiss) return false;
  dismiss();
  return true;
}
