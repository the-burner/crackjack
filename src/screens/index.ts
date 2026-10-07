// Screen registry: every screen the router can open.

import type { Router } from '../app/router.ts';
import { homeScreen } from './home.tsx';
import { helpScreen } from './help.tsx';
import { registerSettingsScreens } from './settings/index.ts';
import { registerStrategyScreens } from './strategy/index.ts';
import { registerDrillScreens } from '../drills/index.ts';
import { registerGameScreens } from '../game/index.ts';

export function registerScreens(router: Router) {
  router.register('home', homeScreen).register('help', helpScreen);
  registerSettingsScreens(router);
  registerStrategyScreens(router);
  registerDrillScreens(router);
  registerGameScreens(router);
}
