// A screen's lifecycle, worked out from the router: a screen is showing while
// no child route (Stats over the table, say) and no help page covers it.

import { useLayoutEffect, useRef } from 'react';
import { useOutlet } from 'react-router';
import { useHelp } from '@/app/help';

/** Whether the screen this component belongs to is the one in view. */
export function useScreenShowing(): boolean {
  const covered = useOutlet() !== null;
  const help = useHelp();
  return !covered && help === null;
}

function useLatest<T>(value: T) {
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  });
  return latest;
}

/** Called each time the screen comes into view, including the first. */
export function useOnShow(fn: () => void) {
  const showing = useScreenShowing();
  const latest = useLatest(fn);
  useLayoutEffect(() => {
    if (showing) latest.current();
  }, [showing, latest]);
}

/** Called when something covers the screen, and when it closes. */
export function useOnHide(fn: () => void) {
  const showing = useScreenShowing();
  const latest = useLatest(fn);
  useLayoutEffect(() => {
    if (!showing) return;
    const ref = latest;
    return () => ref.current();
  }, [showing, latest]);
}
