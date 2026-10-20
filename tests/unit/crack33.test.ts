// The Crack 33 index set: Crackjack's own 32 index plays and the insurance index, kept for whichever
// strategy is picked, in every module that builds one.
import { describe, it, expect } from 'vitest';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import type { TableOptions } from '@/core/strategy/strategy-tables';
import { ACTION, advisePlay } from '@/core/strategy/advisor';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { createTestApp } from '../support/render';
import { SETTINGS_SCHEMA } from '@/settings/schema';

const OPTIONS: TableOptions = {
  decks: 6,
  hitSoft17: true,
  doubleAfterSplit: true,
  noHoleCard: false,
  indexSet: 'all',
  customMask: null,
  rangeLow: -99,
  rangeHigh: 99,
  forcedInitialRunningCount: null,
};
const build = (id: number, indexSet: TableOptions['indexSet']) =>
  buildStrategy(STRATEGY_FILES[id], { ...OPTIONS, indexSet });

/** The cells of `a` that differ from `b`, as "table row,column". */
function differences(a: ReturnType<typeof build>, b: ReturnType<typeof build>) {
  const out: string[] = [];
  for (const [name, table] of Object.entries(a.tables)) {
    table.forEach((row, r) =>
      row.forEach((value, c) => {
        if (value !== b.tables[name as keyof typeof a.tables][r][c]) out.push(`${name} ${r},${c}`);
      }),
    );
  }
  return out;
}

describe('the Crack 33', () => {
  it('keeps exactly its 32 plays of High-Low, and the insurance index', () => {
    expect(differences(build(30, 'crack33'), build(30, 'none')).sort()).toEqual(
      [
        ...['1,7', '1,8', '2,8', '4,0', '4,1', '5,0', '5,1', '5,2'].map(cell => `hardStand ${cell}`),
        ...['0,9', '1,8', '1,9', '2,0', '2,5', '3,2', '3,3', '3,4'].map(cell => `hardDouble ${cell}`),
        ...['0,2', '0,3', '0,4', '1,2', '1,3', '1,4', '2,0', '3,0'].map(cell => `softDouble ${cell}`),
        ...['1,2', '1,3', '1,4'].map(cell => `split ${cell}`),
        ...['2,7', '2,8', '2,9', '3,8', '8,8'].map(cell => `surrender ${cell}`),
      ].sort(),
    );
    expect(build(30, 'crack33').insurance).toBe(build(30, 'all').insurance);
    // A strategy with a 77 v X surrender index keeps it.
    expect(build(31, 'crack33').tables.surrender[8][8]).toBe(build(31, 'all').tables.surrender[8][8]);
    expect(build(31, 'crack33').tables.surrender[8][8]).not.toBe(build(31, 'none').tables.surrender[8][8]);
  });

  it('keeps those 32 plays of another strategy, at its own indices, and plays the rest by basic strategy', () => {
    const crack = build(31, 'crack33');
    const kept = differences(crack, build(31, 'none'));
    expect(kept.length).toBeGreaterThan(20);
    expect(kept.length).toBeLessThanOrEqual(32);
    // Each kept cell holds the strategy's own index there.
    const all = build(31, 'all');
    expect(differences(crack, all).every(cell => !kept.includes(cell))).toBe(true);
    // 16 v X is one of them; 12 v 5 is not.
    expect(crack.tables.hardStand[1][8]).toBe(all.tables.hardStand[1][8]);
    expect(crack.tables.hardStand[5][3]).toBe(build(31, 'none').tables.hardStand[5][3]);
  });

  it('decides the play, not only the chart: 16 v X at +1 stands with it and hits without', () => {
    const play = (indexSet: TableOptions['indexSet']) =>
      advisePlay(
        build(30, indexSet),
        { total: 16, hardTotal: 16, card1: 10, card2: 6, cardCount: 2, cardIds: [10, 19] },
        {
          upcard: 10,
          trueCount: 1,
          runningCount: 6,
          decks: 6,
          cardsDealt: 0,
          allowed: { double: true, softDouble: true, split: true, surrender: false },
        },
      ).action;
    expect(play('crack33')).toBe(ACTION.stand);
    expect(play('none')).toBe(ACTION.hit);
  });

  it('is offered wherever indices are picked, after Catch 20', () => {
    for (const key of [
      'game.strategy.indexSet',
      'drills.flash.strategy.indexSet',
      'charts.strategy.indexSet',
    ] as const) {
      const values: readonly string[] = SETTINGS_SCHEMA[key].values;
      expect(values.indexOf('crack33'), key).toBe(values.indexOf('catch20') + 1);
    }
  });

  it('is what the game and Flash Cards play when chosen', () => {
    const app = createTestApp();
    app.settings.update({
      'game.strategy.system': 31,
      'game.strategy.indexSet': 'crack33',
      'drills.flash.strategy.system': 31,
      'drills.flash.strategy.indexSet': 'crack33',
    });
    const expected = build(31, 'crack33');
    expect(differences(app.strategies.current(app.settings, 'game', 6), expected)).toEqual([]);
    expect(differences(drillStrategy(app, 'flash', 6).strategy, expected)).toEqual([]);
  });
});
