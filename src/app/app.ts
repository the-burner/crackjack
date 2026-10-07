// Application services shared by every screen.

import { Storage } from '../services/storage.ts';
import type { StorageBackend } from '../services/storage.ts';
import { Sound } from '../services/sound.ts';
import { Settings } from '../settings/store.ts';
import { SETTINGS_SCHEMA } from '../settings/schema.ts';
import type { AppSettings } from '../settings/schema.ts';
import { StrategyLibrary } from '../settings/strategies.ts';
import { Router } from './router.ts';
import type { Screen, ScreenParams } from './router.ts';
import { dismissTopOverlay } from '../ui/overlays.ts';
import { ErrorTallies } from '../services/error-tallies.ts';

export type { Screen, ScreenFactory, ScreenParams } from './router.ts';

/** The services that do not need a DOM. */
export interface Services {
  storage: Storage;
  settings: AppSettings;
  strategies: StrategyLibrary;
  sound: Sound;
  errorTallies: ErrorTallies;
}

/** The services plus navigation: what every screen factory receives. */
export interface App extends Services {
  readonly router: Router;
  /** Opens the help page for a screen. */
  help(topic: string, title?: string): Screen;
  open(name: string, params?: ScreenParams): Screen;
  back(): boolean;
}

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
  };
}

export function createApp(root: HTMLElement, { backend }: { backend?: StorageBackend } = {}): App {
  // The router needs the app, and the app hands out the router.
  const app: App = {
    ...createServices({ backend }),
    get router() {
      return router;
    },
    help: (topic, title) => router.open('help', { topic, title }),
    open: (name, params) => router.open(name, params),
    back: () => router.back(),
  };
  const router = new Router(root, app, { dismissOverlay: dismissTopOverlay });
  return app;
}
