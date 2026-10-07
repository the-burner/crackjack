// @ts-nocheck
// Screen registry: every screen the router can open.

import { homeScreen } from './home.ts';
import { helpScreen } from './help.ts';
import { registerSettingsScreens } from './settings/index.ts';
import { registerStrategyScreens } from './strategy/index.ts';
import { registerDrillScreens } from '../drills/index.ts';
import { registerGameScreens } from '../game/index.ts';

export function registerScreens(router) {
  router.register('home', homeScreen).register('help', helpScreen);
  registerSettingsScreens(router);
  registerStrategyScreens(router);
  registerDrillScreens(router);
  registerGameScreens(router);
}
