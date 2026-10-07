// Shared settings the drills read: the true-count rules and the strategy
// built for the drill's deck count.

import { TC_DIVISION, TC_LAST_DECK, TC_ROUNDING } from '../../core/counting.ts';
import type { CounterSettings, TcDivision, TcLastDeck, TcRounding } from '../../core/counting.ts';
import type { Strategy } from '../../core/strategy/strategy-tables.ts';
import type { App } from '../../app/app.ts';
import type { AppSettings, SettingValues } from '../../settings/schema.ts';

const DIVISION: Record<SettingValues['trueCount.resolution'], TcDivision> = {
  full: TC_DIVISION.fullDeck,
  half: TC_DIVISION.halfDeck,
  quarter: TC_DIVISION.quarterDeck,
  exact: TC_DIVISION.exact,
};
const LAST_DECK: Record<SettingValues['trueCount.lastDeckResolution'], TcLastDeck> = {
  half: TC_LAST_DECK.halfDeck,
  quarter: TC_LAST_DECK.quarterDeck,
  exact: TC_LAST_DECK.exact,
};
const ROUNDING: Record<SettingValues['trueCount.rounding'], TcRounding> = {
  round: TC_ROUNDING.round,
  truncate: TC_ROUNDING.truncate,
  floor: TC_ROUNDING.floor,
};

/** The true-count settings a Counter (or the answer helpers) needs. */
export function trueCountSettings(settings: Pick<AppSettings, 'get'>): CounterSettings {
  return {
    division: DIVISION[settings.get('trueCount.resolution')],
    lastDeck: LAST_DECK[settings.get('trueCount.lastDeckResolution')],
    rounding: ROUNDING[settings.get('trueCount.rounding')],
    aceSideCount: settings.get('trueCount.aceSideCount'),
  };
}

/**
 * Everything a drill needs from the shared settings: the counting system built
 * for `decks` decks and the true-count rules.
 */
export function drillStrategy(
  app: Pick<App, 'strategies' | 'settings'>,
  decks: number,
): { strategy: Strategy; trueCountSettings: CounterSettings } {
  return {
    strategy: app.strategies.current(app.settings, decks),
    trueCountSettings: trueCountSettings(app.settings),
  };
}
