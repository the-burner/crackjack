// The blackjack game: the table and the screens reached from it.

import { tableScreen } from './screens/table';
import { betSelectScreen } from './screens/bet-select';
import { gameStatsScreen } from './screens/stats';
import type { Router } from '@/app/router';

export function registerGameScreens(router: Router): Router {
  return router
    .register('game.table', tableScreen)
    .register('game.betSelect', betSelectScreen)
    .register('game.stats', gameStatsScreen);
}
