// Playing strategy, the strategy table viewer, true count calculations and
// betting strategies.

import type { Router } from '../../app/router.ts';
import { playingStrategyScreen } from './playing-strategy.tsx';
import { strategyTablesScreen } from './tables.tsx';
import { trueCountScreen } from './true-count.tsx';
import { bettingScreen, betSelectScreen } from './betting.tsx';

export function registerStrategyScreens(router: Router): Router {
  return router
    .register('settings.strategy', playingStrategyScreen)
    .register('strategy.tables', strategyTablesScreen)
    .register('settings.trueCount', trueCountScreen)
    .register('settings.betting', bettingScreen)
    .register('settings.betting.select', betSelectScreen);
}
