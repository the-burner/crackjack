// Rule interactions for the settings screens.
//
// Rules that imply or exclude other rules, the rule bundles that come with each
// game variant, and the seat check run before the table opens. Everything here
// is pure: callers pass a `get(key)` reader and receive a patch of settings to
// apply.
//
// Enum settings (hard/soft doubles, insurance, surrender, split limit, blackjack
// payout, 777 bonus, peek mode) already encode their mutual exclusions as a
// single value, so only the cross-setting rules are listed below.

import { SETTINGS_SCHEMA } from './schema.js';

/** Holds what the rules a variant forces were set to before it was chosen. */
const SAVED_RULES = 'bonuses.savedRules';

/** Side-bet game ids that change the rules of the game itself. */
const BLACKJACK_SWITCH = 2001;
const DOUBLE_EXPOSURE = 2002;
const SPANISH_21 = [16, 17];

/** Rules each variant forces on while it is selected. */
const VARIANT_RULES = {
  standard: {},
  blackjackSwitch: {
    'rules.dealerHitsSoft17': true,
    'rules.dealerPeeksTen': true,
    'rules.dealerPeeksAce': true,
    'rules.doubleAfterSplit': true,
    'rules.dealerBlackjackWinsAll': true,
    'rules.blackjackPayout': '1:1',
  },
  doubleExposure: {
    'rules.dealerWinsTies': true,
    'rules.blackjackPayout': '1:1',
    'rules.insurance': 'none',
    'peeking.mode': 'off',
  },
  spanish21: {
    'rules.dealerHitsSoft17': true,
    'rules.hardDoubles': '8-11',
    'rules.softDoubles': 'any',
    'rules.surrender': 'late',
    'rules.doubleDownRescue': true,
    'rules.doubleAfterSplit': true,
    'rules.maxSplitHands': 4,
    'rules.resplitAces': true,
    'rules.hitSplitAces': true,
    'rules.doubleAnyNumberOfCards': true,
    'rules.doubleOnThreeCards': true,
    'rules.playerBlackjackAlwaysWins': true,
  },
};

/**
 * The rule variant a side-bet game selection implies.
 * @param {number} gameId  Value of `bonuses.game`.
 * @returns {'standard'|'blackjackSwitch'|'doubleExposure'|'spanish21'}
 */
export function gameVariant(gameId) {
  if (gameId === BLACKJACK_SWITCH) return 'blackjackSwitch';
  if (gameId === DOUBLE_EXPOSURE) return 'doubleExposure';
  if (SPANISH_21.includes(gameId)) return 'spanish21';
  return 'standard';
}

/** Implications of a single setting, expressed as (read, set) side effects. */
function implicationsOf(key, read, set) {
  switch (key) {
    case 'rules.redouble':
      // Redoubling needs a third card and shows it.
      if (read(key)) { set('rules.doubleOnThreeCards', true); set('table.doubleDownCardFaceUp', true); }
      break;
    case 'rules.doubleOnThreeCards':
      if (!read(key)) { set('rules.redouble', false); set('rules.doubleAnyNumberOfCards', false); }
      break;
    case 'rules.doubleAnyNumberOfCards':
      if (read(key)) set('rules.doubleOnThreeCards', true);
      break;
    case 'rules.hitAfterDouble':
      if (read(key)) set('table.doubleDownCardFaceUp', true);
      break;
    case 'rules.dealerPeeksTen':
      if (read(key)) {
        set('rules.dealerPeeksAce', true);
        set('rules.noHoleCard', false);
        if (read('rules.surrender') === 'earlyVsTen') set('rules.surrender', 'none');
      }
      break;
    case 'rules.dealerPeeksAce':
      if (read(key)) set('rules.noHoleCard', false);
      else set('rules.dealerPeeksTen', false);
      break;
    case 'rules.noHoleCard':
      if (read(key)) { set('rules.dealerPeeksTen', false); set('rules.dealerPeeksAce', false); }
      break;
    case 'rules.surrender':
      // Early surrender against a ten only makes sense before the dealer peeks.
      if (read(key) === 'earlyVsTen') set('rules.dealerPeeksTen', false);
      break;
    case 'rules.resplitAces':
      if (read(key) && read('rules.maxSplitHands') === 2) set('rules.maxSplitHands', 4);
      break;
    case 'rules.maxSplitHands':
      if (read(key) === 2) set('rules.resplitAces', false);
      break;
    case 'rules.doubleAfterSplitAces':
      if (read(key)) set('rules.doubleAfterSplit', true);
      break;
    case 'rules.doubleAfterSplit':
      if (!read(key)) set('rules.doubleAfterSplitAces', false);
      break;
    default:
      break;
  }
}

/** Rules the selected variant enforces on every edit, not just when it is chosen. */
function enforceVariant(read, set) {
  if (gameVariant(read('bonuses.game')) !== 'doubleExposure') return;
  // With both dealer cards face up there is nothing to insure or to peek at.
  set('rules.insurance', 'none');
  if (read('peeking.mode') === 'holeCard') set('peeking.mode', 'off');
}

/** Resolves `changes` until no further implication fires. */
function close(get, changes) {
  const read = key => (key in changes ? changes[key] : get(key));
  const queue = Object.keys(changes);
  const set = (key, value) => {
    if (read(key) === value) return;
    changes[key] = value;
    queue.push(key);
  };
  // Each setting can only be forced a bounded number of times; the cap just
  // guarantees termination if a future rule is added that oscillates.
  for (let steps = 0; queue.length && steps < 200; steps += 1) implicationsOf(queue.shift(), read, set);
  enforceVariant(read, set);
  return changes;
}

/**
 * Applies one settings change together with every rule it implies.
 * @param {(key: string) => *} get  Reads the current value of a setting.
 * @param {string} key
 * @param {*} value
 * @returns {Record<string, *>} settings to write, including `key` itself
 */
export function applyRuleChange(get, key, value) {
  return close(get, { [key]: value });
}

/**
 * Applies one end of the index range. A bound that crosses the other one is
 * clamped to it, so the range is never inverted.
 * @param {(key: string) => *} get
 * @param {'strategy.indexRangeMin'|'strategy.indexRangeMax'} key
 * @param {number} value
 * @returns {Record<string, number>}
 */
export function applyIndexRangeChange(get, key, value) {
  const lowEnd = key === 'strategy.indexRangeMin';
  const other = get(lowEnd ? 'strategy.indexRangeMax' : 'strategy.indexRangeMin');
  return { [key]: lowEnd ? Math.min(value, other) : Math.max(value, other) };
}

/**
 * Selects a side-bet / unusual game and applies its rule bundle. Rules the
 * previous variant forced, and the new one does not, go back to the values the
 * player had before it was chosen; unrelated options are left alone.
 * @param {(key: string) => *} get
 * @param {number} gameId
 * @returns {Record<string, *>}
 */
export function applyGameChange(get, gameId) {
  const changes = { 'bonuses.game': gameId };
  const previous = gameVariant(get('bonuses.game'));
  const next = gameVariant(gameId);
  if (previous !== next) {
    const saved = get(SAVED_RULES) ?? {};
    // What a rule holds once the previous variant stops forcing it.
    const restored = key => {
      if (!(key in VARIANT_RULES[previous])) return get(key);
      return key in saved ? saved[key] : structuredClone(SETTINGS_SCHEMA[key].default);
    };
    for (const key of Object.keys(VARIANT_RULES[previous])) {
      if (!(key in VARIANT_RULES[next])) changes[key] = restored(key);
    }
    const remembered = Object.keys(VARIANT_RULES[next]);
    if (remembered.length) changes[SAVED_RULES] = Object.fromEntries(remembered.map(key => [key, restored(key)]));
    Object.assign(changes, VARIANT_RULES[next]);
  }
  return close(get, changes);
}

/**
 * Seat check run before the table opens: at least one seat in play must be
 * free for the player. The table fits up to four seats in portrait by itself,
 * so the saved seat count is left alone.
 * @param {(key: string) => *} get
 * @returns {{changes: Record<string, *>}}
 */
export function prepareLaunch(get) {
  const changes = {};
  const seatCount = get('table.seatCount');
  const computerSeats = get('table.computerSeats');
  if (computerSeats.slice(0, seatCount).every(Boolean)) {
    changes['table.computerSeats'] = computerSeats.map((computer, seat) => (seat === 0 ? false : computer));
  }
  return { changes };
}
