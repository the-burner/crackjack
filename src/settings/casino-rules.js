// The Current Blackjack News (CBJN) casino database: parsing the downloaded
// file, searching it, and turning a casino's rule string into settings.
//
// The download is one long text: a header record, then one record per game,
// separated by "|". Each record is "^"-separated fields (see FIELDS).

/** Record fields, in the order they appear. */
const FIELDS = [
  'name', 'country', 'state', 'notes', 'penetration', 'edge', 'location',
  'rules', 'minBet', 'maxBet', 'decks', 'tables',
];

/** Largest number of search results shown. */
export const MAX_RESULTS = 50;

/**
 * Splits the downloaded database into its date and its raw records.
 *
 * The header is either `<id>~<date>` — in which case the id must match the
 * CBJN id that was entered — or a bare date (the older format, recognised by
 * containing a "/").
 *
 * @param {string} text
 * @param {string} cbjnId
 * @returns {{date: string, records: string[]}}
 * @throws {Error} when the header's id does not match `cbjnId`.
 */
export function parseCasinoDatabase(text, cbjnId) {
  const parts = String(text).split('|');
  const header = parts[0].split('~');
  const id = header[0].trim();
  let date = id;
  if (!id.includes('/')) {
    if (id !== String(cbjnId).trim()) throw new Error('Incorrect CBJN id.');
    date = header[1];
  }
  const records = parts.slice(1).filter(r => r.includes('^'));
  return { date: String(date).trim(), records };
}

/**
 * One game record.
 * @returns {{name: string, country: string, state: string, notes: string,
 *   penetration: number, edge: number, location: string, rules: string[],
 *   minBet: string, maxBet: string, decks: number, tables: string, raw: string}}
 */
export function parseCasinoRecord(raw) {
  const parts = String(raw).split('^');
  const field = name => (parts[FIELDS.indexOf(name)] ?? '').trim();
  return {
    name: field('name'),
    country: field('country'),
    state: field('state'),
    notes: field('notes'),
    /** Decks cut off behind the cut card. */
    penetration: Number(field('penetration')) / 10,
    /** House edge in percent. */
    edge: Number(field('edge')) / 100,
    location: field('location'),
    rules: field('rules').split(',').map(t => t.trim()).filter(Boolean),
    minBet: field('minBet'),
    maxBet: field('maxBet'),
    decks: Number(field('decks')),
    tables: field('tables'),
    raw,
  };
}

/** The one-line summary shown in the result list. */
export function summarizeCasinoRecord(record) {
  const { name, location, decks, edge, minBet, maxBet, rules } = record;
  return `${name}, ${location}, Decks:${decks}, Edge:${edge}, ${minBet}-${maxBet}, ${rules.join(',')}`;
}

/**
 * Case-insensitive substring search over whole records (so a rule code, a
 * city or a state all match), capped at MAX_RESULTS.
 * @returns {{records: object[], truncated: boolean}}
 */
export function searchCasinoDatabase(records, query, { limit = MAX_RESULTS } = {}) {
  const needle = String(query).trim().toLowerCase();
  const out = [];
  for (const raw of records) {
    if (!raw.toLowerCase().includes(needle)) continue;
    if (out.length === limit) return { records: out, truncated: true };
    out.push(parseCasinoRecord(raw));
  }
  return { records: out, truncated: false };
}

/** The rows of the detail screen. */
export function casinoDetailRows(record) {
  return [
    ['Casino', record.name],
    ['Location', record.location],
    ['State', record.state],
    ['Tables', record.tables],
    ['Edge', String(record.edge)],
    ['Decks', String(record.decks)],
    ['Penetration', String(record.penetration)],
    ['Limits', `${record.minBet}-${record.maxBet}`],
    ['Rules', record.rules.join(',')],
    ['Notes', record.notes],
  ];
}

const CARDS_PER_DECK = 52;

/**
 * The settings a casino's rules map onto, as a patch for `settings.update()`.
 *
 * Every rule the game understands is set explicitly — rules the casino does
 * not list are turned off — so loading a casino never leaves part of a
 * previous casino's rules behind.
 *
 * @param {object} record  Result of parseCasinoRecord().
 * @returns {Record<string, *>}
 */
export function casinoRuleSettings(record) {
  const has = token => record.rules.includes(token);
  const patch = {
    'table.decks': record.decks,
    'table.cardsBehindCutCard': Math.round(CARDS_PER_DECK * record.penetration),
    'table.doubleDownCardFaceUp': true,
    'mechanics.dealerPointsOutStupidPlays': true,
    'rules.dealerPeeksTen': true,
    'rules.dealerPeeksAce': true,
    'rules.surrenderAfterInsurance': true,
    'rules.dealerHitsSoft17': has('h17'),
    'rules.doubleAfterSplit': has('ds'),
    'rules.insurance': has('ni') ? 'none' : 'normal',
    'rules.hardDoubles': 'any',
    'rules.softDoubles': 'any',
    'rules.maxSplitHands': has('nrs') ? 2 : 4,
    'rules.resplitAces': has('rsa'),
    'rules.hitSplitAces': has('hsa'),
    'rules.noAceSplits': has('nsa'),
    'rules.surrender': 'none',
    'rules.doubleAnyNumberOfCards': has('da') || has('dab'),
    'rules.doubleOnThreeCards': has('d3'),
    'rules.doubleDownRescue': has('ddr'),
    'rules.redouble': false,
    'rules.tripleDown': false,
    'rules.blackjackPayout': '3:2',
    'rules.autoWinSixCards': has('6'),
    'bonuses.fiveCard21': has('5'),
    'bonuses.diamondBlackjack': has('21d'),
    'dealerErrors.loseOnPush': false,
  };
  // Hard and soft double restrictions. "d11" is treated like "d10" because the
  // game has no "eleven only" option.
  if (has('d8')) { patch['rules.hardDoubles'] = '8-11'; patch['rules.softDoubles'] = 'a8a9'; }
  if (has('d9')) { patch['rules.hardDoubles'] = '9-11'; patch['rules.softDoubles'] = 'a8a9'; }
  if (has('d10') || has('d11')) { patch['rules.hardDoubles'] = '10-11'; patch['rules.softDoubles'] = 'a8a9'; }
  // Surrender: the most permissive listed form wins.
  if (has('ls')) patch['rules.surrender'] = 'late';
  if (has('es10') || has('e10')) patch['rules.surrender'] = 'earlyVsTen';
  if (has('es')) patch['rules.surrender'] = 'early';
  // Blackjack payout.
  if (has('6:5')) patch['rules.blackjackPayout'] = '6:5';
  if (has('1:1')) patch['rules.blackjackPayout'] = '1:1';
  return patch;
}
