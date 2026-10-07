// Playing strategy, the strategy table viewer, true count calculations and
// betting strategies.

import { playingStrategyScreen } from './playing-strategy.js';
import { strategyTablesScreen } from './tables.js';
import { trueCountScreen } from './true-count.js';
import { bettingScreen, betSelectScreen } from './betting.js';

export function registerStrategyScreens(router) {
  return router
    .register('settings.strategy', playingStrategyScreen)
    .register('strategy.tables', strategyTablesScreen)
    .register('settings.trueCount', trueCountScreen)
    .register('settings.betting', bettingScreen)
    .register('settings.betting.select', betSelectScreen);
}
