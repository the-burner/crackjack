// Settings screens: the hub and the option screens it opens.

import { settingsHubScreen } from './hub.js';
import { setupScreen } from './setup.js';
import { commonRulesScreen } from './common-rules.js';
import { ruleVariationsScreen } from './rule-variations.js';
import { mechanicsScreen } from './mechanics.js';
import { bonusesScreen } from './bonuses.js';
import { playVariationsScreen } from './play-variations.js';
import { unusualGamesScreen } from './unusual-games.js';
import { dealerErrorsScreen } from './dealer-errors.js';
import { peekingScreen } from './peeking.js';

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
    .register('settings.peeking', peekingScreen);
}
