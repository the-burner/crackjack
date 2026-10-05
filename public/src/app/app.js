// Application services shared by every screen.

import { Storage } from '../services/storage.js';
import { Sound } from '../services/sound.js';
import { Settings } from '../settings/store.js';
import { SETTINGS_SCHEMA } from '../settings/schema.js';
import { StrategyLibrary } from '../settings/strategies.js';
import { Router } from './router.js';
import { dismissTopOverlay } from '../ui/overlays.js';
import { ErrorTallies } from '../services/error-tallies.js';

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
