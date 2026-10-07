// Every screen and its URL (hash routes, so the app works from any static host
// and offline). Screens opened over the table or a drill are child routes, so
// those stay as they are underneath.

import type { ReactNode } from 'react';
import { createHashRouter, Navigate, Outlet, useParams, useSearchParams } from 'react-router';
import type { RouteObject } from 'react-router';
import { HelpSheet } from '@/screens/help';
import { OverlayRoot } from '@/components/overlay-root';
import { Home } from '@/screens/home';
import { SettingsHub } from '@/screens/settings/hub';
import { Setup } from '@/screens/settings/setup';
import { CommonRules } from '@/screens/settings/common-rules';
import { RuleVariations } from '@/screens/settings/rule-variations';
import { Mechanics } from '@/screens/settings/mechanics';
import { Bonuses } from '@/screens/settings/bonuses';
import { PlayVariations } from '@/screens/settings/play-variations';
import { UnusualGames } from '@/screens/settings/unusual-games';
import { DealerErrors } from '@/screens/settings/dealer-errors';
import { Peeking } from '@/screens/settings/peeking';
import { Appearance } from '@/screens/settings/appearance';
import { PlayingStrategy } from '@/screens/strategy/playing-strategy';
import { TrueCount } from '@/screens/strategy/true-count';
import { Betting, BetSelect as BetRowSelect } from '@/screens/strategy/betting';
import { StrategyTables } from '@/screens/strategy/tables';
import { FlashOptions } from '@/drills/flash/options';
import { FlashDrill } from '@/drills/flash/screen';
import { FlashErrors } from '@/drills/flash/errors';
import { DepthOptions } from '@/drills/depth/options';
import { DepthDrill } from '@/drills/depth/screen';
import { CountOptions } from '@/drills/count/options';
import { CountDrill } from '@/drills/count/screen';
import { FullOptions } from '@/drills/full/options';
import { FullDrill } from '@/drills/full/screen';
import { TableScreen, useTableContext } from '@/game/screens/table-screen';
import { GameStats } from '@/game/screens/stats';
import { BetSelect as SideBetSelect } from '@/game/screens/bet-select';
import { tablesParams } from './paths';

/** A screen's frame: the whole window inside the safe area. `name` is its data-screen. */
function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section
      className="absolute inset-0 flex flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
      data-screen={name}
    >
      {children}
    </section>
  );
}

const screen = (name: string, element: ReactNode): ReactNode => <Screen name={name}>{element}</Screen>;

function TablesRoute() {
  const [search] = useSearchParams();
  // A new set of options is a new viewer.
  return <StrategyTables key={search.toString()} params={tablesParams(search)} />;
}

function BetRowRoute() {
  const { row } = useParams();
  return <BetRowSelect params={{ row: Number(row) || 0 }} />;
}

function StatsRoute() {
  const { session } = useTableContext();
  return <GameStats params={{ session }} />;
}

function SideBetRoute() {
  const { spot } = useParams();
  const params = useTableContext().sideBetParams(Number(spot));
  // A reload or a stale link has no picker to show: back to the table.
  return params ? <SideBetSelect params={params} /> : <Navigate to="../.." relative="path" replace />;
}

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

const drill = (
  name: 'flash' | 'depth' | 'count' | 'full',
  options: ReactNode,
  play: ReactNode,
  playChildren: RouteObject[] = [],
): RouteObject[] => [
  { path: `drills/${name}`, element: screen(`drills.${name}.options`, options) },
  { path: `drills/${name}/play`, element: screen(`drills.${name}`, play), children: playChildren },
];

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: screen('home', <Home />) },
      { path: 'settings', element: screen('settings', <SettingsHub />) },
      { path: 'settings/setup', element: screen('settings.setup', <Setup />) },
      { path: 'settings/common-rules', element: screen('settings.commonRules', <CommonRules />) },
      { path: 'settings/rule-variations', element: screen('settings.ruleVariations', <RuleVariations />) },
      { path: 'settings/mechanics', element: screen('settings.mechanics', <Mechanics />) },
      { path: 'settings/bonuses', element: screen('settings.bonuses', <Bonuses />) },
      { path: 'settings/play-variations', element: screen('settings.playVariations', <PlayVariations />) },
      { path: 'settings/unusual-games', element: screen('settings.unusualGames', <UnusualGames />) },
      { path: 'settings/dealer-errors', element: screen('settings.dealerErrors', <DealerErrors />) },
      { path: 'settings/peeking', element: screen('settings.peeking', <Peeking />) },
      { path: 'settings/appearance', element: screen('settings.appearance', <Appearance />) },
      { path: 'settings/strategy', element: screen('settings.strategy', <PlayingStrategy />) },
      { path: 'settings/true-count', element: screen('settings.trueCount', <TrueCount />) },
      { path: 'settings/betting', element: screen('settings.betting', <Betting />) },
      { path: 'settings/betting/:row', element: screen('settings.betting.select', <BetRowRoute />) },
      { path: 'strategy/tables', element: screen('strategy.tables', <TablesRoute />) },
      ...drill('flash', <FlashOptions />, <FlashDrill />, [
        { path: 'table', element: screen('strategy.tables', <TablesRoute />) },
      ]),
      { path: 'drills/flash/errors', element: screen('drills.flash.errors', <FlashErrors />) },
      ...drill('depth', <DepthOptions />, <DepthDrill />),
      ...drill('count', <CountOptions />, <CountDrill />),
      ...drill('full', <FullOptions />, <FullDrill />),
      {
        path: 'play',
        element: screen('game.table', <TableScreen />),
        children: [
          { path: 'stats', element: screen('game.stats', <StatsRoute />) },
          { path: 'error', element: screen('strategy.tables', <TablesRoute />) },
          { path: 'customize', element: screen('settings.betting', <Betting />) },
          { path: 'customize/:row', element: screen('settings.betting.select', <BetRowRoute />) },
          { path: 'side-bet/:spot', element: screen('game.betSelect', <SideBetRoute />) },
        ],
      },
      // Anything else (an old bookmark, a typo) goes home.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createHashRouter(routes);
