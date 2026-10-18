import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { strategyOptions } from '@/settings/strategies';
import type { SettingKey, SettingReader } from '@/settings/schema';
import { DRILL_KEYS, DRILL_SETS, GAME_KEYS, GAME_SETS } from '@/settings/setting-sets';
import type { DrillName } from '@/settings/setting-sets';
import { presetState, sameValues } from '@/settings/named-configs';

const ALL = Object.keys(SETTINGS_SCHEMA) as SettingKey[];
const DRILLS: DrillName[] = ['flash', 'depth', 'count', 'full'];
const defaults = (key => SETTINGS_SCHEMA[key].default) as SettingReader;

describe('the settings a configuration saves', () => {
  it('puts every setting in one place: the global screens, a module, or which configuration is selected', () => {
    const selections = ['gestures.config', 'game.config', ...DRILLS.map(d => `drills.${d}.config`)];
    const global = ALL.filter(
      key => key.startsWith('gestures.') || (key.startsWith('display.') && !GAME_KEYS.includes(key)),
    ).filter(key => !selections.includes(key));
    const places = [global, GAME_KEYS, ...DRILLS.map(DRILL_KEYS), selections];
    const counted = new Map<string, number>();
    for (const keys of places) for (const key of keys) counted.set(key, (counted.get(key) ?? 0) + 1);
    expect(ALL.filter(key => counted.get(key) !== 1)).toEqual([]);
  });

  it('keeps the game’s strategy and betting with the game, and out of a drill’s', () => {
    expect(GAME_KEYS).toContain('rules.surrender');
    expect(GAME_KEYS).toContain('game.strategy.system');
    expect(GAME_KEYS).toContain('game.betting.ramp');
    expect(GAME_KEYS).not.toContain('game.config');
    expect(DRILL_KEYS('flash')).toContain('drills.flash.strategy.system');
    expect(DRILL_KEYS('flash')).not.toContain('game.strategy.system');
  });

  it('keeps each drill to its own', () => {
    for (const drill of DRILLS) {
      expect(DRILL_KEYS(drill).length).toBeGreaterThan(0);
      expect(DRILL_KEYS(drill).every(key => key.startsWith(`drills.${drill}.`))).toBe(true);
      expect(DRILL_KEYS(drill)).not.toContain(`drills.${drill}.config`);
    }
  });
});

describe('a configuration', () => {
  it('begins a fresh install on Default, unedited', () => {
    for (const { kind } of [GAME_SETS, ...DRILLS.map(d => DRILL_SETS[d])]) {
      const state = presetState(
        defaults(kind.selectedKey) as string,
        kind.current(defaults),
        kind.builtIns,
        kind.valuesOf,
        sameValues,
      );
      expect(state).toEqual({ selected: kind.builtIns[0], edited: false });
    }
  });

  it('is read back with only its own settings, a setting added since taking its default', () => {
    const [saved] = GAME_SETS.read([
      { id: 'a', name: 'Mine', values: { 'rules.surrender': 'late', 'display.theme': 'latte', 'no.such': 1 } },
      { id: 'b', name: 'Broken' },
      'junk',
    ]);
    expect(saved.name).toBe('Mine');
    expect(saved.values['rules.surrender']).toBe('late');
    expect(saved.values).not.toHaveProperty('display.theme');
    expect(saved.values).not.toHaveProperty('no.such');
    expect(saved.values['table.decks']).toBe(SETTINGS_SCHEMA['table.decks'].default);
    expect(GAME_SETS.read(undefined)).toEqual([]);
  });
});

describe('a module’s own counting settings', () => {
  it('are its own: one module’s strategy is nothing to do with another’s', () => {
    const app = createServices({ backend: new MemoryBackend() });
    app.settings.set('game.strategy.system', 32);
    app.settings.set('drills.flash.strategy.system', 73);
    expect(app.strategies.current(app.settings, 'game', 6).name).not.toBe(
      app.strategies.current(app.settings, 'flash', 6).name,
    );
    // The game's rules build its tables; a drill keeps its own copy of them.
    app.settings.set('rules.dealerHitsSoft17', false);
    expect(strategyOptions(app.settings, 'game', 6).hitSoft17).toBe(false);
    expect(strategyOptions(app.settings, 'flash', 6).hitSoft17).toBe(true);
  });

  it('give every module the same answers to begin with', () => {
    const app = createServices({ backend: new MemoryBackend() });
    const names = (['game', 'flash', 'depth', 'count', 'full'] as const).map(
      scope => app.strategies.current(app.settings, scope, 6).name,
    );
    expect(new Set(names).size).toBe(1);
  });
});
