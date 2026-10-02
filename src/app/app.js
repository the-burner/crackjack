// Application services shared by every screen.

import { Storage } from '../services/storage.js';
import { Sound } from '../services/sound.js';
import { Settings } from '../settings/store.js';
import { SETTINGS_SCHEMA } from '../settings/schema.js';
import { StrategyLibrary } from '../settings/strategies.js';
import { Router } from './router.js';

export function createApp(root, { backend } = {}) {
  const app = {};
  app.storage = new Storage(backend);
  app.settings = new Settings(SETTINGS_SCHEMA, app.storage);
  app.strategies = new StrategyLibrary(app.storage);
  app.sound = new Sound(app.settings);
  app.router = new Router(root, app);
  /** Opens the help page for a screen. */
  app.help = topic => app.router.open('help', { topic });
  app.open = (name, params) => app.router.open(name, params);
  app.back = () => app.router.back();
  return app;
}
