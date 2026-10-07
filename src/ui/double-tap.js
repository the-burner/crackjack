// Double-tap detection for the gesture areas (the table felt, the Flash cards).

/** Two taps at most this far apart in time... */
export const DOUBLE_TAP_MS = 300;
/** ...and in space count as a double tap. */
export const DOUBLE_TAP_DISTANCE = 30;

/**
 * Returns a function to call with each tap ({x, y, t} in pixels and ms); it
 * answers true when the tap completes a double tap. A third tap starts over.
 */
export function doubleTapDetector({ maxMs = DOUBLE_TAP_MS, maxDistance = DOUBLE_TAP_DISTANCE } = {}) {
  let last = null;
  return tap => {
    const double = last !== null && tap.t - last.t <= maxMs && Math.hypot(tap.x - last.x, tap.y - last.y) <= maxDistance;
    last = double ? null : tap;
    return double;
  };
}
