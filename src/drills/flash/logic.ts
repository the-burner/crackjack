// @ts-nocheck
// Flash drills: which hands to drill, how to deal one, and what the correct
// play is. No DOM, no timers — the screen drives all of this.

import { cardId, handTotals, valueName } from '../../core/cards.ts';
import { randomInt, shuffle } from '../../core/random.ts';
import { NEVER, ALWAYS, TABLE_NAMES } from '../../core/strategy/strategy-file.ts';
import { advisePlay, ACTION, SECTION, PROBE, NO_INDEX_MARKER } from '../../core/strategy/advisor.ts';

/** The six kinds of hand a drill can ask about; the keys are also the strategy table names. */
export const SITUATIONS = ['hardStand', 'softStand', 'hardDouble', 'softDouble', 'split', 'surrender'];

export const SITUATION_LABELS = {
  hardStand: 'Hard H/S',
  softStand: 'Soft H/S',
  hardDouble: 'Hard DD',
  softDouble: 'Soft DD',
  split: 'Split',
  surrender: 'Surrender',
};

/** Rows of each table, top to bottom, as the hand value the row stands for. */
const TABLE_ROWS = {
  hardStand: [17, 16, 15, 14, 13, 12, 11, 10],
  hardDouble: [11, 10, 9, 8, 7, 6, 5],
  split: [1, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  surrender: [17, 16, 15, 14, 13, 12],
  softStand: [9, 8, 7, 6, 5, 4, 3, 2],
  softDouble: [9, 8, 7, 6, 5, 4, 3, 2],
};

/** The order the tables are scanned in when building a hand list. */
const SCAN_ORDER = ['hardStand', 'hardDouble', 'split', 'surrender', 'softStand', 'softDouble'];

/** Table row for a list entry. */
export const rowOf = ({ kind, value }) => TABLE_ROWS[kind].indexOf(value);
/** Table column for a dealer upcard 1..10 (ace = 1). */
export const columnOf = upcard => (upcard === 1 ? 9 : upcard - 2);
/** Dealer upcard 1..10 for a table column. */
export const upcardOf = column => (column === 9 ? 1 : column + 2);

const entry = (kind, upcard, value) => ({ kind, upcard, value });

/**
 * The 127 "Default Hands", weighted by repetition.
 * Each line is one dealer upcard and the hand values drilled against it.
 */
const DEFAULT_HANDS = [
  [
    'hardStand',
    [
      [2, [15, 14, 13, 12]],
      [3, [14, 13, 12]],
      [4, [14, 13, 12]],
      [5, [13, 12]],
      [6, [13, 12]],
      [7, [16]],
      [8, [16, 16, 15]],
      [9, [16, 16, 15, 15, 14]],
      [10, [16, 16, 15, 15, 14, 14]],
      [1, [16, 16, 15, 15]],
    ],
  ],
  [
    'hardDouble',
    [
      [2, [9]],
      [3, [9]],
      [4, [9]],
      [5, [9]],
      [6, [9, 8]],
      [7, [10, 9, 8]],
      [8, [10, 9]],
      [9, [11, 10]],
      [10, [11, 10]],
      [1, [11, 10]],
    ],
  ],
  [
    'softDouble',
    [
      [5, [8, 7, 6, 5, 4, 3, 2]],
      [2, [6, 5, 4]],
      [3, [6, 5, 4, 3, 2]],
      [4, [6, 5, 4, 3, 2]],
      [6, [7, 6, 5, 4, 3, 2]],
    ],
  ],
  [
    'split',
    [
      [2, [9, 7, 6, 3, 2]],
      [3, [9, 7, 6, 3, 2]],
      [4, [10, 9, 7, 6, 3, 2]],
      [5, [10, 9, 7, 6, 5, 4, 2]],
      [6, [10, 9, 7, 6, 5, 4]],
      [7, [9, 7]],
      [8, [9, 7]],
      [9, [1, 9, 7]],
      [10, [1, 8]],
      [1, [1, 8]],
    ],
  ],
  [
    'softStand',
    [
      [6, [7, 6]],
      [7, [7, 6]],
      [8, [7]],
      [9, [8, 7]],
      [10, [8, 7]],
      [1, [8, 7]],
    ],
  ],
].flatMap(([kind, byUpcard]) => byUpcard.flatMap(([upcard, values]) => values.map(v => entry(kind, upcard, v))));

/** The Illustrious 18 playing indices (insurance is not a playing decision). */
const ILLUSTRIOUS_18_HANDS = [
  ...[
    [2, 13],
    [2, 12],
    [3, 13],
    [3, 12],
    [4, 12],
    [5, 12],
    [6, 12],
    [9, 16],
    [10, 16],
    [10, 15],
  ].map(([u, v]) => entry('hardStand', u, v)),
  ...[
    [2, 9],
    [7, 9],
    [10, 10],
    [1, 11],
    [1, 10],
  ].map(([u, v]) => entry('hardDouble', u, v)),
  ...[
    [5, 10],
    [6, 10],
  ].map(([u, v]) => entry('split', u, v)),
];

/** Hand lists that are not built from the strategy tables. */
const FIXED_LISTS = { default: DEFAULT_HANDS, illustrious18: ILLUSTRIOUS_18_HANDS };

/** A strategy cell holds an index (rather than "always" or "never"). */
const hasIndex = value => value !== ALWAYS && value !== NEVER;

/**
 * Scans the strategy tables (column by column) and keeps
 * the cells `keep(table, row, column)` accepts.
 */
function scanTables(situations, keep) {
  const list = [];
  for (const kind of SCAN_ORDER) {
    if (!situations[kind]) continue;
    for (let column = 0; column < 10; column++) {
      TABLE_ROWS[kind].forEach((value, row) => {
        if (keep(kind, row, column)) list.push(entry(kind, upcardOf(column), value));
      });
    }
  }
  return list;
}

/** Which kind of player hand each situation's rows stand for. */
const HAND_TYPE = {
  hardStand: 'hard',
  hardDouble: 'hard',
  surrender: 'hard',
  softStand: 'soft',
  softDouble: 'soft',
  split: 'pair',
};

/**
 * Every distinct player hand against every dealer card, for the chosen
 * situations. Hands are counted by value, not by the cards that make them:
 * hard 10 v 10 appears once even though Hard H/S and Hard DD both have it, and
 * the entry remembers both (`kinds`), so either may be dealt. A pair is its own
 * hand, so 5,5 v 10 is separate from hard 10 v 10.
 * @returns {{kind: string, kinds: string[], upcard: number, value: number}[]}
 */
export function roundRobinEntries(situations) {
  const byHand = new Map();
  for (const e of scanTables(situations, () => true)) {
    const key = `${HAND_TYPE[e.kind]} ${e.value} ${e.upcard}`;
    const found = byHand.get(key);
    if (found) found.kinds.push(e.kind);
    else byHand.set(key, { ...e, kinds: [e.kind] });
  }
  return [...byHand.values()];
}

/**
 * Deals the entries of a list in a random order, each once, then starts a new
 * random order. A new round never begins with the hand the last one ended on.
 */
export class RoundRobin {
  constructor(entries, random) {
    this.entries = entries;
    this.random = random;
    this.queue = [];
    this.last = null;
  }

  next() {
    if (this.queue.length === 0) {
      this.queue = shuffle(this.entries.slice(), this.random);
      // Taken from the end, so the first one dealt is the last element.
      if (this.queue.length > 1 && this.queue[this.queue.length - 1] === this.last) {
        [this.queue[0], this.queue[this.queue.length - 1]] = [this.queue[this.queue.length - 1], this.queue[0]];
      }
    }
    this.last = this.queue.pop() ?? null;
    return this.last;
  }

  /** Whether the hand last dealt was the last of its round. */
  get endsRound() {
    return this.last !== null && this.queue.length === 0;
  }
}

/** Message shown when the chosen hand list turns out to be empty. */
const EMPTY_LIST_MESSAGES = {
  withIndices: 'You have an INDEXES option set. There are no indexes for the situations specified.',
  drillErrors: 'You have an ERRORS option set. There have been no errors of the type and situation specified.',
  custom: 'You have CUSTOM hands set. Use the Select button to choose the hands to be tested.',
};

/**
 * The hands a drill will ask about.
 * @param {object} o
 * @param {string} o.hands        A 'drills.flash.hands' value.
 * @param {Record<string, boolean>} o.situations
 * @param {object} o.strategy     Built strategy (for the index tables).
 * @param {object} [o.customMask] Per-table boolean grids of hands the user picked.
 * @param {object} [o.tallies]    Per-table error counts (for 'drillErrors').
 * @returns {{entries: object[], error: string|null}}
 */
export function buildHandList({ hands, situations, strategy, customMask, tallies }) {
  if (FIXED_LISTS[hands]) return { entries: FIXED_LISTS[hands], error: null };
  if (hands === 'roundRobin') return { entries: roundRobinEntries(situations), error: null };
  const keep = {
    withIndices: (table, row, column) => hasIndex(strategy.tables[table][row][column]),
    drillErrors: (table, row, column) => (tallies?.[table]?.[row][column] ?? 0) !== 0,
    custom: (table, row, column) => Boolean(customMask?.[table]?.[row][column]),
  }[hands];
  const entries = scanTables(situations, keep);
  return { entries, error: entries.length ? null : EMPTY_LIST_MESSAGES[hands] };
}

/** Picks the random extra ranks that fill a hand up to its total. */
function randomRank(maxCards, random) {
  if (maxCards !== 5) return randomInt(10, random);
  // With five cards J/Q/K are re-mapped onto 2/3/4, favouring small cards.
  const rank = randomInt(13, random);
  return rank > 10 ? rank - 9 : rank;
}

/**
 * Builds a hand of card values summing to `total`, starting with `first`.
 * Hands of 21, soft 21 and pairs of more than two cards are rejected.
 * @returns {number[]|null} card values (ace = 1), 2..maxCards of them
 */
export function fillHand(first, total, maxCards, random) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const cards = [first];
    let sum = first;
    let restart = false;
    for (let n = 2; n <= maxCards; n++) {
      const card = n === maxCards ? total - sum : randomRank(maxCards, random);
      cards.push(card);
      sum += card;
      if (sum === 21) {
        restart = true;
        break;
      }
      if (sum === 11 && cards.includes(1)) {
        restart = true;
        break;
      }
      if (sum > total || card < 1) {
        restart = true;
        break;
      }
      if (sum === total) break;
    }
    if (restart) continue;
    // A finished two-card pair is the Split table's hand; a longer one is not.
    if (maxCards !== 2 && cards.length === 2 && cards[0] === cards[1]) continue;
    if (sum === total && cards[cards.length - 1] <= 10) return cards;
  }
  return null;
}

/** Card values of one hand of the given kind, or null when none could be built. */
function handValues(e, { maxCards, doubleAnyCards }, random) {
  const swapAceToSecond = cards => (random() > 0.5 ? [cards[1], cards[0], ...cards.slice(2)] : cards);
  switch (e.kind) {
    case 'hardStand':
      return fillHand(2 + randomInt(9, random), e.value, maxCards, random);
    case 'hardDouble': {
      const cards = fillHand(2 + randomInt(9, random), e.value, doubleAnyCards ? maxCards : 2, random);
      return cards && cards.slice(0, 2).includes(1) ? null : cards;
    }
    case 'surrender': {
      const cards = fillHand(2 + randomInt(9, random), e.value, 2, random);
      return cards && cards.includes(1) ? null : cards;
    }
    case 'softDouble': {
      const cards = fillHand(1, e.value + 1, 2, random);
      return cards && swapAceToSecond(cards);
    }
    case 'softStand': {
      const cards = fillHand(1, e.value + 1, maxCards, random);
      return cards && swapAceToSecond(cards);
    }
    default:
      return [e.value, e.value];
  }
}

/** Card ids for a list of card values: a random suit each, tens becoming 10/J/Q/K. */
function dealCardIds(values, random) {
  const ids = [];
  for (const value of values) {
    const rank = value === 10 ? 10 + randomInt(4, random) : value;
    let id = cardId(rank, randomInt(4, random));
    // Two identical sprites look like a mistake: move to the next suit instead.
    for (let tries = 0; tries < 3 && ids.includes(id); tries++) id = id > 39 ? id - 39 : id + 13;
    ids.push(id);
  }
  return ids;
}

/**
 * Deals one hand for the drill.
 * @param {object[]} list    Hand list from buildHandList().
 * @param {object} options   {maxCards, doubleAnyCards, situations}
 * @param {() => number} random
 * @returns {object|null} the hand, or null when no hand could be dealt
 */
export function dealHand(list, options, random) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const picked = list[randomInt(list.length, random)];
    // A Round Robin entry may stand for several situations; deal one of those
    // that are selected, so its cards follow that situation's rules.
    const kinds = (picked.kinds ?? [picked.kind]).filter(kind => options.situations[kind]);
    if (kinds.length === 0) continue;
    const e = picked.kinds ? { ...picked, kind: kinds[randomInt(kinds.length, random)] } : picked;
    const values = handValues(e, options, random);
    if (!values) continue;
    // Two- and three-card hands are thrown away half the time, which biases the
    // drill towards the harder multi-card hands.
    if (values.length === 2 && random() > 0.5) continue;
    if (values.length === 3 && random() > 0.5) continue;
    const ids = dealCardIds([e.upcard, ...values], random);
    const { total, hardTotal } = handTotals(values);
    return {
      entry: e,
      kind: e.kind,
      upcard: e.upcard,
      upcardId: ids[0],
      cards: values,
      cardIds: ids.slice(1),
      total,
      hardTotal,
      soft: total !== hardTotal,
      cardCount: values.length,
    };
  }
  return null;
}

/** The hand as the advisor wants it. */
const advisorHand = hand => ({
  total: hand.total,
  hardTotal: hand.hardTotal,
  card1: hand.cards[0],
  card2: hand.cards[1],
  cardCount: hand.cardCount,
  cardIds: hand.cardIds,
});

const advisorContext = (hand, trueCount, allowed, probe) => ({
  upcard: hand.upcard,
  trueCount,
  runningCount: trueCount,
  decks: 1,
  cardsDealt: 0,
  allowed,
  probe,
});

/** Only the hand's own situation is allowed, so its own table decides. */
function ownSituation(kind) {
  return {
    double: kind === 'hardDouble',
    softDouble: kind === 'softDouble',
    split: kind === 'split',
    surrender: kind === 'surrender',
  };
}

const allowedFrom = situations => ({
  double: situations.hardDouble,
  softDouble: situations.softDouble,
  split: situations.split,
  surrender: situations.surrender,
});

/** The index the hand's own tables hold, before the grid range is applied. */
function rawIndex(strategy, hand, situations) {
  const probe = advisePlay(
    strategy,
    advisorHand(hand),
    advisorContext(hand, 99, ownSituation(hand.kind), PROBE.section),
  );
  let index = probe.threshold;
  if (index === ALWAYS || index === NO_INDEX_MARKER) {
    index = advisePlay(
      strategy,
      advisorHand(hand),
      advisorContext(hand, 99, { ...allowedFrom(situations), surrender: false }, PROBE.none),
    ).threshold;
  }
  if (index === NEVER || index === ALWAYS || index === NO_INDEX_MARKER || index === null) return null;
  return index;
}

/** An index far outside any count a player could hold is no use as an answer. */
const inRange = index => (index !== null && Math.abs(index) <= 150 ? index : null);

/**
 * The hand's own playing index: the count at which its basic play changes, or
 * null when it has none (so the index test must not ask about it).
 */
export const ownIndex = (strategy, hand, situations) => inRange(rawIndex(strategy, hand, situations));

/** `ownIndex`, falling back to the insurance index as the original app did. */
export function handIndex(strategy, hand, situations) {
  return inRange(rawIndex(strategy, hand, situations) ?? strategy.insurance / 10);
}

/** Where the "Random" count sits for a hand with no index: zero, or the pivot. */
export const countCentre = strategy => (strategy.unbalanced ? strategy.realPivot : 0);

/**
 * The count to show with a hand.
 * @param {object} o
 * @param {string} o.countMode  zero | fixed | random | indexTest
 * @param {number} o.fixedCount
 * @param {number|null} o.index The hand's own playing index.
 * @param {number} [o.centre]   Where to sit when the hand has no index.
 */
export function countForHand({ countMode, fixedCount, index, centre = 0 }, random) {
  if (countMode === 'fixed') return fixedCount;
  if (countMode !== 'random') return 0;
  // A count near the hand's own index, so the decision is actually in doubt.
  let offset = Math.round(random() * 3);
  if (random() > 0.8) offset = Math.round(random() * 4);
  if (random() > 0.5) offset = -offset;
  return (index ?? centre) + offset;
}

/**
 * The strategy-correct action for a hand at the shown count.
 * Only the situations the user enabled are allowed, so turning Splits off makes
 * Stand the right answer for 8,8.
 * @returns {{action: number, section: number, row: number, sectionRows: object}}
 */
export function correctPlay(strategy, hand, { count, situations, doubleAnyCards, splitAlwaysAllowed = false }) {
  const allowed = { ...allowedFrom(situations), split: situations.split || splitAlwaysAllowed };
  if (hand.cardCount === 2) {
    return advisePlay(strategy, advisorHand(hand), advisorContext(hand, count, allowed, PROBE.none));
  }
  // With more than two cards a soft hand is reduced to "ace plus the rest", and
  // splits and surrender are no longer possible.
  const multi = hand.soft ? { ...advisorHand(hand), card1: 1, card2: hand.total - 11 } : advisorHand(hand);
  const multiAllowed = {
    double: doubleAnyCards && situations.hardDouble,
    softDouble: doubleAnyCards && situations.softDouble,
    split: false,
    surrender: false,
  };
  return advisePlay(strategy, multi, advisorContext(hand, count, multiAllowed, PROBE.none));
}

/** Section (strategy table) an action belongs to, so an error can be filed. */
function sectionForAction(action, soft) {
  if (action === ACTION.surrender) return SECTION.surrender;
  if (action === ACTION.split) return SECTION.split;
  if (action === ACTION.double) return soft ? SECTION.softDouble : SECTION.hardDouble;
  return soft ? SECTION.softStand : SECTION.hardStand;
}

const SECTION_TABLES = {
  [SECTION.surrender]: 'surrender',
  [SECTION.split]: 'split',
  [SECTION.softDouble]: 'softDouble',
  [SECTION.hardDouble]: 'hardDouble',
  [SECTION.softStand]: 'softStand',
  [SECTION.hardStand]: 'hardStand',
};

/**
 * Where an error belongs in the strategy tables: it is filed under
 * the earlier of the two tables involved (the one the player's action would
 * have come from, or the one that decided), which is the more basic decision.
 * @returns {{table: string, row: number, column: number}|null}
 */
export function errorCell(play, action, hand) {
  let section = play.section;
  let row = play.row;
  if (action !== null) {
    const userSection = sectionForAction(action, hand.soft);
    const userRow = play.sectionRows[userSection];
    if (userSection < section && userRow !== undefined) {
      section = userSection;
      row = userRow;
    }
  }
  const table = SECTION_TABLES[section];
  if (!table || row < 0 || row > 9) return null;
  return { table, row, column: columnOf(hand.upcard) };
}

export const ACTION_LABELS = ['Hit', 'Stand', 'Double', 'Split', 'Surrender'];

const cardName = value => (value === 1 ? 'Ace' : valueName(value));

/** "Soft 18 (Ace, 7)" / "Hard 16 (Pair of 8s)" / "Hard 15" */
export function describeHand(hand) {
  const kind = hand.soft ? 'Soft' : 'Hard';
  if (hand.cardCount === 2 && hand.cards[0] === hand.cards[1]) {
    return `${kind} ${hand.total} (Pair of ${cardName(hand.cards[0])}s)`;
  }
  if (hand.cardCount === 2) return `${kind} ${hand.total} (${hand.cards.map(cardName).join(', ')})`;
  return `${kind} ${hand.total}`;
}

/** Cells that have recorded errors, as hand-list entries (for the options screen). */
export function errorCellsAsHands(cells) {
  return cells
    .filter(c => TABLE_NAMES.includes(c.table) && c.row < TABLE_ROWS[c.table].length)
    .map(c => ({ ...entry(c.table, upcardOf(c.column), TABLE_ROWS[c.table][c.row]), count: c.count }));
}

/**
 * Statistics for the Error History screen, from error-tally cells: each hand's
 * and each situation's share of all recorded errors, most-missed first.
 * @returns {{total: number, hands: {entry: object, count: number, share: number}[],
 *   situations: {kind: string, label: string, count: number, share: number}[]}}
 */
export function errorSummary(cells) {
  const entries = errorCellsAsHands(cells);
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  const share = count => (total ? count / total : 0);
  const hands = entries
    .map(e => ({ entry: e, count: e.count, share: share(e.count) }))
    .sort((a, b) => b.count - a.count);
  const situations = SITUATIONS.map(kind => {
    const count = entries.filter(e => e.kind === kind).reduce((sum, e) => sum + e.count, 0);
    return { kind, label: SITUATION_LABELS[kind], count, share: share(count) };
  })
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);
  return { total, hands, situations };
}

/** A share as a whole percentage: 0.4 -> "40%", tiny shares -> "<1%". */
export const percent = share => (share > 0 && share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`);

/** "Hard 16 v 10" for a hand-list entry. */
export function describeEntry(e) {
  const hand =
    e.kind === 'split'
      ? `Pair of ${valueName(e.value)}s`
      : e.kind === 'softStand' || e.kind === 'softDouble'
        ? `A,${e.value}`
        : String(e.value);
  return `${SITUATION_LABELS[e.kind]} ${hand} v ${valueName(e.upcard)}`;
}
