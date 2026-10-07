// The four drills: each has an options screen and a play screen.

import { flashOptionsScreen } from './flash/options';
import { flashScreen } from './flash/screen';
import { flashErrorsScreen } from './flash/errors';
import { depthOptionsScreen } from './depth/options';
import { depthScreen } from './depth/screen';
import { countOptionsScreen } from './count/options';
import { countScreen } from './count/screen';
import { fullOptionsScreen } from './full/options';
import { fullScreen } from './full/screen';
import type { Router } from '@/app/router';

export function registerDrillScreens(router: Router): Router {
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
