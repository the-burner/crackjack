// @ts-nocheck
// Settings screens: the hub and the option screens it opens.

import { settingsHubScreen } from './hub.ts';
import { setupScreen } from './setup.ts';
import { commonRulesScreen } from './common-rules.ts';
import { ruleVariationsScreen } from './rule-variations.ts';
import { mechanicsScreen } from './mechanics.ts';
import { bonusesScreen } from './bonuses.ts';
import { playVariationsScreen } from './play-variations.ts';
import { unusualGamesScreen } from './unusual-games.ts';
import { dealerErrorsScreen } from './dealer-errors.ts';
import { peekingScreen } from './peeking.ts';
import { appearanceScreen } from './appearance.ts';

export function registerSettingsScreens(router) {
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
