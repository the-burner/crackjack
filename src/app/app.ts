// Application services shared by every screen.

import { Storage } from '@/services/storage';
import type { StorageBackend } from '@/services/storage';
import { Sound } from '@/services/sound';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { AppSettings } from '@/settings/schema';
import { StrategyLibrary } from '@/settings/strategies';
import { ErrorTallies } from '@/services/error-tallies';
import { ScreenWakeLock } from '@/services/wake-lock';
import { INSTALL_HINT_KEY } from '@/lib/install-hint';
import { persistedStore } from '@/services/persisted-store';
import type { PersistedStore } from '@/services/persisted-store';
import { readBankroll, readStats } from '@/game/record';
import type { GameStats } from '@/game/record';

/** The services that do not need a DOM. */
export interface Services {
  storage: Storage;
  settings: AppSettings;
  strategies: StrategyLibrary;
  sound: Sound;
  errorTallies: ErrorTallies;
  /** Keeps the screen on during drills and play. */
  wakeLock: ScreenWakeLock;
  /** The table's bankroll between visits; null before the first round. */
  bankroll: PersistedStore<number | null>;
  gameStats: PersistedStore<GameStats>;
  /** The iOS install hint was dismissed. */
  installHintDismissed: PersistedStore<boolean>;
}

/** What every screen reads through useApp(): the services. Navigation is React Router's. */
export type App = Services;

/**
 * The services that do not need a DOM: storage, settings, strategies, sound
 * and the error tallies. Used by the app and by tests.
 */
export function createServices({ backend }: { backend?: StorageBackend } = {}): Services {
  const storage = new Storage(backend);
  const settings = new Settings(SETTINGS_SCHEMA, storage);
  return {
    storage,
    settings,
    strategies: new StrategyLibrary(),
    sound: new Sound(settings),
    errorTallies: new ErrorTallies(storage),
    wakeLock: new ScreenWakeLock(),
    bankroll: persistedStore(storage, 'bankroll', readBankroll),
    gameStats: persistedStore(storage, 'gameStats', readStats),
    installHintDismissed: persistedStore(storage, INSTALL_HINT_KEY, saved => saved === true),
  };
}
