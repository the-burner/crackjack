import { describe, it, expect } from 'vitest';
import { BUILTIN_STRATEGIES, HOLE_CARD_STRATEGY, StrategyLibrary, strategyOptions } from '../../public/src/settings/strategies.js';
import { STRATEGY_FILES } from '../../public/src/data/strategy-files.js';
import { SETTINGS_SCHEMA } from '../../public/src/settings/schema.js';
import { Settings } from '../../public/src/settings/store.js';
import { Storage, MemoryBackend } from '../../public/src/services/storage.js';

const settings = () => new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));

describe('the strategy catalog', () => {
  it('offers the Crackjack strategy first, since it is the default', () => {
    expect(BUILTIN_STRATEGIES[0]).toEqual({ id: 100, name: "Crackjack's High-Low Strategy" });
    expect(SETTINGS_SCHEMA['strategy.system'].default).toBe(100);
  });

  it('lists what the Playing Strategy screen shows', () => {
    expect(new StrategyLibrary().list()).toBe(BUILTIN_STRATEGIES);
  });

  it('bundles a file for every strategy it offers, and for hole-carding', () => {
    const missing = BUILTIN_STRATEGIES.filter(({ id }) => !(id in STRATEGY_FILES));
    expect(missing).toEqual([]);
    expect(HOLE_CARD_STRATEGY.id in STRATEGY_FILES).toBe(true);
  });

  it('names every strategy once', () => {
    const names = BUILTIN_STRATEGIES.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('strategy text', () => {
  it('hands back the bundled file for an id it knows', () => {
    expect(new StrategyLibrary().text(5)).toBe(STRATEGY_FILES[5]);
  });

  it('reports nothing for an id it does not know', () => {
    expect(new StrategyLibrary().text(12345)).toBe(null);
  });
});

describe('building a strategy', () => {
  const options = { decks: 6, hitSoft17: false, doubleAfterSplit: true, noHoleCard: false, indexSet: 'all', customMask: null, rangeLow: -99, rangeHigh: 99, forcedInitialRunningCount: null };

  it('memoizes a build, so the same request comes back identical', () => {
    const library = new StrategyLibrary();
    expect(library.build(5, options)).toBe(library.build(5, { ...options }));
  });

  it('builds again when the rules differ', () => {
    const library = new StrategyLibrary();
    expect(library.build(5, options)).not.toBe(library.build(5, { ...options, decks: 1 }));
  });

  it('falls back to High-Low for an unknown strategy', () => {
    const library = new StrategyLibrary();
    expect(library.build(12345, options)).toEqual(library.build(30, options));
  });

  it('keeps the cache from growing without bound', () => {
    const library = new StrategyLibrary();
    for (let decks = 1; decks <= 60; decks++) library.build(5, { ...options, decks });
    expect(library.cache.size).toBeLessThanOrEqual(50);
    // The oldest entry was dropped, so building it again is a fresh object.
    expect(library.cache.has(JSON.stringify([5, { ...options, decks: 1 }]))).toBe(false);
  });
});

describe('the options the settings imply', () => {
  it('reads the rules and the index set out of the settings', () => {
    const s = settings();
    s.update({ 'rules.dealerHitsSoft17': true, 'rules.doubleAfterSplit': false, 'strategy.indexSet': 'illustrious18' });
    expect(strategyOptions(s, 2)).toMatchObject({
      decks: 2,
      hitSoft17: true,
      doubleAfterSplit: false,
      indexSet: 'illustrious18',
    });
  });

  it('passes the custom mask only when the custom index set is chosen', () => {
    const s = settings();
    expect(strategyOptions(s, 6).customMask).toBe(null);
    s.set('strategy.indexSet', 'custom');
    expect(strategyOptions(s, 6).customMask).toEqual(s.get('strategy.customIndexMask'));
  });

  it('forces the initial running count only when the player asked for it', () => {
    const s = settings();
    s.set('strategy.initialCount', 4);
    expect(strategyOptions(s, 6).forcedInitialRunningCount).toBe(null);
    s.set('strategy.adjustInitialCount', true);
    expect(strategyOptions(s, 6).forcedInitialRunningCount).toBe(4);
  });

  it('builds the selected strategy, or an overridden one', () => {
    const s = settings();
    const library = new StrategyLibrary();
    s.set('strategy.system', 5);
    expect(library.current(s, 6)).toBe(library.build(5, strategyOptions(s, 6)));
    expect(library.current(s, 6, { system: 30 })).toBe(library.build(30, strategyOptions(s, 6)));
  });
});
