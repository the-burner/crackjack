// A game as Current Blackjack News lists it (decks, cut, minimum, maximum and its rules codes), as the table's
// settings. Its rules codes are departures from CBJN's baseline game; codes for things the table cannot play
// are kept apart, and an unknown code is an error, so an import never guesses.

import { SETTINGS_SCHEMA } from './schema';
import type { SettingKey, SettingReader, SettingsPatch } from './schema';
import { applyGameChange } from './rules-logic';
import { TABLE_SETTINGS } from './table-settings';

export interface CbjnGame {
  decks: number;
  /** Decks still unseen when the dealer shuffles (where the cut card sits). */
  cut: number;
  min: number;
  max: number;
  /** The rules column, e.g. "h17,ds,ls,rsa,pv". */
  rules: string;
}

/** CBJN's baseline: 3:2, one bet lost to a dealer blackjack, double any two but not after splitting, resplits to four except aces, one card to split aces, insurance, no surrender (and S17 unless h17). */
const BASELINE: SettingsPatch = {
  'rules.dealerHitsSoft17': false,
  'rules.doubleAfterSplit': false,
  'rules.surrender': 'none',
  'rules.hardDoubles': 'any',
  'rules.softDoubles': 'any',
  'rules.maxSplitHands': 4,
  'rules.resplitAces': false,
  'rules.hitSplitAces': false,
  'rules.insurance': 'normal',
  'rules.blackjackPayout': '3:2',
  'rules.noHoleCard': false,
  'rules.dealerBlackjackWinsAll': false,
  'table.shuffleMode': 'cutCard',
};

const RULES: Readonly<Record<string, SettingsPatch>> = {
  h17: { 'rules.dealerHitsSoft17': true },
  s17: { 'rules.dealerHitsSoft17': false },
  ds: { 'rules.doubleAfterSplit': true },
  dsa: { 'rules.doubleAfterSplitAces': true },
  d3: { 'rules.doubleOnThreeCards': true },
  d8: { 'rules.hardDoubles': '8-11', 'rules.softDoubles': 'none' },
  d9: { 'rules.hardDoubles': '9-11', 'rules.softDoubles': 'none' },
  d10: { 'rules.hardDoubles': '10-11', 'rules.softDoubles': 'none' },
  ddd: { 'rules.redouble': true },
  enhc: { 'rules.noHoleCard': true, 'rules.dealerBlackjackWinsAll': true },
  ls: { 'rules.surrender': 'late' },
  es10: { 'rules.surrender': 'earlyVsTen' },
  ni: { 'rules.insurance': 'none' },
  nrs: { 'rules.maxSplitHands': 2 },
  rs3: { 'rules.maxSplitHands': 3 },
  rsa: { 'rules.resplitAces': true },
  nsa: { 'rules.noAceSplits': true },
  nsjq: { 'rules.splitTensSameRankOnly': true },
  nhsa: { 'rules.hitSplitAces': false },
};

/** Codes for what the table does not play (mid-entry, penetration that varies, tipping, how the cards are held). */
const NOT_PLAYED = new Set([
  'pv',
  'notch',
  'toke',
  'nm',
  'nmm',
  'nmo',
  'nms',
  'nso',
  'nto',
  'min',
  '1spot',
  'sc',
  'shoe',
]);

/** The game's own Spanish 21 (an unusual game), whose rules it sets. */
const SPANISH_21 = 17;

const CARDS_PER_DECK = 52;

/** The table's settings for `game`, with the codes it lists that the table does not play. */
export function cbjnTable(game: CbjnGame): { values: SettingsPatch; notPlayed: string[] } {
  const codes = game.rules
    .split(',')
    .map(code => code.trim().toLowerCase())
    .filter(Boolean);
  const unknown = codes.filter(code => !(code in RULES) && !NOT_PLAYED.has(code) && code !== 'spanish');
  if (unknown.length) throw new Error(`Unknown CBJN rules code: ${unknown.join(', ')}`);
  const defaults = Object.fromEntries(TABLE_SETTINGS.map(key => [key, structuredClone(SETTINGS_SCHEMA[key].default)]));
  let values: SettingsPatch = {
    ...defaults,
    ...BASELINE,
    'table.decks': game.decks as SettingsPatch['table.decks'],
    'table.cardsBehindCutCard': Math.round(game.cut * CARDS_PER_DECK),
    'table.minBet': game.min,
    'table.maxBet': game.max,
    // One and two decks are pitched (held) and dealt face down unless dealt from a shoe.
    'table.cardsFaceDown': game.decks <= 2 && !codes.includes('shoe'),
  };
  if (codes.includes('spanish')) {
    const get = ((key: SettingKey) => values[key]) as SettingReader;
    values = { ...values, ...applyGameChange(get, SPANISH_21) };
  }
  for (const code of codes) values = { ...values, ...RULES[code] };
  return { values, notPlayed: codes.filter(code => NOT_PLAYED.has(code)) };
}
