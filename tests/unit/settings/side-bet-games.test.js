import { describe, it, expect } from 'vitest';
import { BUILTIN_SIDE_BET_GAMES, SIDE_BET_GAME_DEFINITIONS } from '../../../src/data/side-bet-games.js';
import { RULE_COUNT, decodeSideBetGame, sideBetGameName } from '../../../src/settings/side-bet-games.js';

const decode = id => decodeSideBetGame(SIDE_BET_GAME_DEFINITIONS[id]);
const enabled = game => game.rules.filter(rule => rule.enabled);

describe('side-bet game data', () => {
  it('offers the standard game, two variants and nineteen side-bet games', () => {
    expect(BUILTIN_SIDE_BET_GAMES).toHaveLength(22);
    const withDefinitions = BUILTIN_SIDE_BET_GAMES.filter(({ id }) => id in SIDE_BET_GAME_DEFINITIONS);
    expect(withDefinitions.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('names every definition as the list does', () => {
    for (const { id, name } of BUILTIN_SIDE_BET_GAMES) {
      const definition = SIDE_BET_GAME_DEFINITIONS[id];
      if (!definition) continue;
      // The stored names drop punctuation the menu keeps ("21 + 3" / "21  3").
      expect(sideBetGameName(definition).replaceAll(/[^a-z0-9]/gi, ''))
        .toBe(name.replaceAll(/[^a-z0-9]/gi, ''));
    }
  });
});

describe('decodeSideBetGame', () => {
  it('decodes every built-in game into twenty rules', () => {
    for (const id of Object.keys(SIDE_BET_GAME_DEFINITIONS)) {
      const game = decode(Number(id));
      expect(game.rules).toHaveLength(RULE_COUNT);
      expect(game.rules.every(rule => Number.isFinite(rule.payTenths))).toBe(true);
    }
  });

  it('reads the 21+3 (Regent) pay table: seven patterns at 2.5:1', () => {
    const game = decode(1);
    const rules = enabled(game);
    expect(rules).toHaveLength(7);
    expect(rules.map(rule => rule.payTenths)).toEqual([25, 25, 25, 25, 25, 25, 25]);
    // Player's two cards plus the up card, patterns in the legacy order.
    expect(rules.map(rule => rule.mixMatch)).toEqual([
      [3, 1, 5], [3, 1, 2], [3, 1, 7], [3, 1, 3], [3, 1, 4], [3, 1, 1], [3, 1, 6],
    ]);
    expect(rules[0].sideBetId).toBe('+3');
    expect(game.firstTwoCardsOnly).toBe(true);
    expect(game.delayed).toBe(false);
  });

  it('reads the 21+3 (Wagerworks) pay table', () => {
    expect(enabled(decode(2)).map(rule => rule.payTenths / 10)).toEqual([100, 35, 33, 10, 5]);
  });

  it('marks the games that pay at settlement', () => {
    const delayed = Object.keys(SIDE_BET_GAME_DEFINITIONS)
      .filter(id => decode(Number(id)).delayed)
      .map(Number);
    expect(delayed).toEqual([4, 7, 8, 9]);
  });

  it('reads Lucky Ladies as five delayed tiers up to 1000:1', () => {
    const game = decode(8);
    expect(game.delayed).toBe(true);
    expect(enabled(game).map(rule => rule.payTenths / 10)).toEqual([1000, 125, 19, 9, 4]);
    expect(enabled(game)[0].sideBetId).toBe('LL');
  });

  it('reads the games that accumulate every match', () => {
    expect(decode(10).nonAdditive).toBe(true);
    expect(decode(13).nonAdditive).toBe(true);
    expect(decode(1).nonAdditive).toBe(false);
  });

  it('reads the two-spot games as unmerged with a label per spot', () => {
    expect(decode(11).merge).toBe(false);
    expect(enabled(decode(11)).map(rule => rule.sideBetId)).toEqual(['U', 'O']);
    expect(enabled(decode(14)).map(rule => rule.sideBetId)).toEqual(['R', 'B']);
  });

  it('reads Spanish 21 bonuses as hand rules, not side bets', () => {
    const spanish = decode(17);
    expect(spanish.forcedSideBet).toBe(12);
    // Every enabled rule is below the side-bet boundary, so all are hand bonuses.
    expect(spanish.rules.findLastIndex(rule => rule.enabled)).toBeLessThan(spanish.forcedSideBet - 1);
    const matchTheDealer = decode(16);
    expect(matchTheDealer.forcedSideBet).toBe(12);
    expect(enabled(matchTheDealer).filter(rule => rule.sideBetId === 'MD')).toHaveLength(1);
  });

  it('reads a fixed add-on payout', () => {
    // Suited 7-7-7 against a seven up card adds a flat $200 in Spanish 21.
    const fixed = enabled(decode(17)).find(rule => rule.payFixed > 0);
    expect(fixed.payFixed / 10).toBe(200);
  });

  it('reads Super 7s tiers and Sweet 16 pushes', () => {
    expect(enabled(decode(18)).map(rule => rule.payTenths / 10)).toEqual([5000, 500, 100, 50, 3]);
    expect(enabled(decode(19)).map(rule => rule.payTenths)).toEqual([0, 0, 10, 10, 10]);
  });

  it('reads an imported definition the same way', () => {
    const imported = `|My Game${SIDE_BET_GAME_DEFINITIONS[5].slice(SIDE_BET_GAME_DEFINITIONS[5].indexOf('|', 1))}`;
    const game = decodeSideBetGame(imported);
    expect(game.name).toBe('My Game');
    expect(enabled(game).map(rule => rule.payTenths)).toEqual(enabled(decode(5)).map(rule => rule.payTenths));
  });

  it('rejects a definition with no field list', () => {
    expect(() => decodeSideBetGame('|Broken')).toThrow();
  });
});
