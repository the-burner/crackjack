import { describe, it, expect } from 'vitest';
import { evaluateSideBet, sideBetSpots, ruleMatches, allowedAtCount } from '../../../public/src/game/engine/side-bets.js';
import { decodeSideBetGame } from '../../../public/src/settings/side-bet-games.js';
import { SIDE_BET_GAME_DEFINITIONS, BUILTIN_SIDE_BET_GAMES } from '../../../public/src/data/side-bet-games.js';
import { cardId } from '../../../public/src/core/cards.js';

const SPADES = 0, CLUBS = 1, HEARTS = 2, DIAMONDS = 3;
const c = (rank, suit = SPADES) => cardId(rank, suit);

/** Decodes a built-in game by its name in the game list. */
function game(name) {
  const entry = BUILTIN_SIDE_BET_GAMES.find(g => g.name === name);
  const definition = entry && SIDE_BET_GAME_DEFINITIONS[entry.id];
  if (!definition) throw new Error(`No definition for ${name}`);
  return decodeSideBetGame(definition);
}

function play(def, playerHandCards, dealerHandCards, { stake = 5, won = false, doubled = false, split = false, trueCount = 0 } = {}) {
  const spots = sideBetSpots(def);
  if (spots.length === 0) return null;
  return evaluateSideBet({
    game: def, ruleIndex: spots[0].ruleIndex, stake,
    context: { playerHandCards, dealerHandCards, won, doubled, split, trueCount },
  });
}

describe('side bet spots', () => {
  it('lists the enabled side-bet rules of each game', () => {
    expect(sideBetSpots(game('21 + 3 Blackjack (Wagerworks)')).length).toBeGreaterThan(0);
    expect(sideBetSpots(game('Over Under 13')).length).toBe(2);
    expect(sideBetSpots(game('Red Black')).length).toBe(2);
  });
});

describe('21 + 3 (Wagerworks)', () => {
  const def = game('21 + 3 Blackjack (Wagerworks)');

  it('pays 100:1 for suited trips', () => {
    const result = play(def, [c(5, HEARTS), c(5, HEARTS)], [c(5, HEARTS)]);
    expect(result.multiplier).toBe(100);
  });

  it('pays 5:1 for a flush', () => {
    const result = play(def, [c(2, CLUBS), c(9, CLUBS)], [c(5, CLUBS)]);
    expect(result.multiplier).toBe(5);
  });

  it('pays 10:1 for a straight', () => {
    const result = play(def, [c(5, CLUBS), c(6, HEARTS)], [c(7, SPADES)]);
    expect(result.multiplier).toBe(10);
  });

  it('loses when the three cards make nothing', () => {
    expect(play(def, [c(2, CLUBS), c(9, HEARTS)], [c(5, SPADES)])).toBeNull();
  });
});

describe('Dare any Pair', () => {
  const def = game('Dare any Pair');

  it('pays a pair and loses otherwise', () => {
    expect(play(def, [c(8, CLUBS), c(8, HEARTS)], [c(5)]).multiplier).toBeGreaterThan(0);
    expect(play(def, [c(8, CLUBS), c(9, HEARTS)], [c(5)])).toBeNull();
  });
});

describe('Royal Match', () => {
  const def = game('Royal Match');

  it('pays more for a suited king and queen than for any suited pair of cards', () => {
    const royal = play(def, [c(13, DIAMONDS), c(12, DIAMONDS)], [c(5)]);
    const suited = play(def, [c(3, DIAMONDS), c(9, DIAMONDS)], [c(5)]);
    expect(royal.multiplier).toBeGreaterThan(suited.multiplier);
  });
});

describe('rule gating', () => {
  const def = game('Dare any Pair');

  it('respects a rule that requires a win', () => {
    const rule = { ...def.rules[sideBetSpots(def)[0].ruleIndex], winRequired: true };
    const context = { playerHandCards: [c(8, CLUBS), c(8, HEARTS)], dealerHandCards: [c(5)], won: false, doubled: false, split: false, trueCount: 0 };
    expect(ruleMatches(rule, context)).toBe(false);
    expect(ruleMatches(rule, { ...context, won: true })).toBe(true);
  });

  it('only runs a count-gated rule at or above its threshold', () => {
    const rule = { trueCountThreshold: 3, aboveThreshold: false };
    expect(allowedAtCount(rule, 0)).toBe(false);
    expect(allowedAtCount(rule, 3)).toBe(true);
    expect(allowedAtCount({ trueCountThreshold: -99 }, -20)).toBe(true);
    expect(allowedAtCount({ trueCountThreshold: 3, aboveThreshold: true }, 5)).toBe(false);
  });
});

describe('every built-in game decodes and can be evaluated', () => {
  it.each(Object.keys(SIDE_BET_GAME_DEFINITIONS))('game %s', key => {
    const def = decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[key]);
    expect(def.rules.length).toBe(20);
    const result = play(def, [c(8, CLUBS), c(8, CLUBS)], [c(8, CLUBS), c(10)]);
    expect(result === null || Number.isFinite(result.payout)).toBe(true);
  });
});
