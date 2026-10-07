// The four drills: each has an options screen and a play screen.

import { flashOptionsScreen } from './flash/options.tsx';
import { flashScreen } from './flash/screen.ts';
import { flashErrorsScreen } from './flash/errors.tsx';
import { depthOptionsScreen } from './depth/options.tsx';
import { depthScreen } from './depth/screen.ts';
import { countOptionsScreen } from './count/options.tsx';
import { countScreen } from './count/screen.ts';
import { fullOptionsScreen } from './full/options.tsx';
import { fullScreen } from './full/screen.ts';
import type { Router } from '../app/router.ts';

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
