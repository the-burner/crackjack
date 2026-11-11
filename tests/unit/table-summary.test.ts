// The line under each table's name: its rules in the shorthand guides use, then its limits.
import { describe, it, expect } from 'vitest';
import { tableSummary } from '@/settings/table-summary';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import type { SettingKey, SettingValues } from '@/settings/schema';

const summary = (values: Partial<SettingValues>) =>
  tableSummary(<K extends SettingKey>(key: K) => (values[key] ?? SETTINGS_SCHEMA[key].default) as SettingValues[K]);

describe('a table summary', () => {
  it("reads a fresh install's table", () => {
    expect(summary({})).toBe('6D H17 DAS LS · $15–$5,000');
  });

  it('names every rule it shows', () => {
    expect(
      summary({
        'table.decks': 2,
        'rules.dealerHitsSoft17': false,
        'rules.noHoleCard': true,
        'rules.dealerBlackjackWinsAll': true,
        'rules.doubleAfterSplit': false,
        'rules.hardDoubles': '10-11',
        'rules.doubleOnThreeCards': true,
        'rules.surrender': 'earlyExceptAce',
        'rules.resplitAces': true,
        'rules.resplitAcesOnce': true,
        'rules.maxSplitHands': 3,
        'rules.insurance': 'none',
        'rules.blackjackPayout': '6:5',
        'rules.noTenSplits': true,
        'table.noMidShoeEntry': true,
        'table.noSpreadingMidShoe': true,
        'table.oneSpot': true,
        'table.cardsFaceDown': true,
        'table.showCardsOnlyWhenNeeded': true,
        'table.cutCardVaries': 8,
        'table.minBet': 1,
        'table.maxBet': 100000,
      }),
    ).toBe('2D S17 ENHC D10 D3 ESXA RSA3 RS3 No insurance BJ 6:5 NS10 NM NSO 1 spot Hide PV · $1–$100,000');
  });

  it('tells apart the other choices of each rule', () => {
    expect(summary({ 'rules.noHoleCard': true, 'rules.dealerBlackjackWinsAll': false })).toContain(' NHC ');
    expect(summary({ 'rules.softDoubles': 'none' })).toContain('No soft doubles');
    expect(summary({ 'rules.hardDoubles': 'none' })).toContain('No doubles');
    expect(summary({ 'rules.hardDoubles': '8-11' })).toContain('D8');
    expect(summary({ 'rules.hardDoubles': '9-11' })).toContain('D9');
    for (const [surrender, code] of [
      ['none', null],
      ['early', 'ES'],
      ['earlyVsTen', 'ES10'],
      ['macao', 'Macao surrender'],
      ['lateExceptAce', 'LSXA'],
    ] as const) {
      const line = summary({ 'rules.surrender': surrender });
      if (code) expect(line).toContain(code);
      else expect(line).not.toMatch(/\b(LS|ES)\b/);
    }
    expect(summary({ 'rules.resplitAces': true })).toMatch(/ RSA /);
    expect(summary({ 'rules.maxSplitHands': 2 })).toContain('NRS');
    expect(summary({ 'rules.maxSplitHands': 8 })).toContain('UR');
    expect(summary({ 'table.newPlayersWaitForShuffle': true })).toContain('NMO');
    // Shown only when needed means nothing in a face-up game.
    expect(summary({ 'table.showCardsOnlyWhenNeeded': true })).not.toContain('Hide');
    expect(summary({ 'bonuses.game': 17 })).toMatch(/^Spanish 21 · /);
  });
});
