// The blackjack game: the table and the screens reached from it.

import { tableScreen } from './screens/table.ts';
import { betSelectScreen } from './screens/bet-select.tsx';
import { gameStatsScreen } from './screens/stats.tsx';
import type { Router } from '../app/router.ts';

export function registerGameScreens(router: Router): Router {
  return router
    .register('game.table', tableScreen)
    .register('game.betSelect', betSelectScreen)
    .register('game.stats', gameStatsScreen);
}
