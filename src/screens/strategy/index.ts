// Playing strategy, the strategy table viewer, true count calculations and
// betting strategies.

import type { Router } from '@/app/router';
import { playingStrategyScreen } from './playing-strategy';
import { strategyTablesScreen } from './tables';
import { trueCountScreen } from './true-count';
import { bettingScreen, betSelectScreen } from './betting';

export function registerStrategyScreens(router: Router): Router {
  return router
    .register('settings.strategy', playingStrategyScreen)
    .register('strategy.tables', strategyTablesScreen)
    .register('settings.trueCount', trueCountScreen)
    .register('settings.betting', bettingScreen)
    .register('settings.betting.select', betSelectScreen);
}
