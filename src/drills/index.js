// The four drills: each has an options screen and a play screen.

import { flashOptionsScreen } from './flash/options.js';
import { flashScreen } from './flash/screen.js';
import { depthOptionsScreen } from './depth/options.js';
import { depthScreen } from './depth/screen.js';
import { countOptionsScreen } from './count/options.js';
import { countScreen } from './count/screen.js';
import { fullOptionsScreen } from './full/options.js';
import { fullScreen } from './full/screen.js';

export function registerDrillScreens(router) {
  return router
    .register('drills.flash.options', flashOptionsScreen)
    .register('drills.flash', flashScreen)
    .register('drills.depth.options', depthOptionsScreen)
    .register('drills.depth', depthScreen)
    .register('drills.count.options', countOptionsScreen)
    .register('drills.count', countScreen)
    .register('drills.full.options', fullOptionsScreen)
    .register('drills.full', fullScreen);
}
