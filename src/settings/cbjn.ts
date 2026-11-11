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
  esxa: { 'rules.surrender': 'earlyExceptAce' },
  lsxa: { 'rules.surrender': 'lateExceptAce' },
  ni: { 'rules.insurance': 'none' },
  nrs: { 'rules.maxSplitHands': 2 },
  rs3: { 'rules.maxSplitHands': 3 },
  rsa: { 'rules.resplitAces': true },
  rsa3: { 'rules.resplitAces': true, 'rules.resplitAcesOnce': true },
  ur: { 'rules.maxSplitHands': 8 },
  uria: { 'rules.maxSplitHands': 8, 'rules.resplitAces': true },
  nsa: { 'rules.noAceSplits': true },
  nsjq: { 'rules.splitTensSameRankOnly': true },
  nhsa: { 'rules.hitSplitAces': false },
  // No mid-entry, also with no sitting out (nms) or no spreading to more hands (nmm), of which the table plays the first.
  nm: { 'table.noMidShoeEntry': true },
  nms: { 'table.noMidShoeEntry': true },
  nmm: { 'table.noMidShoeEntry': true, 'table.noSpreadingMidShoe': true },
  // No mid-entry on request: a seated player may ask that no one new sits down.
  nmo: { 'table.newPlayersWaitForShuffle': true },
  // No spreading to more hands mid-shoe; nto is its second half (no going back up after dropping a hand).
  nso: { 'table.noSpreadingMidShoe': true },
  nto: { 'table.noSpreadingMidShoe': true },
  '1spot': { 'table.oneSpot': true },
  ns10: { 'rules.noTenSplits': true },
  hide: { 'table.cardsFaceDown': true, 'table.showCardsOnlyWhenNeeded': true },
};

/** Codes for what the table does not play or that changes nothing: fixed penetration, tipping, mid-entry at the minimum, how the cards are held. */
const NOT_PLAYED = new Set(['notch', 'toke', 'min', 'sc', 'shoe']);

/** The game's own Spanish 21 (an unusual game), whose rules it sets. */
const SPANISH_21 = 17;

const CARDS_PER_DECK = 52;

/** The table's settings for `game`, with the codes it lists that the table does not play. */
export function cbjnTable(game: CbjnGame): { values: SettingsPatch; notPlayed: string[] } {
  const codes = game.rules
    .split(',')
    .map(code => code.trim().toLowerCase())
    .filter(Boolean);
  const unknown = codes.filter(
    code => !(code in RULES) && !NOT_PLAYED.has(code) && code !== 'spanish' && code !== 'pv',
  );
  if (unknown.length) throw new Error(`Unknown CBJN rules code: ${unknown.join(', ')}`);
  const defaults = Object.fromEntries(TABLE_SETTINGS.map(key => [key, structuredClone(SETTINGS_SCHEMA[key].default)]));
  let values: SettingsPatch = {
    ...defaults,
    ...BASELINE,
    'table.decks': game.decks as SettingsPatch['table.decks'],
    'table.cardsBehindCutCard': Math.round(game.cut * CARDS_PER_DECK),
    'table.minBet': game.min,
    'table.maxBet': game.max,
    // One and two decks are dealt face down, more face up.
    'table.cardsFaceDown': game.decks <= 2,
  };
  if (codes.includes('spanish')) {
    const get = ((key: SettingKey) => values[key]) as SettingReader;
    values = { ...values, ...applyGameChange(get, SPANISH_21) };
  }
  for (const code of codes) values = { ...values, ...RULES[code] };
  // Penetration that varies by dealer or shift: 8 cards either way in a one- or two-deck game, a quarter deck in a shoe.
  if (codes.includes('pv')) values['table.cutCardVaries'] = game.decks <= 2 ? 8 : 13;
  return { values, notPlayed: codes.filter(code => NOT_PLAYED.has(code)) };
}
