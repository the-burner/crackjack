// Settings screens: the hub and the option screens it opens.

import type { Router } from '../../app/router.ts';
import { settingsHubScreen } from './hub.tsx';
import { setupScreen } from './setup.tsx';
import { commonRulesScreen } from './common-rules.tsx';
import { ruleVariationsScreen } from './rule-variations.tsx';
import { mechanicsScreen } from './mechanics.tsx';
import { bonusesScreen } from './bonuses.tsx';
import { playVariationsScreen } from './play-variations.tsx';
import { unusualGamesScreen } from './unusual-games.tsx';
import { dealerErrorsScreen } from './dealer-errors.tsx';
import { peekingScreen } from './peeking.tsx';
import { appearanceScreen } from './appearance.tsx';

export function registerSettingsScreens(router: Router) {
  return router
    .register('settings', settingsHubScreen)
    .register('settings.setup', setupScreen)
    .register('settings.commonRules', commonRulesScreen)
    .register('settings.ruleVariations', ruleVariationsScreen)
    .register('settings.mechanics', mechanicsScreen)
    .register('settings.bonuses', bonusesScreen)
    .register('settings.playVariations', playVariationsScreen)
    .register('settings.unusualGames', unusualGamesScreen)
    .register('settings.dealerErrors', dealerErrorsScreen)
    .register('settings.peeking', peekingScreen)
    .register('settings.appearance', appearanceScreen);
}
