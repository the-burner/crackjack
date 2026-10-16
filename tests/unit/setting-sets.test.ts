import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingKey, SettingReader } from '@/settings/schema';
import { DRILL_KEYS, DRILL_SETS, GAME_KEYS, GAME_SETS } from '@/settings/setting-sets';
import type { DrillName } from '@/settings/setting-sets';
import { BETTING_KEYS } from '@/settings/betting-strategies';
import { presetState, sameValues } from '@/settings/named-configs';

const ALL = Object.keys(SETTINGS_SCHEMA) as SettingKey[];
const DRILLS: DrillName[] = ['flash', 'depth', 'count', 'full'];
const defaults = (key => SETTINGS_SCHEMA[key].default) as SettingReader;

describe('the settings a configuration saves', () => {
  it('puts every setting in one place: the global screens, a betting strategy, the game, a drill, or which is selected', () => {
    const selections = ['betting.strategy', 'gestures.config', 'game.config', ...DRILLS.map(d => `drills.${d}.config`)];
    const global = ALL.filter(
      key => /^(strategy|trueCount|gestures)\./.test(key) || (key.startsWith('display.') && !GAME_KEYS.includes(key)),
    ).filter(key => key !== 'strategy.warnOnError' && !selections.includes(key));
    const places = [
      global,
      BETTING_KEYS.filter(key => key !== ('betting.strategy' as SettingKey)),
      GAME_KEYS,
      ...DRILLS.map(DRILL_KEYS),
      selections,
    ];
    const counted = new Map<string, number>();
    for (const keys of places) for (const key of keys) counted.set(key, (counted.get(key) ?? 0) + 1);
    // betting.warnOnError is on Allowed Bets, shown with the betting strategy but not part of it.
    counted.set('betting.warnOnError', (counted.get('betting.warnOnError') ?? 0) + 1);
    expect(ALL.filter(key => counted.get(key) !== 1)).toEqual([]);
  });

  it('leaves the game’s out of the betting strategy and the global settings', () => {
    expect(GAME_KEYS).toContain('rules.surrender');
    expect(GAME_KEYS).toContain('mechanics.dealerSpeed');
    expect(GAME_KEYS).not.toContain('betting.ramp');
    expect(GAME_KEYS).not.toContain('strategy.system');
    expect(GAME_KEYS).not.toContain('game.config');
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
