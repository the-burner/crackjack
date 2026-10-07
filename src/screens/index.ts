// Screen registry: every screen the router can open.

import type { Router } from '@/app/router';
import { homeScreen } from './home';
import { helpScreen } from './help';
import { registerSettingsScreens } from './settings/index';
import { registerStrategyScreens } from './strategy/index';
import { registerDrillScreens } from '@/drills/index';
import { registerGameScreens } from '@/game/index';

export function registerScreens(router: Router) {
  router.register('home', homeScreen).register('help', helpScreen);
  registerSettingsScreens(router);
  registerStrategyScreens(router);
  registerDrillScreens(router);
  registerGameScreens(router);
}
