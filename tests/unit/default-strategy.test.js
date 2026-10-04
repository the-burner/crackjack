import { describe, it, expect } from 'vitest';
import { SETTINGS_SCHEMA } from '../../public/src/settings/schema.js';
import { BUILTIN_STRATEGIES } from '../../public/src/settings/strategies.js';
import { STRATEGY_FILES } from '../../public/src/data/strategy-files.js';
import { buildStrategy } from '../../public/src/core/strategy/strategy-tables.js';

describe('the default strategy', () => {
  const id = SETTINGS_SCHEMA['strategy.system'].default;

  it("is Crackjack's High-Low Strategy, listed first", () => {
    expect(id).toBe(100);
    expect(BUILTIN_STRATEGIES[0]).toEqual({ id: 100, name: "Crackjack's High-Low Strategy" });
  });

  it('builds complete tables for every deck count and rule set', () => {
    for (const decks of [1, 2, 4, 6, 8]) for (const hitSoft17 of [false, true]) for (const doubleAfterSplit of [false, true]) {
      const s = buildStrategy(STRATEGY_FILES[id], { decks, hitSoft17, doubleAfterSplit, noHoleCard: false, indexSet: 'all' });
      expect(s.name).toBe("Crackjack's High-Low Strategy");
      for (const table of Object.values(s.tables)) {
        for (const row of table) for (const cell of row) expect(Number.isFinite(cell)).toBe(true);
      }
    }
  });

  it('counts like High-Low', () => {
    const s = buildStrategy(STRATEGY_FILES[id], { decks: 6, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all' });
    expect(s.countValues.slice(1)).toEqual([-10, 10, 10, 10, 10, 10, 0, 0, 0, -10]);
  });
});
