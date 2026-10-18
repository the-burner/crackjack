import { describe, it, expect } from 'vitest';
import { trueCountSettings, drillStrategy } from '@/drills/shared/drill-settings';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { StrategyLibrary } from '@/settings/strategies';
import { TC_DIVISION, TC_LAST_DECK, TC_ROUNDING } from '@/core/counting';
import type { AppSettings, SettingKey, SettingValues, SettingsPatch } from '@/settings/schema';
import type { App } from '@/app/app';

/** The settings a screen would pass in: the schema defaults with overrides. */
function settings(overrides: SettingsPatch = {}): Pick<AppSettings, 'get'> {
  return {
    get: <K extends SettingKey>(key: K): SettingValues[K] => {
      if (key in overrides) return overrides[key] as SettingValues[K];
      if (!(key in SETTINGS_SCHEMA)) throw new Error(`Unknown setting: ${key}`);
      return structuredClone(SETTINGS_SCHEMA[key].default) as SettingValues[K];
    },
  };
}

describe('trueCountSettings', () => {
  it('turns the stored choices into the codes a Counter wants', () => {
    expect(trueCountSettings(settings(), 'count')).toEqual({
      division: TC_DIVISION.halfDeck,
      lastDeck: TC_LAST_DECK.halfDeck,
      rounding: TC_ROUNDING.truncate,
      aceSideCount: false,
    });
  });

  it('maps every resolution, last-deck and rounding choice', () => {
    const divisions = (['full', 'half', 'quarter', 'exact'] as const).map(
      resolution => trueCountSettings(settings({ 'drills.count.trueCount.resolution': resolution }), 'count').division,
    );
    expect(divisions).toEqual([TC_DIVISION.fullDeck, TC_DIVISION.halfDeck, TC_DIVISION.quarterDeck, TC_DIVISION.exact]);
    const lastDecks = (['half', 'quarter', 'exact'] as const).map(
      resolution =>
        trueCountSettings(settings({ 'drills.count.trueCount.lastDeckResolution': resolution }), 'count').lastDeck,
    );
    expect(lastDecks).toEqual([TC_LAST_DECK.halfDeck, TC_LAST_DECK.quarterDeck, TC_LAST_DECK.exact]);
    const roundings = (['round', 'truncate', 'floor'] as const).map(
      rounding => trueCountSettings(settings({ 'drills.count.trueCount.rounding': rounding }), 'count').rounding,
    );
    expect(roundings).toEqual([TC_ROUNDING.round, TC_ROUNDING.truncate, TC_ROUNDING.floor]);
  });

  it('gives a drill that asks no true count the defaults, with nothing of its own to read', () => {
    expect(trueCountSettings(settings(), 'flash')).toEqual(trueCountSettings(settings(), 'count'));
    expect(SETTINGS_SCHEMA).not.toHaveProperty(['drills.flash.trueCount.resolution']);
    expect(SETTINGS_SCHEMA).not.toHaveProperty(['drills.full.trueCount.resolution']);
  });

  it('passes the ace side count through, for the game, which alone keeps one', () => {
    expect(trueCountSettings(settings({ 'game.trueCount.aceSideCount': true }), 'game').aceSideCount).toBe(true);
    expect(trueCountSettings(settings(), 'count').aceSideCount).toBe(false);
  });
});

describe('drillStrategy', () => {
  // drillStrategy only reads settings.get().
  const app = (overrides: SettingsPatch) => ({
    settings: settings(overrides) as App['settings'],
    strategies: new StrategyLibrary(),
  });

  it('builds the selected system for the deck count the drill uses', () => {
    const { strategy, trueCountSettings: tc } = drillStrategy(app({ 'drills.flash.strategy.system': 30 }), 'flash', 2);
    expect(strategy.decks).toBe(2);
    expect(strategy.initialRunningCount[1]).toBe(0);
    expect(tc).toEqual(trueCountSettings(settings(), 'flash'));
  });

  it('follows the rules and index settings the strategy was chosen with', () => {
    const chosen = drillStrategy(app({ 'drills.flash.strategy.system': 30 }), 'flash', 6).strategy;
    const noIndices = drillStrategy(
      app({ 'drills.flash.strategy.system': 30, 'drills.flash.strategy.indexSet': 'none' }),
      'flash',
      6,
    ).strategy;
    const forcedCount = drillStrategy(
      app({
        'drills.flash.strategy.system': 30,
        'drills.flash.strategy.adjustInitialCount': true,
        'drills.flash.strategy.initialCount': 7,
      }),
      'flash',
      6,
    ).strategy;
    expect(noIndices.tables).not.toEqual(chosen.tables);
    expect(forcedCount.initialRunningCount[5]).toBe(7);
  });
});
