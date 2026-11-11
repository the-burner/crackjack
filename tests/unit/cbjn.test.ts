// Casino games copied from Current Blackjack News, as the table's settings.
import { describe, it, expect } from 'vitest';
import { cbjnTable } from '@/settings/cbjn';
import { CASINO_TABLES } from '@/data/casino-tables';
import { TABLE_SETTINGS } from '@/settings/table-settings';
import { tableSummary } from '@/settings/table-summary';
import type { SettingKey, SettingsPatch } from '@/settings/schema';

const table = (id: string) => cbjnTable(CASINO_TABLES.find(t => t.id === id)!);
const summary = (values: SettingsPatch) => tableSummary(key => values[key as SettingKey] as never);

describe('a CBJN game', () => {
  it("starts from CBJN's baseline: S17, no doubling after splits, no surrender, resplits to four but not aces", () => {
    const { values } = cbjnTable({ decks: 6, cut: 1.5, min: 10, max: 500, rules: '' });
    expect(values).toMatchObject({
      'rules.dealerHitsSoft17': false,
      'rules.doubleAfterSplit': false,
      'rules.surrender': 'none',
      'rules.maxSplitHands': 4,
      'rules.resplitAces': false,
      'rules.hitSplitAces': false,
      'rules.insurance': 'normal',
      'rules.blackjackPayout': '3:2',
      'table.decks': 6,
      'table.cardsBehindCutCard': 78,
      'table.cardsFaceDown': false,
    });
    // Every one of the table's settings, and nothing else.
    expect(Object.keys(values).sort()).toEqual([...TABLE_SETTINGS].sort());
  });

  it('deals one and two decks face down, even from a shoe, and more face up', () => {
    const faceDown = (decks: number, rules = '') =>
      cbjnTable({ decks, cut: 0.5, min: 5, max: 500, rules }).values['table.cardsFaceDown'];
    expect([faceDown(1), faceDown(2), faceDown(2, 'shoe'), faceDown(4), faceDown(6)]).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('refuses a rules code it does not know, and keeps apart the ones the table does not play', () => {
    expect(() => cbjnTable({ decks: 6, cut: 1, min: 5, max: 500, rules: 'h17,zz' })).toThrow('zz');
    expect(cbjnTable({ decks: 6, cut: 1, min: 5, max: 500, rules: 'h17,nms,pv,toke' }).notPlayed).toEqual([
      'nms',
      'pv',
      'toke',
    ]);
  });
});

describe("Emerald Queen's three games (Tacoma, WA)", () => {
  it('double deck: H17 DAS LS, $25–$500, face down, 0.8 decks behind the cut card', () => {
    const { values, notPlayed } = table('emerald-queen-2d');
    expect(values).toMatchObject({
      'table.decks': 2,
      'table.cardsBehindCutCard': 42,
      'table.cardsFaceDown': true,
      'table.minBet': 25,
      'table.maxBet': 500,
      'rules.dealerHitsSoft17': true,
      'rules.doubleAfterSplit': true,
      'rules.surrender': 'late',
      'rules.resplitAces': false,
    });
    expect(notPlayed).toEqual(['nms', 'sc', 'pv']);
    expect(summary(values)).toBe('2D H17 DAS LS · $25–$500');
  });

  it('eight-deck shoe: H17 DAS LS RSA, $15–$500, face up, 1.1 decks behind the cut card', () => {
    const { values } = table('emerald-queen-8d');
    expect(values).toMatchObject({
      'table.decks': 8,
      'table.cardsBehindCutCard': 57,
      'table.cardsFaceDown': false,
      'table.minBet': 15,
      'table.maxBet': 500,
      'rules.resplitAces': true,
    });
    expect(summary(values)).toBe('8D H17 DAS LS RSA · $15–$500');
  });

  it("Spanish 21: the game's own Spanish 21, six decks, $15–$500", () => {
    const { values } = table('emerald-queen-spanish-21');
    expect(values).toMatchObject({
      'bonuses.game': 17,
      'table.decks': 6,
      'table.cardsBehindCutCard': 88,
      'rules.dealerHitsSoft17': true,
      'rules.playerBlackjackAlwaysWins': true,
      'rules.doubleDownRescue': true,
    });
    expect(summary(values)).toMatch(/^Spanish 21 · 6D H17 /);
  });
});
