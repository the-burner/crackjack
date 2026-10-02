// Rule interactions for the settings screens.
//
// Ports the legacy `DoOpt` implication / mutual-exclusion rules, the game-variant
// bundles applied by `Select230__onchange`, and the pre-launch seat checks from
// `Button1__onclick`. Everything here is pure: callers pass a `get(key)` reader
// and receive a patch of settings to apply.
//
// Enum settings (hard/soft doubles, insurance, surrender, split limit, blackjack
// payout, 777 bonus, peek mode) already encode the mutual exclusions the legacy
// code implemented with groups of booleans, so only the cross-setting rules are
// listed below.

import { SETTINGS_SCHEMA } from './schema.js';

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
 * Selects a side-bet / unusual game and applies its rule bundle. Rules the
 * previous variant forced, and the new one does not, go back to their defaults;
 * unrelated options are left alone (the legacy screen cleared a dozen of them).
 * @param {(key: string) => *} get
 * @param {number} gameId
 * @returns {Record<string, *>}
 */
export function applyGameChange(get, gameId) {
  const changes = { 'bonuses.game': gameId };
  const previous = gameVariant(get('bonuses.game'));
  const next = gameVariant(gameId);
  if (previous !== next) {
    for (const key of Object.keys(VARIANT_RULES[previous])) {
      if (!(key in VARIANT_RULES[next])) changes[key] = structuredClone(SETTINGS_SCHEMA[key].default);
    }
    Object.assign(changes, VARIANT_RULES[next]);
  }
  return close(get, changes);
}

/**
 * Seat checks run before the table opens (legacy `Button1__onclick`).
 * Portrait fits at most two seats, and at least one seat in play must be free
 * for the user.
 * @param {(key: string) => *} get
 * @param {{portrait: boolean}} viewport
 * @returns {{changes: Record<string, *>, message: string|null}}
 */
export function prepareLaunch(get, { portrait }) {
  const changes = {};
  let message = null;
  let seatCount = get('table.seatCount');
  if (portrait && seatCount > 2) {
    seatCount = 2;
    changes['table.seatCount'] = seatCount;
    message = 'Too many seats specified for Portrait mode. Changed to two seats.';
  }
  const computerSeats = get('table.computerSeats');
  if (computerSeats.slice(0, seatCount).every(Boolean)) {
    changes['table.computerSeats'] = computerSeats.map((computer, seat) => (seat === 0 ? false : computer));
  }
  return { changes, message };
}
