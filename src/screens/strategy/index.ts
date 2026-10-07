// @ts-nocheck
// Playing strategy, the strategy table viewer, true count calculations and
// betting strategies.

import { playingStrategyScreen } from './playing-strategy.ts';
import { strategyTablesScreen } from './tables.ts';
import { trueCountScreen } from './true-count.ts';
import { bettingScreen, betSelectScreen } from './betting.ts';

export function registerStrategyScreens(router) {
  return router
    .register('settings.strategy', playingStrategyScreen)
    .register('strategy.tables', strategyTablesScreen)
    .register('settings.trueCount', trueCountScreen)
    .register('settings.betting', bettingScreen)
    .register('settings.betting.select', betSelectScreen);
}
