// @ts-nocheck
// The four drills: each has an options screen and a play screen.

import { flashOptionsScreen } from './flash/options.ts';
import { flashScreen } from './flash/screen.ts';
import { flashErrorsScreen } from './flash/errors.ts';
import { depthOptionsScreen } from './depth/options.ts';
import { depthScreen } from './depth/screen.ts';
import { countOptionsScreen } from './count/options.ts';
import { countScreen } from './count/screen.ts';
import { fullOptionsScreen } from './full/options.ts';
import { fullScreen } from './full/screen.ts';

export function registerDrillScreens(router) {
  return router
    .register('drills.flash.options', flashOptionsScreen)
    .register('drills.flash', flashScreen)
    .register('drills.flash.errors', flashErrorsScreen)
    .register('drills.depth.options', depthOptionsScreen)
    .register('drills.depth', depthScreen)
    .register('drills.count.options', countOptionsScreen)
    .register('drills.count', countScreen)
    .register('drills.full.options', fullOptionsScreen)
    .register('drills.full', fullScreen);
}
