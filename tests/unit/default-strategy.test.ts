import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { BUILTIN_STRATEGIES } from '@/settings/strategies';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { buildStrategy } from '@/core/strategy/strategy-tables';

describe('the default strategy', () => {
  const id = SETTINGS_SCHEMA['game.strategy.system'].default;

  it('is High-Low, listed first, played with the Crack 33', () => {
    expect(id).toBe(30);
    expect(BUILTIN_STRATEGIES[0]).toEqual({ id: 30, name: 'High-Low' });
    for (const key of [
      'game.strategy.indexSet',
      'drills.flash.strategy.indexSet',
      'charts.strategy.indexSet',
    ] as const) {
      expect(SETTINGS_SCHEMA[key].default, key).toBe('crack33');
    }
  });

  it('builds complete tables for every deck count and rule set', () => {
    for (const decks of [1, 2, 4, 6, 8])
      for (const hitSoft17 of [false, true])
        for (const doubleAfterSplit of [false, true]) {
          const s = buildStrategy(STRATEGY_FILES[id], {
            decks,
            hitSoft17,
            doubleAfterSplit,
            noHoleCard: false,
            indexSet: 'all',
          });
          expect(s.name).toBe('Basic High-Low');
          for (const table of Object.values(s.tables)) {
            for (const row of table) for (const cell of row) expect(Number.isFinite(cell)).toBe(true);
          }
        }
  });

  it('surrenders a pair of sevens against a ten from the same index as any other hard 14, whatever the rules', () => {
    for (const decks of [1, 2, 3, 4, 5, 6, 7, 8])
      for (const hitSoft17 of [false, true])
        for (const doubleAfterSplit of [false, true])
          for (const noHoleCard of [false, true]) {
            const { surrender } = buildStrategy(STRATEGY_FILES[id], {
              decks,
              hitSoft17,
              doubleAfterSplit,
              noHoleCard,
              indexSet: 'all',
            }).tables;
            expect(surrender[8][8], `${decks} decks`).toBe(surrender[3][8]);
          }
  });

  it('counts like High-Low', () => {
    const s = buildStrategy(STRATEGY_FILES[id], {
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: false,
      noHoleCard: false,
      indexSet: 'all',
    });
    expect(s.countValues.slice(1)).toEqual([-10, 10, 10, 10, 10, 10, 0, 0, 0, -10]);
  });
});
