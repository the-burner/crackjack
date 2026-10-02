// Screen registry.

import { homeScreen } from './home.js';
import { helpScreen } from './help.js';

export function registerScreens(router) {
  router
    .register('home', homeScreen)
    .register('help', helpScreen);
}
