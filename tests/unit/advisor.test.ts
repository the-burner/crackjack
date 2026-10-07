import { describe, it, expect } from 'vitest';
import { buildStrategy, INDEX_SETS } from '@/core/strategy/strategy-tables';
import { advisePlay, adviseInsurance } from '@/core/strategy/advisor';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { loadFixture } from '../support/fixtures';
import type { Probe } from '@/core/strategy/advisor';

interface RecordedConfig {
  system: number;
  decks: number;
  h17: boolean;
  das: boolean;
  noHoleCard: boolean;
  indexSet: number;
  rangeHigh: number;
  rangeLow: number;
}

interface RecordedAdvice {
  config: RecordedConfig;
  probeModes: number[];
  /** Player total, hard total, first two cards and card count. */
  hands: { hc: number; sc: number; c1: number; c2: number; n: number }[];
  results: string[];
  insurance: number[];
}

const PERMISSIONS = [
  { double: true, softDouble: true, split: true, surrender: true },
  { double: true, softDouble: true, split: true, surrender: false },
  { double: false, softDouble: false, split: false, surrender: false },
];
const COUNTS = [-10, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10];

function strategyFor(c: RecordedConfig) {
  return buildStrategy(STRATEGY_FILES[c.system], {
    decks: c.decks,
    hitSoft17: c.h17,
    doubleAfterSplit: c.das,
    noHoleCard: c.noHoleCard,
    indexSet: INDEX_SETS[c.indexSet],
    rangeHigh: c.rangeHigh,
    rangeLow: c.rangeLow,
  });
}

function run(record: RecordedAdvice) {
  const strategy = strategyFor(record.config);
  const out: string[] = [];
  for (const probe of record.probeModes)
    for (const h of record.hands)
      for (let up = 1; up <= 10; up++)
        for (const allowed of PERMISSIONS)
          for (const tc of COUNTS) {
            const r = advisePlay(
              strategy,
              { total: h.hc, hardTotal: h.sc, card1: h.c1, card2: h.c2, cardCount: h.n, cardIds: [1, 14] },
              {
                upcard: up,
                dealerTotal: up === 1 ? 11 : up,
                dealerHardTotal: up,
                trueCount: tc,
                runningCount: tc,
                decks: record.config.decks,
                cardsDealt: 0,
                allowed,
                probe: probe as Probe,
              },
            );
            out.push(
              `${r.action},${r.section},${r.row},${r.doubleOrLess ? 1 : 0},${r.threshold === null ? -9999 : Number(r.threshold)}`,
            );
          }
  return out;
}

for (const app of ['game', 'drill']) {
  describe(`advisePlay matches the recorded ${app} decisions`, () => {
    it.each(loadFixture<RecordedAdvice[]>(`advisor.${app}`).map(r => [JSON.stringify(r.config), r] as const))(
      '%s',
      (_, record) => {
        const actual = run(record);
        const mismatches: { i: number; expected: string; actual: string }[] = [];
        actual.forEach((v, i) => {
          if (v !== record.results[i] && mismatches.length < 5)
            mismatches.push({ i, expected: record.results[i], actual: v });
        });
        expect(mismatches).toEqual([]);
        expect(actual.length).toBe(record.results.length);
      },
    );
  });
}

describe('adviseInsurance matches the recorded decisions', () => {
  it.each(loadFixture<RecordedAdvice[]>('advisor.game').map(r => [JSON.stringify(r.config), r] as const))(
    '%s',
    (_, record) => {
      const strategy = strategyFor(record.config);
      const actual = COUNTS.map(tc =>
        adviseInsurance(strategy, { trueCount: tc, insuranceCount: tc, hardTotal: 12 }) ? 5 : 7,
      );
      expect(actual).toEqual(record.insurance);
    },
  );
});
