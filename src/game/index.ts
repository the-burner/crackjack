// @ts-nocheck
// The blackjack game: the table and the screens reached from it.

import { tableScreen } from './screens/table.ts';
import { betSelectScreen } from './screens/bet-select.ts';
import { gameStatsScreen } from './screens/stats.ts';

export function registerGameScreens(router) {
  return router
    .register('game.table', tableScreen)
    .register('game.betSelect', betSelectScreen)
    .register('game.stats', gameStatsScreen);
}
