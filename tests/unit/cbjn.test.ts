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
    const { values, notPlayed } = cbjnTable({ decks: 6, cut: 1, min: 5, max: 500, rules: 'h17,nms,pv,toke' });
    expect(notPlayed).toEqual(['toke']);
    // Penetration that varies: a quarter deck either way in a shoe, 8 cards in a one- or two-deck game.
    expect(values['table.cutCardVaries']).toBe(13);
    const varies = (decks: number) =>
      cbjnTable({ decks, cut: 0.8, min: 5, max: 500, rules: 'pv' }).values['table.cutCardVaries'];
    expect([varies(1), varies(2), varies(4), varies(8)]).toEqual([8, 8, 13, 13]);
    // No mid-entry, whichever way it is written.
    expect(values['table.noMidShoeEntry']).toBe(true);
    expect(cbjnTable({ decks: 6, cut: 1, min: 5, max: 500, rules: 'nm' }).values['table.noMidShoeEntry']).toBe(true);
    expect(cbjnTable({ decks: 6, cut: 1, min: 5, max: 500, rules: 'h17' }).values['table.noMidShoeEntry']).toBe(false);
  });
});

describe('every rules code', () => {
  const rules = (code: string) => cbjnTable({ decks: 6, cut: 1.5, min: 10, max: 500, rules: code }).values;

  it('plays each variation the guide lists', () => {
    expect(rules('esxa')['rules.surrender']).toBe('earlyExceptAce');
    expect(rules('lsxa')['rules.surrender']).toBe('lateExceptAce');
    expect(rules('rsa3')).toMatchObject({ 'rules.resplitAces': true, 'rules.resplitAcesOnce': true });
    expect(rules('ur')['rules.maxSplitHands']).toBe(8);
    expect(rules('uria')).toMatchObject({ 'rules.maxSplitHands': 8, 'rules.resplitAces': true });
    expect(rules('nmm')).toMatchObject({ 'table.noMidShoeEntry': true, 'table.noSpreadingMidShoe': true });
    expect(rules('nmo')).toMatchObject({ 'table.newPlayersWaitForShuffle': true, 'table.noMidShoeEntry': false });
    expect(rules('nso')['table.noSpreadingMidShoe']).toBe(true);
    expect(rules('nto')['table.noSpreadingMidShoe']).toBe(true);
    expect(rules('1spot')['table.oneSpot']).toBe(true);
    expect(rules('ns10')['rules.noTenSplits']).toBe(true);
    expect(rules('hide')).toMatchObject({ 'table.cardsFaceDown': true, 'table.showCardsOnlyWhenNeeded': true });
  });

  it('turns every code in the guide into settings or keeps it apart, and refuses none', () => {
    const all =
      'ds,h17,pv,rsa,s17,nm,ls,shoe,notch,spanish,sc,rs3,d9,d10,esxa,nms,ddd,rsa3,nmm,nrs,uria,hide,d8,ur,nmo,ni,dsa,nto,enhc,nsjq,nso,1spot,ns10,nhsa';
    for (const code of all.split(',')) expect(() => rules(code), code).not.toThrow();
  });
});

describe("Emerald Queen's three games (Tacoma, WA)", () => {
  it('double deck: H17 DAS LS, no mid-shoe entry, $25–$500, face down, 0.8 decks behind the cut card', () => {
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
      'table.noMidShoeEntry': true,
    });
    expect(notPlayed).toEqual(['sc']);
    expect(summary(values)).toBe('2D H17 DAS LS NM PV · $25–$500');
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
    expect(summary(values)).toBe('8D H17 DAS LS RSA PV · $15–$500');
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

describe('the Seattle and Tacoma games', () => {
  it('are every one CBJN lists there, found by searching for the area', () => {
    const seattle = CASINO_TABLES.filter(t => t.place.includes('Seattle area'));
    expect(seattle.map(t => t.name)).toEqual([
      'Caribbean Kirkland 6-Deck Shoe',
      'Fortune Renton 6-Deck Shoe',
      'Imperial Palace Auburn Double Deck',
      'Imperial Palace Auburn 6-Deck Shoe',
      'Imperial Palace Tukwila Double Deck',
      'Muckleshoot Double Deck',
      'Muckleshoot 8-Deck Shoe',
      'Muckleshoot Spanish 21',
      'Snoqualmie 8-Deck Shoe',
      'Snoqualmie Spanish 21',
    ]);
    expect(CASINO_TABLES.filter(t => t.place === 'Tacoma, WA')).toHaveLength(3);
  });

  it("read as CBJN lists them: Imperial Auburn's double deck doubles on 9 to 11 only, face down", () => {
    expect(summary(table('imperial-auburn-2d').values)).toBe('2D H17 D9 · $25–$400');
    expect(table('imperial-auburn-2d').values['table.cardsFaceDown']).toBe(true);
    expect(summary(table('muckleshoot-2d').values)).toBe('2D H17 DAS NM PV · $25–$2,500');
    expect(summary(table('snoqualmie-8d').values)).toBe('8D H17 DAS RSA · $10–$500');
  });
});

describe('the Chicago-area games', () => {
  it('are every one CBJN lists there', () => {
    expect(CASINO_TABLES.filter(t => t.place.includes('Chicago area'))).toHaveLength(15);
  });

  it('read as CBJN lists them', () => {
    expect(summary(table('american-place-2d').values)).toBe('2D H17 DAS RSA NM PV · $50–$10,000');
    expect(summary(table('harrahs-joliet-6d-s17').values)).toBe('6D S17 DAS RSA NM · $25–$2,000');
    expect(summary(table('rivers-des-plaines-6d-s17').values)).toBe('6D S17 DAS NM PV · $25–$25,000');
    expect(table('wind-creek-spanish-21').values).toMatchObject({ 'bonuses.game': 17, 'table.decks': 8 });
  });
});
