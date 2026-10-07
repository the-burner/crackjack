// Settings screens: the hub and the option screens it opens.

import type { Router } from '@/app/router';
import { settingsHubScreen } from './hub';
import { setupScreen } from './setup';
import { commonRulesScreen } from './common-rules';
import { ruleVariationsScreen } from './rule-variations';
import { mechanicsScreen } from './mechanics';
import { bonusesScreen } from './bonuses';
import { playVariationsScreen } from './play-variations';
import { unusualGamesScreen } from './unusual-games';
import { dealerErrorsScreen } from './dealer-errors';
import { peekingScreen } from './peeking';
import { appearanceScreen } from './appearance';

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
