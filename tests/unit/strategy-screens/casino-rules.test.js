import { describe, it, expect } from 'vitest';
import {
  casinoDetailRows, casinoRuleSettings, parseCasinoDatabase, parseCasinoRecord,
  searchCasinoDatabase, summarizeCasinoRecord,
} from '../../../public/src/settings/casino-rules.js';
import { SETTINGS_SCHEMA } from '../../../public/src/settings/schema.js';

// Real records from the live CBJN download (1 October 2026).
const ALIANTE_2D = 'Aliante (Boyd)^U.S.^Nevada^Aliante (Boyd), 7300 Aliante Pkwy.^7^40^Las Vegas^h17,ds,nm,sc,pv^15^1000^2^9';
const ARIA_6D = 'Aria (MGM)^U.S.^Nevada^Aria (MGM), 3730 S. Las Vegas Blvd.^15^26^Las Vegas^s17,ds,ls,rsa,pv^500^10000^6^4';
const DATABASE = `              8997783~10/1/2026|\r\n              ${ALIANTE_2D}|\r\n              ${ARIA_6D}|   `;

describe('parseCasinoDatabase', () => {
  it('reads the date out of an "<id>~<date>" header', () => {
    expect(parseCasinoDatabase(DATABASE, '8997783')).toMatchObject({ date: '10/1/2026' });
  });

  it('keeps only real records, dropping the trailing whitespace', () => {
    expect(parseCasinoDatabase(DATABASE, '8997783').records).toHaveLength(2);
  });

  it('rejects a mismatched CBJN id', () => {
    expect(() => parseCasinoDatabase(DATABASE, '1234')).toThrow(/Incorrect CBJN id/);
  });

  it('accepts the older header that is just a date', () => {
    expect(parseCasinoDatabase(`  6/1/2015|${ALIANTE_2D}|`, 'anything')).toMatchObject({ date: '6/1/2015' });
  });
});

describe('parseCasinoRecord', () => {
  it('reads every field', () => {
    expect(parseCasinoRecord(ALIANTE_2D)).toMatchObject({
      name: 'Aliante (Boyd)',
      country: 'U.S.',
      state: 'Nevada',
      penetration: 0.7,
      edge: 0.4,
      location: 'Las Vegas',
      rules: ['h17', 'ds', 'nm', 'sc', 'pv'],
      minBet: '15',
      maxBet: '1000',
      decks: 2,
      tables: '9',
    });
  });

  it('summarizes a record for the result list', () => {
    expect(summarizeCasinoRecord(parseCasinoRecord(ALIANTE_2D)))
      .toBe('Aliante (Boyd), Las Vegas, Decks:2, Edge:0.4, 15-1000, h17,ds,nm,sc,pv');
  });

  it('lists the detail rows in the original order', () => {
    expect(casinoDetailRows(parseCasinoRecord(ALIANTE_2D)).map(r => r[0]))
      .toEqual(['Casino', 'Location', 'State', 'Tables', 'Edge', 'Decks', 'Penetration', 'Limits', 'Rules', 'Notes']);
  });
});

describe('searchCasinoDatabase', () => {
  const { records } = parseCasinoDatabase(DATABASE, '8997783');

  it('matches any part of a record, ignoring case', () => {
    expect(searchCasinoDatabase(records, 'ARIA').records.map(r => r.name)).toEqual(['Aria (MGM)']);
    expect(searchCasinoDatabase(records, 'las vegas').records).toHaveLength(2);
    expect(searchCasinoDatabase(records, 'rsa').records.map(r => r.name)).toEqual(['Aria (MGM)']);
  });

  it('finds nothing when nothing matches', () => {
    expect(searchCasinoDatabase(records, 'reno').records).toEqual([]);
  });

  it('caps the number of hits', () => {
    expect(searchCasinoDatabase(records, 'Vegas', { limit: 1 })).toMatchObject({ truncated: true });
    expect(searchCasinoDatabase(records, 'Vegas', { limit: 1 }).records).toHaveLength(1);
  });
});

describe('casinoRuleSettings', () => {
  const load = raw => casinoRuleSettings(parseCasinoRecord(raw));
  const rules = tokens => load(`C^U.S.^NV^notes^15^40^City^${tokens}^5^500^6^1`);

  it('only writes keys that exist in the schema', () => {
    for (const key of Object.keys(load(ALIANTE_2D))) expect(SETTINGS_SCHEMA).toHaveProperty(key);
  });

  it('loads the deck count and the cards behind the cut card', () => {
    // 0.7 decks cut off on a double-deck game.
    expect(load(ALIANTE_2D)).toMatchObject({ 'table.decks': 2, 'table.cardsBehindCutCard': 36 });
    // 1.5 decks cut off on a six-deck game.
    expect(load(ARIA_6D)).toMatchObject({ 'table.decks': 6, 'table.cardsBehindCutCard': 78 });
  });

  it('follows the h17/s17 token', () => {
    expect(rules('h17,ds')['rules.dealerHitsSoft17']).toBe(true);
    expect(rules('s17,ds')['rules.dealerHitsSoft17']).toBe(false);
    expect(rules('ds')['rules.dealerHitsSoft17']).toBe(false);
  });

  it('only allows double after split when "ds" is listed', () => {
    expect(rules('h17,ds')['rules.doubleAfterSplit']).toBe(true);
    expect(rules('h17')['rules.doubleAfterSplit']).toBe(false);
  });

  it('leaves dealer peeking and insure-then-surrender on', () => {
    expect(rules('h17')).toMatchObject({
      'rules.dealerPeeksTen': true,
      'rules.dealerPeeksAce': true,
      'rules.surrenderAfterInsurance': true,
    });
  });

  it('maps the surrender tokens', () => {
    expect(rules('h17')['rules.surrender']).toBe('none');
    expect(rules('ls')['rules.surrender']).toBe('late');
    expect(rules('es10')['rules.surrender']).toBe('earlyVsTen');
    expect(rules('e10')['rules.surrender']).toBe('earlyVsTen');
    expect(rules('es')['rules.surrender']).toBe('early');
  });

  it('maps the double restrictions', () => {
    expect(rules('h17')).toMatchObject({ 'rules.hardDoubles': 'any', 'rules.softDoubles': 'any' });
    expect(rules('d8')).toMatchObject({ 'rules.hardDoubles': '8-11', 'rules.softDoubles': 'a8a9' });
    expect(rules('d9')).toMatchObject({ 'rules.hardDoubles': '9-11', 'rules.softDoubles': 'a8a9' });
    expect(rules('d10')).toMatchObject({ 'rules.hardDoubles': '10-11', 'rules.softDoubles': 'a8a9' });
    expect(rules('d11')).toMatchObject({ 'rules.hardDoubles': '10-11', 'rules.softDoubles': 'a8a9' });
  });

  it('maps "d3" to doubling on the first three cards, not on any number', () => {
    expect(rules('d3')).toMatchObject({ 'rules.doubleOnThreeCards': true, 'rules.doubleAnyNumberOfCards': false });
    expect(rules('da')).toMatchObject({ 'rules.doubleOnThreeCards': false, 'rules.doubleAnyNumberOfCards': true });
  });

  it('maps splitting, insurance and payout tokens', () => {
    expect(rules('nrs')['rules.maxSplitHands']).toBe(2);
    expect(rules('h17')['rules.maxSplitHands']).toBe(4);
    expect(rules('rsa')['rules.resplitAces']).toBe(true);
    expect(rules('nsa')['rules.noAceSplits']).toBe(true);
    expect(rules('hsa')['rules.hitSplitAces']).toBe(true);
    expect(rules('ni')['rules.insurance']).toBe('none');
    expect(rules('h17')['rules.insurance']).toBe('normal');
    expect(rules('6:5')['rules.blackjackPayout']).toBe('6:5');
    expect(rules('1:1')['rules.blackjackPayout']).toBe('1:1');
    expect(rules('h17')['rules.blackjackPayout']).toBe('3:2');
  });

  it('maps the bonus tokens', () => {
    expect(rules('ddr')['rules.doubleDownRescue']).toBe(true);
    expect(rules('5')['bonuses.fiveCard21']).toBe(true);
    expect(rules('6')['rules.autoWinSixCards']).toBe(true);
    expect(rules('21d')['bonuses.diamondBlackjack']).toBe(true);
  });

  it('ignores tokens the game has no rule for', () => {
    expect(rules('pv,nm,sc,notch,shoe,Spanish,uria')).toEqual(rules(''));
  });
});
