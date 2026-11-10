// Whether the device is held upright (portrait), following it as it turns.

import { useSyncExternalStore } from 'react';

const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(orientation: portrait)') : null);

function subscribe(changed: () => void) {
  const media = query();
  media?.addEventListener('change', changed);
  return () => media?.removeEventListener('change', changed);
}

export const useUpright = (): boolean => useSyncExternalStore(subscribe, () => query()?.matches ?? false);
