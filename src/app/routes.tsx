// Every screen and its URL (hash routes, so the app works from any static host
// and offline). Screens opened over the table or a drill are child routes, so
// those stay as they are underneath.

import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { createHashRouter, Navigate, Outlet, useNavigationType } from 'react-router';
import { cn } from '@/lib/utils';
import type { RouteObject } from 'react-router';
import { HelpSheet } from '@/screens/help';
import { OverlayRoot } from '@/components/overlay-root';
import { Home } from '@/screens/home';

/** A screen's frame: the whole window inside the safe area. `name` is its data-screen. */
function Screen({ name, children }: { name: string; children: ReactNode }) {
  const [entering] = useState(useNavigationType() !== 'POP');
  return (
    <section
      className={cn(
        'absolute inset-0 flex flex-col overflow-hidden bg-(--page-bg) pt-(--safe-top) pr-(--safe-right) pb-(--safe-bottom) pl-(--safe-left)',
        // A screen being opened fades in below its title bar, which stays steady; going back shows the screen in place.
        entering && '[&>:not(header)]:animate-fade-in',
      )}
      data-screen={name}
    >
      {children}
    </section>
  );
}

/** A route whose screen is loaded the first time it opens (its own chunk). */
const page = (name: string, load: () => Promise<ComponentType>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => {
    const Component = await load();
    return {
      element: (
        <Screen name={name}>
          <Component />
        </Screen>
      ),
    };
  },
});

const settings = (path: string, name: string, load: () => Promise<ComponentType>): RouteObject => ({
  path: `settings/${path}`,
  ...page(`settings.${name}`, load),
});

const tables = () => import('@/screens/strategy/tables').then(m => m.StrategyTablesRoute);
const betting = () => import('@/screens/strategy/betting').then(m => m.Betting);
const betRow = () => import('@/screens/strategy/betting').then(m => m.BetSelectRoute);

/** Every screen, with the dialogs, toasts and help sheet above them. */
function Layout() {
  return (
    <div className="relative h-full">
      <Outlet />
      <HelpSheet />
      <OverlayRoot />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Screen name="home">
            <Home />
          </Screen>
        ),
      },
      { path: 'settings', ...page('settings', () => import('@/screens/settings/hub').then(m => m.SettingsHub)) },
      settings('setup', 'setup', () => import('@/screens/settings/setup').then(m => m.Setup)),
      settings('common-rules', 'commonRules', () => import('@/screens/settings/common-rules').then(m => m.CommonRules)),
      settings('rule-variations', 'ruleVariations', () =>
        import('@/screens/settings/rule-variations').then(m => m.RuleVariations),
      ),
      settings('mechanics', 'mechanics', () => import('@/screens/settings/mechanics').then(m => m.Mechanics)),
      settings('bonuses', 'bonuses', () => import('@/screens/settings/bonuses').then(m => m.Bonuses)),
      settings('play-variations', 'playVariations', () =>
        import('@/screens/settings/play-variations').then(m => m.PlayVariations),
      ),
      settings('unusual-games', 'unusualGames', () =>
        import('@/screens/settings/unusual-games').then(m => m.UnusualGames),
      ),
      settings('dealer-errors', 'dealerErrors', () =>
        import('@/screens/settings/dealer-errors').then(m => m.DealerErrors),
      ),
      settings('peeking', 'peeking', () => import('@/screens/settings/peeking').then(m => m.Peeking)),
      settings('appearance', 'appearance', () => import('@/screens/settings/appearance').then(m => m.Appearance)),
      settings('strategy', 'strategy', () =>
        import('@/screens/strategy/playing-strategy').then(m => m.PlayingStrategy),
      ),
      settings('true-count', 'trueCount', () => import('@/screens/strategy/true-count').then(m => m.TrueCount)),
      settings('betting', 'betting', betting),
      settings('betting/:row', 'betting.select', betRow),
      { path: 'strategy/tables', ...page('strategy.tables', tables) },
      {
        path: 'drills/flash',
        ...page('drills.flash.options', () => import('@/drills/flash/options').then(m => m.FlashOptions)),
      },
      {
        path: 'drills/flash/play',
        ...page('drills.flash', () => import('@/drills/flash/screen').then(m => m.FlashDrill)),
        children: [{ path: 'table', ...page('strategy.tables', tables) }],
      },
      {
        path: 'drills/flash/errors',
        ...page('drills.flash.errors', () => import('@/drills/flash/errors').then(m => m.FlashErrors)),
      },
      {
        path: 'drills/depth',
        ...page('drills.depth.options', () => import('@/drills/depth/options').then(m => m.DepthOptions)),
      },
      {
        path: 'drills/depth/play',
        ...page('drills.depth', () => import('@/drills/depth/screen').then(m => m.DepthDrill)),
      },
      {
        path: 'drills/count',
        ...page('drills.count.options', () => import('@/drills/count/options').then(m => m.CountOptions)),
      },
      {
        path: 'drills/count/play',
        ...page('drills.count', () => import('@/drills/count/screen').then(m => m.CountDrill)),
      },
      {
        path: 'drills/full',
        ...page('drills.full.options', () => import('@/drills/full/options').then(m => m.FullOptions)),
      },
      { path: 'drills/full/play', ...page('drills.full', () => import('@/drills/full/screen').then(m => m.FullDrill)) },
      {
        path: 'play',
        ...page('game.table', () => import('@/game/screens/table-screen').then(m => m.TableScreen)),
        children: [
          { path: 'stats', ...page('game.stats', () => import('@/game/screens/stats').then(m => m.GameStatsRoute)) },
          { path: 'error', ...page('strategy.tables', tables) },
          { path: 'customize', ...page('settings.betting', betting) },
          { path: 'customize/:row', ...page('settings.betting.select', betRow) },
          {
            path: 'side-bet/:spot',
            ...page('game.betSelect', () => import('@/game/screens/bet-select').then(m => m.SideBetRoute)),
          },
        ],
      },
      // Anything else (an old bookmark, a typo) goes home.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createHashRouter(routes);
