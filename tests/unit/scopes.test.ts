import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Settings } from '@/settings/store';
import { MemoryBackend, Storage } from '@/services/storage';
import { SCOPES, asksTrueCounts, decksOf, indexMaskKey, isBettingScope, keeps } from '@/settings/scopes';
import type { ScopeName } from '@/settings/scopes';

const SCOPE_NAMES = Object.keys(SCOPES) as ScopeName[];

describe('module scopes', () => {
  it('give True Count Conversion to the modules that keep how they work out true counts', () => {
    expect(SCOPE_NAMES.filter(asksTrueCounts)).toEqual(['game', 'depth', 'count']);
    for (const scope of SCOPE_NAMES) expect(keeps(scope, 'trueCount.resolution')).toBe(asksTrueCounts(scope));
  });

  it('give Betting Strategy to the modules that keep a bet ramp', () => {
    expect(SCOPE_NAMES.filter(isBettingScope)).toEqual(['game', 'depth']);
    for (const scope of SCOPE_NAMES) expect(keeps(scope, 'betting.ramp')).toBe(isBettingScope(scope));
  });

  it('read the decks the game plays at its table, and each drill its own', () => {
    const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
    settings.update({ 'table.decks': 2, 'drills.depth.decks': 8 });
    expect(decksOf(settings, 'game')).toBe(2);
    expect(decksOf(settings, 'depth')).toBe(8);
  });

  it('keep each module’s Custom index set under its own name', () => {
    for (const scope of SCOPE_NAMES.filter(scope => keeps(scope, 'strategy.customIndexMask'))) {
      expect(SETTINGS_SCHEMA).toHaveProperty([indexMaskKey(scope)]);
    }
    expect(indexMaskKey('flash')).toBe('drills.flash.strategy.customIndexMask');
  });
});
