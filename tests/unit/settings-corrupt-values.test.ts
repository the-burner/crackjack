// A saved value that no longer makes sense must not reach the screens.

import { describe, it, expect } from 'vitest';
import { Storage, MemoryBackend } from '../../src/services/storage.ts';
import { Settings } from '../../src/settings/store.ts';
import { SETTINGS_SCHEMA } from '../../src/settings/schema.ts';
import { prepareLaunch } from '../../src/settings/rules-logic.ts';
import { BUILTIN_STRATEGIES, HOLE_CARD_STRATEGY } from '../../src/settings/strategies.ts';
import { BUILTIN_SIDE_BET_GAMES } from '../../src/data/side-bet-games.ts';

/** Settings loaded from storage holding `values`. */
function saved(values: Record<string, unknown>) {
  const storage = new Storage(new MemoryBackend());
  storage.set('settings', values);
  return new Settings(SETTINGS_SCHEMA, storage);
}

describe('corrupt json settings', () => {
  it('replaces a seat list that is not a list of six seats', () => {
    expect(saved({ 'table.computerSeats': 'oops' }).get('table.computerSeats')).toEqual(
      SETTINGS_SCHEMA['table.computerSeats'].default,
    );
    expect(saved({ 'table.computerSeats': [true, false] }).get('table.computerSeats')).toHaveLength(6);
  });

  it('lets the table open when the saved seat list is corrupt', () => {
    const settings = saved({ 'table.computerSeats': 'oops' });
    expect(() => prepareLaunch(key => settings.get(key))).not.toThrow();
  });

  it('replaces an index mask whose grids are the wrong size', () => {
    const mask = structuredClone(SETTINGS_SCHEMA['strategy.customIndexMask'].default);
    mask.hardStand[0] = new Array(23).fill(false);
    expect(saved({ 'strategy.customIndexMask': mask }).get('strategy.customIndexMask').hardStand[0]).toHaveLength(10);
  });

  it('replaces a situation list that is missing a situation', () => {
    expect(saved({ 'drills.flash.situations': { hardStand: true } }).get('drills.flash.situations')).toEqual(
      SETTINGS_SCHEMA['drills.flash.situations'].default,
    );
  });

  it('keeps a bet ramp whatever number of rows it has', () => {
    const ramp = { minCount: -2, rows: [{ chips: 5, hands: 2 }] };
    expect(saved({ 'betting.ramp': ramp }).get('betting.ramp')).toEqual(ramp);
  });

  it('replaces a bet ramp that is not a ramp', () => {
    expect(saved({ 'betting.ramp': 'oops' }).get('betting.ramp')).toEqual(SETTINGS_SCHEMA['betting.ramp'].default);
  });

  it('replaces a bet ramp whose rows or minimum count are not numbers', () => {
    const fallback = SETTINGS_SCHEMA['betting.ramp'].default;
    for (const ramp of [
      { minCount: 0, rows: [{ chips: '5', hands: 1 }] },
      { minCount: 0, rows: [{ chips: 5 }] },
      { minCount: 0, rows: [null] },
      { minCount: '2', rows: [{ chips: 5, hands: 1 }] },
      { rows: [{ chips: 5, hands: 1 }] },
    ])
      expect(saved({ 'betting.ramp': ramp }).get('betting.ramp')).toEqual(fallback);
  });
});

describe('unknown strategy and game ids', () => {
  it('falls back to the default strategy when the saved system is not one of them', () => {
    expect(saved({ 'strategy.system': 12345 }).get('strategy.system')).toBe(100);
  });

  it('defaults to the first built-in strategy', () => {
    expect(SETTINGS_SCHEMA['strategy.system'].default).toBe(BUILTIN_STRATEGIES[0].id);
  });

  it('falls back to the hole-carding strategy when a saved hole-card strategy is not one', () => {
    for (const key of ['peeking.strategyHigh', 'peeking.strategyLow'] as const) {
      expect(saved({ [key]: 12345 }).get(key)).toBe(HOLE_CARD_STRATEGY.id);
      expect(saved({ [key]: BUILTIN_STRATEGIES[1].id }).get(key)).toBe(BUILTIN_STRATEGIES[1].id);
    }
  });

  it('falls back to standard blackjack when the saved game is not one of them', () => {
    expect(saved({ 'bonuses.game': 999 }).get('bonuses.game')).toBe(0);
  });

  it('keeps every id the two pickers offer', () => {
    for (const { id } of BUILTIN_STRATEGIES) expect(saved({ 'strategy.system': id }).get('strategy.system')).toBe(id);
    for (const { id } of BUILTIN_SIDE_BET_GAMES) expect(saved({ 'bonuses.game': id }).get('bonuses.game')).toBe(id);
  });
});
