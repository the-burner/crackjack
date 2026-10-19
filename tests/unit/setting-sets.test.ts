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
  it("offers Crackjack's four games, and none called Default", () => {
    expect(GAME_SETS.kind.builtIns.map(s => s.name)).toEqual([
      "Crackjack's Heads-Up 6D,H17,LS,DAS",
      "Crackjack's Heads-Up 2D,H17,LS,DAS",
      "Crackjack's 2D,H17,LS,DAS",
      "Crackjack's 6D,H17,LS,DAS",
    ]);
  });

  it("offers Crackjack's three Flash Cards drills, and none called Default", () => {
    expect(DRILL_SETS.flash.kind.builtIns.map(s => s.name)).toEqual([
      "Crackjack's Round Robin 3-Minute Intervals",
      "Crackjack's Round Robin 4-Minute Intervals",
      "Crackjack's Infinite Round Robin",
    ]);
  });

  it("offers Crackjack's four Simple Running Count drills, and none called Default", () => {
    expect(DRILL_SETS.count.kind.builtIns.map(s => s.name)).toEqual([
      "Crackjack's Running Count 3-Minute Intervals",
      "Crackjack's Running Count 4-Minute Intervals",
      "Crackjack's True Count 3-Minute Intervals",
      "Crackjack's True Count 4-Minute Intervals",
    ]);
    // Infinite, a test about every 36 cards, pausing every 2:45 or 3:45.
    for (const set of DRILL_SETS.count.kind.builtIns) {
      const values = DRILL_SETS.count.kind.valuesOf(set);
      expect(values).toMatchObject({
        'drills.count.timerMode': 'infinite',
        'drills.count.testEvery': 'about36',
        'drills.count.autoPause': true,
        'drills.count.drill': set.id.startsWith('true') ? 'trueCount' : 'runningCount',
        'drills.count.autoPauseSeconds': set.id.endsWith('3-minute') ? 165 : 225,
      });
    }
  });

  it("offers Crackjack's four Deck Estimation drills, and none called Default", () => {
    const builtIns = DRILL_SETS.depth.kind.builtIns;
    expect(builtIns.map(s => s.name)).toEqual([
      "Crackjack's Decks Left 6D",
      "Crackjack's Decks Left 2D",
      "Crackjack's TC Bet & Decks 6D",
      "Crackjack's TC Bet & Decks 2D",
    ]);
    expect(builtIns.map(set => DRILL_SETS.depth.kind.valuesOf(set))).toMatchObject([
      { 'drills.depth.drill': 'decksLeft', 'drills.depth.decks': 6 },
      { 'drills.depth.drill': 'decksLeft', 'drills.depth.decks': 2 },
      { 'drills.depth.drill': 'betAndDecks', 'drills.depth.decks': 6 },
      { 'drills.depth.drill': 'betAndDecks', 'drills.depth.decks': 2 },
    ]);
  });

  it("begins a fresh install unedited: the game on Crackjack's 6D table, Flash Cards on its Infinite Round Robin", () => {
    const fresh = {
      game: 'table-6d',
      flash: 'infinite-round-robin',
      depth: 'decks-left-6d',
      count: 'running-count-3-minute',
      full: 'default',
    };
    for (const [name, { kind }] of [['game', GAME_SETS], ...DRILLS.map(d => [d, DRILL_SETS[d]] as const)] as const) {
      const state = presetState(
        defaults(kind.selectedKey) as string,
        kind.current(defaults),
        kind.builtIns,
        kind.valuesOf,
        sameValues,
      );
      expect(state).toEqual({ selected: kind.builtIns.find(s => s.id === fresh[name]), edited: false });
      expect(state.selected).toBeDefined();
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

describe('what each drill keeps of its own', () => {
  const kept = (drill: DrillName) =>
    ALL.filter(
      key =>
        key.startsWith(`drills.${drill}.strategy.`) ||
        key.startsWith(`drills.${drill}.trueCount.`) ||
        key.startsWith(`drills.${drill}.betting.`) ||
        key.startsWith(`drills.${drill}.rules.`),
    )
      .map(key => key.slice(`drills.${drill}.`.length))
      .sort();

  it('is only what the drill reads', () => {
    // Judged against the tables: their indices, and the rules they are built for.
    expect(kept('flash')).toEqual([
      'rules.dealerHitsSoft17',
      'rules.doubleAfterSplit',
      'rules.noHoleCard',
      'strategy.adjustInitialCount',
      'strategy.customIndexMask',
      'strategy.indexRangeMax',
      'strategy.indexRangeMin',
      'strategy.indexSet',
      'strategy.initialCount',
      'strategy.system',
    ]);
    // Given the running count: the system, how it is turned into a true count and, for the TC Bet
    // drills, the bet at each true count (in dollars, as the game labels it) and where it sits out.
    expect(kept('depth')).toEqual([
      'betting.chipValue',
      'betting.ramp',
      'betting.strategy',
      'betting.wongOut',
      'betting.wonging',
      'strategy.system',
      'trueCount.lastDeckResolution',
      'trueCount.resolution',
      'trueCount.rounding',
    ]);
    expect(kept('count')).toEqual([
      'strategy.adjustInitialCount',
      'strategy.initialCount',
      'strategy.system',
      'trueCount.lastDeckResolution',
      'trueCount.resolution',
      'trueCount.rounding',
    ]);
    // Running counts only: the system and the count a shoe starts from.
    expect(kept('full')).toEqual(['strategy.adjustInitialCount', 'strategy.initialCount', 'strategy.system']);
  });
});
