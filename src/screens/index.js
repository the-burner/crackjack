// Screen registry: every screen the router can open.

import { homeScreen } from './home.js';
import { helpScreen } from './help.js';
import { registerSettingsScreens } from './settings/index.js';
import { registerStrategyScreens } from './strategy/index.js';
import { registerDrillScreens } from '../drills/index.js';
import { registerGameScreens } from '../game/index.js';

export function registerScreens(router) {
  router.register('home', homeScreen).register('help', helpScreen);
  registerSettingsScreens(router);
  registerStrategyScreens(router);
  registerDrillScreens(router);
  registerGameScreens(router);
}
