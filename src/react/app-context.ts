// The app's services, for React components.

import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { App } from '@/app/app';
import type { AppSettings, SettingKey, SettingValues } from '@/settings/schema';

export const AppContext = createContext<App | null>(null);

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('useApp() needs the app provider');
  return app;
}

/** One setting's value; the component re-renders when it changes. */
export function useSetting<K extends SettingKey>(key: K): SettingValues[K] {
  const { settings } = useApp();
  return useStore(settings.store, state => state.values[key]);
}

/** The settings, re-rendering the component whenever any of them changes. */
export function useSettings(): AppSettings {
  const { settings } = useApp();
  useStore(settings.store, state => state.values);
  return settings;
}
