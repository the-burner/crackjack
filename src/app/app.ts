// @ts-nocheck
// Application services shared by every screen.

import { Storage } from '../services/storage.ts';
import { Sound } from '../services/sound.ts';
import { Settings } from '../settings/store.ts';
import { SETTINGS_SCHEMA } from '../settings/schema.ts';
import { StrategyLibrary } from '../settings/strategies.ts';
import { Router } from './router.ts';
import { dismissTopOverlay } from '../ui/overlays.ts';
import { ErrorTallies } from '../services/error-tallies.ts';

/**
 * The services that do not need a DOM: storage, settings, strategies, sound
 * and the error tallies. Used by the app and by tests.
 */
export function createServices({ backend } = {}) {
  const app = {};
  app.storage = new Storage(backend);
  app.settings = new Settings(SETTINGS_SCHEMA, app.storage);
  app.strategies = new StrategyLibrary();
  app.sound = new Sound(app.settings);
  app.errorTallies = new ErrorTallies(app.storage);
  return app;
}

export function createApp(root, { backend } = {}) {
  const app = createServices({ backend });
  app.router = new Router(root, app, { dismissOverlay: dismissTopOverlay });
  /** Opens the help page for a screen. */
  app.help = (topic, title) => app.router.open('help', { topic, title });
  app.open = (name, params) => app.router.open(name, params);
  app.back = () => app.router.back();
  return app;
}
