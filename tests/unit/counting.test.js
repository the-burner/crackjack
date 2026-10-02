import { describe, it, expect } from 'vitest';
import { buildStrategy } from '../../src/core/strategy/strategy-tables.js';
import { Counter, roundTrueCount, TC_ROUNDING } from '../../src/core/counting.js';
import { STRATEGY_FILES } from '../../src/data/strategy-files.js';
import { loadFixture } from '../support/fixtures.js';

function replay(record) {
  const c = record.config;
  const strategy = buildStrategy(STRATEGY_FILES[c.system], { decks: c.decks, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all' });
  const counter = new Counter(strategy, { division: c.division, lastDeck: c.lastDeck, rounding: c.rounding, aceSideCount: c.aceSideCount });
  expect(counter.running).toBe(record.initial);
  return record.shoe.map((card, i) => {
    counter.addCard(card, i + 1);
    return [counter.running, counter.trueCount, counter.exactTrueCount, counter.aces, counter.tens, counter.betCount, counter.decksRemaining(i + 1)].map(v => (v === 0 ? 0 : v));
  });
}

describe('Counter replays the recorded shoes', () => {
  // Round and floor follow the game. "Truncate" follows the drills, which
  // truncated correctly (the game's version was off by one for exact negative
  // integers). Rounding mode 3 was never selectable and is not supported.
  const game = loadFixture('counting.game').filter(r => r.config.rounding === TC_ROUNDING.round || r.config.rounding === TC_ROUNDING.floor);
  const drill = loadFixture('counting.drill').filter(r => r.config.rounding === TC_ROUNDING.truncate);
  it.each([...game, ...drill].map(r => [JSON.stringify(r.config), r]))('%s', (_, record) => {
    expect(replay(record)).toEqual(record.steps);
  });
});

describe('roundTrueCount', () => {
  it('rounds, truncates toward zero, or floors', () => {
    expect([-2.5, -2, -1.5, 1.5, 2.5].map(v => roundTrueCount(v, TC_ROUNDING.round))).toEqual([-2, -2, -1, 2, 3]);
    expect([-2.5, -2, -0.5, 1.9].map(v => roundTrueCount(v, TC_ROUNDING.truncate))).toEqual([-2, -2, 0, 1]);
    expect([-2.5, -2, -0.5, 1.9].map(v => roundTrueCount(v, TC_ROUNDING.floor))).toEqual([-3, -2, -1, 1]);
  });
});
