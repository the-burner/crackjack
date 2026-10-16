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
import { persistedStore } from '@/services/persisted-store';
import type { PersistedStore } from '@/services/persisted-store';
import { readBankroll, readStats } from '@/game/record';
import type { GameStats } from '@/game/record';
import { readGestureConfigs } from '@/settings/gesture-configs';
import type { GestureConfig } from '@/core/gestures';
import { readBettingStrategies } from '@/settings/betting-strategies';
import type { BettingStrategy } from '@/settings/betting-strategies';
import { DRILL_SETS, GAME_SETS } from '@/settings/setting-sets';
import type { DrillName, SettingSet } from '@/settings/setting-sets';

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
  /** Gesture configurations the player saved. */
  gestureConfigs: PersistedStore<GestureConfig[]>;
  /** Betting strategies the player saved. */
  bettingStrategies: PersistedStore<BettingStrategy[]>;
  /** Game configurations the player saved. */
  gameConfigs: PersistedStore<SettingSet[]>;
  /** Each drill's configurations the player saved. */
  drillConfigs: Record<DrillName, PersistedStore<SettingSet[]>>;
  /** Starts the app over from its home screen, reading everything saved afresh. */
  restart: () => void;
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
    gestureConfigs: persistedStore(storage, 'gestureConfigs', readGestureConfigs),
    bettingStrategies: persistedStore(storage, 'bettingStrategies', readBettingStrategies),
    gameConfigs: persistedStore(storage, 'gameConfigs', GAME_SETS.read),
    drillConfigs: {
      flash: persistedStore(storage, 'flashConfigs', DRILL_SETS.flash.read),
      depth: persistedStore(storage, 'depthConfigs', DRILL_SETS.depth.read),
      count: persistedStore(storage, 'countConfigs', DRILL_SETS.count.read),
      full: persistedStore(storage, 'fullConfigs', DRILL_SETS.full.read),
    },
    // The page without its route: the home screen.
    restart: () => location.replace(location.pathname),
  };
}
