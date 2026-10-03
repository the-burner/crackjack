// Playing strategy, the strategy table viewer, strategy import, true count
// calculations, betting strategies and the casino database.

import { playingStrategyScreen } from './playing-strategy.js';
import { strategyTablesScreen } from './tables.js';
import { importStrategyScreen } from './import.js';
import { trueCountScreen } from './true-count.js';
import { bettingScreen, betSelectScreen } from './betting.js';
import { casinoDbScreen, casinoDetailScreen } from './casino-db.js';

export function registerStrategyScreens(router) {
  return router
    .register('settings.strategy', playingStrategyScreen)
    .register('strategy.tables', strategyTablesScreen)
    .register('strategy.import', importStrategyScreen)
    .register('settings.trueCount', trueCountScreen)
    .register('settings.betting', bettingScreen)
    .register('settings.betting.select', betSelectScreen)
    .register('settings.casinoDb', casinoDbScreen)
    .register('settings.casinoDetail', casinoDetailScreen);
}
