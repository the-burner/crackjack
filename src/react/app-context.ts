// The app's services, for React components.

import { createContext, useContext, useSyncExternalStore } from 'react';
import type { App } from '@/app/app';
import type { AppSettings } from '@/settings/schema';

export const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp() needs a screen built by reactScreen()');
  return app;
}

/**
 * A counter bumped on every settings change, as the snapshot React compares:
 * `get()` copies json values, so the values themselves would never compare equal.
 */
const versions = new WeakMap<AppSettings, number>();

function versionOf(settings: AppSettings): number {
  if (!versions.has(settings)) {
    versions.set(settings, 0);
    // Subscribed first and for good, so the count moves before any component hears of the change.
    settings.subscribe(() => versions.set(settings, (versions.get(settings) ?? 0) + 1));
  }
  return versions.get(settings) ?? 0;
}

/** The settings, re-rendering the component whenever any of them changes. */
export function useSettings(): AppSettings {
  const { settings } = useApp();
  versionOf(settings);
  useSyncExternalStore(
    onChange => settings.subscribe(onChange),
    () => versionOf(settings),
  );
  return settings;
}
