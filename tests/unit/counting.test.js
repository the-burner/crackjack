import { describe, it, expect } from 'vitest';
import { buildStrategy } from '../../src/core/strategy/strategy-tables.ts';
import {
  Counter,
  decksRemaining,
  roundTrueCount,
  COUNT_UNIT,
  TC_DIVISION,
  TC_LAST_DECK,
  TC_ROUNDING,
} from '../../src/core/counting.ts';
import { cardId, suitOf } from '../../src/core/cards.ts';
import { STRATEGY_FILES } from '../../src/data/strategy-files.ts';
import { loadFixture } from '../support/fixtures.js';

function replay(record) {
  const c = record.config;
  const strategy = buildStrategy(STRATEGY_FILES[c.system], {
    decks: c.decks,
    hitSoft17: false,
    doubleAfterSplit: false,
    noHoleCard: false,
    indexSet: 'all',
  });
  const counter = new Counter(strategy, {
    division: c.division,
    lastDeck: c.lastDeck,
    rounding: c.rounding,
    aceSideCount: c.aceSideCount,
  });
  expect(counter.running).toBe(record.initial);
  return record.shoe.map((card, i) => {
    counter.addCard(card, i + 1);
    return [
      counter.running,
      counter.trueCount,
      counter.exactTrueCount,
      counter.aces,
      counter.tens,
      counter.betCount,
      counter.decksRemaining(i + 1),
    ].map(v => (v === 0 ? 0 : v));
  });
}

describe('Counter replays the recorded shoes', () => {
  // Round and floor follow the game. "Truncate" follows the drills, which
  // truncated correctly (the game's version was off by one for exact negative
  // integers). Rounding mode 3 was never selectable and is not supported.
  const game = loadFixture('counting.game').filter(
    r => r.config.rounding === TC_ROUNDING.round || r.config.rounding === TC_ROUNDING.floor,
  );
  const drill = loadFixture('counting.drill').filter(r => r.config.rounding === TC_ROUNDING.truncate);
  it.each([...game, ...drill].map(r => [JSON.stringify(r.config), r]))('%s', (_, record) => {
    expect(replay(record)).toEqual(record.steps);
  });
});

describe('the counts a Counter keeps', () => {
  // KISS Stage II: ace-neutral and measured as a running count, which is what
  // the ace side count adjusts.
  const kissII = buildStrategy(STRATEGY_FILES[51], {
    decks: 2,
    hitSoft17: false,
    doubleAfterSplit: false,
    noHoleCard: false,
    indexSet: 'all',
  });
  const settings = {
    division: TC_DIVISION.fullDeck,
    lastDeck: TC_LAST_DECK.halfDeck,
    rounding: TC_ROUNDING.round,
    aceSideCount: true,
  };

  /** Half of the two-deck shoe, as fives apart from the aces asked for. */
  function dealHalfShoe(counter, aces = 0) {
    const cards = [...[1, 14, 27, 40].slice(0, aces), ...new Array(26 - aces).fill(5)];
    cards.forEach((card, i) => counter.addCard(card, i + 1));
  }

  it('plays off the true count, not the bet count', () => {
    const counter = new Counter(kissII, settings);
    dealHalfShoe(counter);
    expect(counter.playCount).toBe(counter.trueCount);
    expect(counter.betCount).not.toBe(counter.playCount);
  });

  it('raises the bet count by the aces still due when the ace side count is on', () => {
    const noAces = new Counter(kissII, settings);
    dealHalfShoe(noAces);
    // A deck has gone, so four aces were due and none of them have shown.
    expect(noAces.betCount).toBe(noAces.running + 4);
    const allAces = new Counter(kissII, settings);
    dealHalfShoe(allAces, 4);
    expect(allAces.betCount).toBe(allAces.running);
  });

  it('leaves the bet count on the running count when the ace side count is off', () => {
    const counter = new Counter(kissII, { ...settings, aceSideCount: false });
    dealHalfShoe(counter);
    expect(counter.betCount).toBe(counter.running);
  });
});

describe('a count value of 10000', () => {
  const redSeven = {
    decks: 1,
    initialRunningCount: [0],
    kiss: false,
    trueCountType: COUNT_UNIT.deck,
    insurance: 30,
    countValues: [null, -10, 10, 10, 10, 10, 10, 10000, 0, 0, -10],
    countValuesBlack: [null, -10, 10, 10, 10, 10, 10, 0, 0, 0, -10],
  };

  it('counts the card only when it is red', () => {
    const counter = new Counter(redSeven, {
      division: TC_DIVISION.fullDeck,
      lastDeck: TC_LAST_DECK.halfDeck,
      rounding: TC_ROUNDING.round,
    });
    counter.addCard(7, 1);
    counter.addCard(20, 2);
    expect(counter.running).toBe(0);
    counter.addCard(33, 3);
    counter.addCard(46, 4);
    expect(counter.running).toBe(2);
  });

  /**
   * The original drew the line at `cardtemp>25`, so the king of clubs (26) counts
   * as red even though it is black. Ids run 1..52 as suit * 13 + rank with the
   * suits spades, clubs, hearts, diamonds, so black ends at 26, not 25. Keeping
   * the original's boundary keeps the counts identical to it; do not "fix" this
   * without deciding to diverge on purpose.
   */
  it('treats the king of clubs as red, exactly as the original did', () => {
    const counter = new Counter(redSeven, {
      division: TC_DIVISION.fullDeck,
      lastDeck: TC_LAST_DECK.halfDeck,
      rounding: TC_ROUNDING.round,
    });
    const kingOfClubs = 26;
    expect(suitOf(kingOfClubs)).toBe(1);
    // A seven in that position would be counted, which is the quirk itself.
    const sevenOfClubs = 20;
    counter.addCard(sevenOfClubs, 1);
    expect(counter.running).toBe(0);
  });

  it('counts a red seven in both red suits', () => {
    const counter = new Counter(redSeven, {
      division: TC_DIVISION.fullDeck,
      lastDeck: TC_LAST_DECK.halfDeck,
      rounding: TC_ROUNDING.round,
    });
    counter.addCard(cardId(7, 2), 1);
    counter.addCard(cardId(7, 3), 2);
    expect(counter.running).toBe(2);
  });
});

describe('decksRemaining', () => {
  it('never falls below a tenth of a deck, however much has gone', () => {
    const overdealt = {
      decks: 1,
      cardsGone: 104,
      countUnit: COUNT_UNIT.deck,
      division: TC_DIVISION.fullDeck,
      lastDeck: TC_LAST_DECK.halfDeck,
    };
    expect(decksRemaining(overdealt)).toBe(0.1);
  });
});

describe('roundTrueCount', () => {
  it('rounds, truncates toward zero, or floors', () => {
    expect([-2.5, -2, -1.5, 1.5, 2.5].map(v => roundTrueCount(v, TC_ROUNDING.round))).toEqual([-2, -2, -1, 2, 3]);
    expect([-2.5, -2, -0.5, 1.9].map(v => roundTrueCount(v, TC_ROUNDING.truncate))).toEqual([-2, -2, 0, 1]);
    expect([-2.5, -2, -0.5, 1.9].map(v => roundTrueCount(v, TC_ROUNDING.floor))).toEqual([-3, -2, -1, 1]);
  });
});
