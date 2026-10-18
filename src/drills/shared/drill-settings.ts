// Shared settings the drills read: the true-count rules and the strategy
// built for the drill's deck count.

import { TC_DIVISION, TC_LAST_DECK, TC_ROUNDING } from '@/core/counting';
import type { CounterSettings, TcDivision, TcLastDeck, TcRounding } from '@/core/counting';
import type { Strategy } from '@/core/strategy/strategy-tables';
import type { App } from '@/app/app';
import { scopedKey } from '@/settings/scopes';
import type { ScopeName } from '@/settings/scopes';
import type { AppSettings, SettingValues } from '@/settings/schema';

const DIVISION: Record<SettingValues['game.trueCount.resolution'], TcDivision> = {
  full: TC_DIVISION.fullDeck,
  half: TC_DIVISION.halfDeck,
  quarter: TC_DIVISION.quarterDeck,
  exact: TC_DIVISION.exact,
};
const LAST_DECK: Record<SettingValues['game.trueCount.lastDeckResolution'], TcLastDeck> = {
  half: TC_LAST_DECK.halfDeck,
  quarter: TC_LAST_DECK.quarterDeck,
  exact: TC_LAST_DECK.exact,
};
const ROUNDING: Record<SettingValues['game.trueCount.rounding'], TcRounding> = {
  round: TC_ROUNDING.round,
  truncate: TC_ROUNDING.truncate,
  floor: TC_ROUNDING.floor,
};

/** Module `scope`'s own true-count settings, as a Counter (or the answer helpers) needs them. */
export function trueCountSettings(settings: Pick<AppSettings, 'get'>, scope: ScopeName): CounterSettings {
  const own = <T>(key: Parameters<typeof scopedKey>[1]) => settings.get(scopedKey(scope, key)) as T;
  return {
    division: DIVISION[own<SettingValues['game.trueCount.resolution']>('trueCount.resolution')],
    lastDeck: LAST_DECK[own<SettingValues['game.trueCount.lastDeckResolution']>('trueCount.lastDeckResolution')],
    rounding: ROUNDING[own<SettingValues['game.trueCount.rounding']>('trueCount.rounding')],
    aceSideCount: own<boolean>('trueCount.aceSideCount'),
  };
}

/**
 * Everything a drill needs from its own settings: the counting system built for
 * `decks` decks and the true-count rules.
 */
export function drillStrategy(
  app: Pick<App, 'strategies' | 'settings'>,
  scope: ScopeName,
  decks: number,
): { strategy: Strategy; trueCountSettings: CounterSettings } {
  return {
    strategy: app.strategies.current(app.settings, scope, decks),
    trueCountSettings: trueCountSettings(app.settings, scope),
  };
}
