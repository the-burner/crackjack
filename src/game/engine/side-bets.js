// Evaluates the bonus and side-bet rules of a game definition against a hand.
//
// A definition (see settings/side-bet-games.js) holds 20 rules. Rules below
// `forcedSideBet` are bonuses on the main hand; from that index on they are
// side bets, paid on their own wager. A rule matches when every condition it
// sets is satisfied; the first match pays, unless the game accumulates.

import { rankOf, suitOf, valueOf, handTotals } from '../../core/cards.js';

/**
 * Card-pattern codes in `rule.mixMatch[2]`.
 *
 * The codes were derived from the published pay tables of the built-in games:
 * the order of the rules in each definition matches its documented tiers only
 * with this mapping.
 */
const PATTERN = {
  none: 0, pair: 1, trips: 2, straight: 3, flush: 4, straightFlush: 5,
  suitedPair: 6, suitedTrips: 7,
  /**
   * No pattern required, and the player's conditions are judged on the cards
   * the rule picks out rather than the whole hand. The original reached this by
   * falling through its pattern tests when `code - 1` was 7.
   */
  selection: 8,
};

/** Rank used in `exactCards` to mean "any ten-valued card". */
const ANY_TEN = 14;

const BLACK_SUITS = [0, 1];

/** The player cards a rule looks at. */
function playerCards(cards, code) {
  switch (code) {
    case 1: return cards.slice(0, 1);
    case 2: return cards.slice(1, 2);
    case 3: return cards.slice(0, 2);
    case 4: return cards.slice(0, 3);
    default: return [];
  }
}

/** The dealer cards a rule looks at. */
function dealerCards(cards, code) {
  switch (code) {
    case 1: return cards.slice(0, 1);
    case 2: return cards.slice(1, 2);
    case 3: return cards.slice(0, 2);
    case 4: return cards.slice(0, 3);
    default: return [];
  }
}

/** Ranks in ascending order, treating an ace as both low and high for straights. */
function straightMatches(cards) {
  if (cards.length < 3) return false;
  const ranks = cards.map(rankOf).sort((a, b) => a - b);
  const consecutive = list => list.every((r, i) => i === 0 || r === list[i - 1] + 1);
  if (consecutive(ranks)) return true;
  // An ace also runs high, so A-K-Q counts.
  if (ranks[0] === 1) {
    const high = [...ranks.slice(1), 14].sort((a, b) => a - b);
    return consecutive(high);
  }
  return false;
}

const allSameSuit = cards => cards.length > 0 && cards.every(c => suitOf(c) === suitOf(cards[0]));
const allSameRank = cards => cards.length > 0 && cards.every(c => rankOf(c) === rankOf(cards[0]));

/** Whether two of the cards make a pair, matching or avoiding equal suits. */
function hasPair(cards, { suited }) {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (rankOf(cards[i]) !== rankOf(cards[j])) continue;
      if (suited === (suitOf(cards[i]) === suitOf(cards[j]))) return true;
    }
  }
  return false;
}

/** Whether the selected cards show the rule's pattern. */
function patternMatches(pattern, cards) {
  switch (pattern) {
    case PATTERN.none: return true;
    case PATTERN.pair: return hasPair(cards, { suited: false });
    case PATTERN.suitedPair: return hasPair(cards, { suited: true });
    case PATTERN.trips: return cards.length >= 3 && allSameRank(cards) && !allSameSuit(cards);
    case PATTERN.suitedTrips: return cards.length >= 3 && allSameRank(cards) && allSameSuit(cards);
    case PATTERN.straight: return straightMatches(cards) && !allSameSuit(cards);
    case PATTERN.straightFlush: return straightMatches(cards) && allSameSuit(cards);
    case PATTERN.flush: return cards.length >= 3 && allSameSuit(cards) && !straightMatches(cards);
    default: return false;
  }
}

/** Card-count condition: 1..6 means exactly that many; 7 and up means "more than". */
function countMatches(code, count) {
  if (!code) return true;
  if (code <= 6) return count === code + 1;
  return count > code - 5;
}

/** Total condition: an exact total, or a lower or upper bound. */
function totalMatches(code, total) {
  if (!code) return true;
  if (code <= 29) return total === code + 1;
  if (code <= 53) return total > code - 28;
  return total < code - 51;
}

/** Suit condition, including colour and "identical cards" tests. */
function suitMatches(code, cards) {
  if (!code || cards.length === 0) return true;
  const suits = cards.map(suitOf);
  switch (code) {
    case 1: return allSameSuit(cards);
    case 6: return allSameSuit(cards) && allSameRank(cards);
    case 7: return suits.every(s => BLACK_SUITS.includes(s)) || suits.every(s => !BLACK_SUITS.includes(s));
    case 8: return !allSameSuit(cards);
    case 9: return suits.every(s => BLACK_SUITS.includes(s));
    case 10: return suits.every(s => !BLACK_SUITS.includes(s));
    default: return suits.every(s => s === code - 2);
  }
}

/** Whether the cards contain each required rank (0 means "no requirement"). */
function exactRanksMatch(required, cards) {
  const available = cards.map(rankOf);
  for (const wanted of required) {
    if (!wanted) continue;
    const index = available.findIndex(rank => (wanted === ANY_TEN ? rank >= 10 : rank === wanted));
    if (index === -1) return false;
    available.splice(index, 1);
  }
  return true;
}

/**
 * Whether one named card is the rank a rule wants. The original compared the
 * card id modulo 13 here rather than its rank, so a king (13) can never be
 * asked for by name; `ANY_TEN` means any ten-valued card.
 */
function namedCardMatches(wanted, card) {
  if (!wanted) return true;
  if (card === undefined) return false;
  if (wanted === ANY_TEN) return valueOf(card) === 10;
  return card % 13 === wanted;
}

/** Totals of a set of cards, with aces counted as 1 or 11 per the rule. */
function totalOf(cards, acesCountOne) {
  const values = cards.map(valueOf);
  if (acesCountOne) return values.reduce((a, b) => a + b, 0);
  return handTotals(values).total;
}

/**
 * Whether one rule's card conditions match.
 * @param {object} rule
 * @param {object} context {playerHandCards, dealerHandCards, won, doubled, split, firstTwoCardsOnly}
 */
export function ruleMatches(rule, context) {
  if (!rule?.enabled) return false;
  const { playerHandCards, dealerHandCards, won, doubled, split, firstTwoCardsOnly = false } = context;
  if (rule.winRequired && !won) return false;
  if (split && !rule.allowedAfterSplit) return false;
  if (doubled && !rule.allowedAfterDouble) return false;

  const [playerCode, dealerCode, pattern] = rule.mixMatch;
  const selectedPlayer = playerCards(playerHandCards, playerCode);
  const selectedDealer = dealerCards(dealerHandCards, dealerCode);
  // The pattern is judged on the selected cards together: the three-card games
  // select the player's two cards plus the dealer's up card.
  const selected = [...selectedPlayer, ...selectedDealer];
  if (pattern !== PATTERN.none && pattern !== PATTERN.selection) {
    if (selected.length === 0 || !patternMatches(pattern, selected)) return false;
  }

  const playerSet = playerConditionCards({ pattern, playerHandCards, selected, firstTwoCardsOnly });
  if (!countMatches(rule.playerCombo[0], playerSet.length)) return false;
  if (!totalMatches(rule.playerCombo[1], totalOf(playerSet, rule.acesCountOne))) return false;
  if (!suitMatches(rule.playerCombo[2], playerSet)) return false;

  if (!countMatches(rule.dealerCombo[0], dealerHandCards.length)) return false;
  if (!totalMatches(rule.dealerCombo[1], totalOf(dealerHandCards, rule.acesCountOne))) return false;
  if (!suitMatches(rule.dealerCombo[2], dealerHandCards)) return false;

  if (!exactRanksMatch(rule.exactCards.slice(0, 6), playerSet)) return false;
  if (!exactRanksMatch(rule.exactCards.slice(6, 12), dealerHandCards)) return false;
  const [upRank, holeRank, lastRank] = rule.exactCards.slice(12, 15);
  if (!namedCardMatches(upRank, dealerHandCards[0])) return false;
  if (!namedCardMatches(holeRank, dealerHandCards[1])) return false;
  if (!namedCardMatches(lastRank, dealerHandCards.at(-1))) return false;
  return true;
}

/**
 * The cards the player's count, total, suit and rank conditions are judged on.
 * Normally the whole hand; the cards the rule picked out where the pattern code
 * says so; the first two only where the game says so.
 */
function playerConditionCards({ pattern, playerHandCards, selected, firstTwoCardsOnly }) {
  if (pattern === PATTERN.selection) return selected;
  if (firstTwoCardsOnly) return playerHandCards.slice(0, 2);
  return playerHandCards;
}

/**
 * Whether a rule is allowed to run at the current count. Only side-bet rules
 * other than the one the player actually bet on are gated this way.
 */
export function allowedAtCount(rule, trueCount) {
  const threshold = rule.trueCountThreshold;
  if (threshold <= -99 || threshold >= 99) return true;
  return rule.aboveThreshold ? threshold > trueCount : threshold <= trueCount;
}

/**
 * Evaluates the side bet on one spot. Rules from the game's side-bet index on
 * are tried in order and the first match pays, unless the game accumulates.
 * @param {object} o
 * @param {import('../../settings/side-bet-games.js').SideBetGame} o.game
 * @param {number} o.ruleIndex   The spot's rule index, from sideBetSpots().
 * @param {number} o.stake
 * @param {object} o.context     As for ruleMatches, plus `trueCount`.
 * @returns {{payout: number, multiplier: number, name: string}|null} null when the side bet loses.
 */
export function evaluateSideBet({ game, ruleIndex, stake, context }) {
  if (stake <= 0) return null;
  const start = Math.max(0, game.forcedSideBet - 1);
  // A game with two separate side bets (Over/Under, Red/Black) pays only the
  // spot that was bet on; otherwise the whole pay table is in play.
  const twoSpots = sideBetSpots(game).length > 1;
  const judged = { ...context, firstTwoCardsOnly: Boolean(game.firstTwoCardsOnly) };
  let payout = 0;
  let matched = false;
  for (let i = start; i < game.rules.length; i++) {
    const rule = game.rules[i];
    if (twoSpots && i !== ruleIndex) continue;
    if (i !== ruleIndex && !allowedAtCount(rule, context.trueCount ?? 0)) continue;
    if (!ruleMatches(rule, judged)) continue;
    matched = true;
    payout += (rule.payTenths / 10) * stake + rule.payFixed;
    if (!game.nonAdditive) break;
  }
  if (!matched) return null;
  // A rule that matches but pays nothing returns the stake.
  const total = payout === 0 ? stake : payout + stake;
  return { payout: total, multiplier: payout / stake, name: game.name };
}

/**
 * Bonus paid on the main hand's own bet (the Spanish 21 rules).
 * @param {object} o
 * @param {object} o.game
 * @param {number} o.bet
 * @param {object} o.context  As for ruleMatches, plus `playerTotal`, `dealerTotal` and `dealerBlackjack`.
 * @returns {{payout: number, multiplier: number}|null}
 */
export function evaluateHandBonus({ game, bet, context }) {
  const sideBetStart = Math.max(0, game.forcedSideBet - 1);
  /** Payouts are in tenths of the bet. */
  let tenths = 0;
  let fixedTenths = 0;
  let matched = false;
  const judged = { ...context, firstTwoCardsOnly: Boolean(game.firstTwoCardsOnly) };
  for (const rule of game.rules.slice(0, sideBetStart)) {
    if (!ruleMatches(rule, judged)) continue;
    matched = true;
    tenths += rule.twentyOneAlwaysWins ? twentyOneAlwaysWinsTenths(context) : rule.payTenths;
    fixedTenths = rule.payFixed;
    if (!game.nonAdditive) break;
  }
  if (!matched || tenths + fixedTenths <= 0) return null;
  const multiplier = tenths / 10;
  return { payout: bet * multiplier + fixedTenths / 10, multiplier };
}

/**
 * "A player 21 always wins": pays even money (double after doubling) when the
 * hand would not otherwise have won, and nothing when it already won.
 */
function twentyOneAlwaysWinsTenths({ won, doubled, dealerTotal = 0, playerTotal = 0, dealerBlackjack = false }) {
  if (!won || dealerBlackjack) return doubled ? 20 : 10;
  if (dealerTotal > 21 || playerTotal > dealerTotal) return 0;
  return doubled ? 20 : 10;
}

/**
 * The side-bet spots a game offers: the enabled side-bet rules, each with the
 * label shown on the table.
 * @returns {{ruleIndex: number, id: string, maxMultipleOfBet: number, maxAmount: number}[]}
 */
export function sideBetSpots(game) {
  if (!game) return [];
  const start = Math.max(0, game.forcedSideBet - 1);
  const spots = [];
  for (let i = start; i < game.rules.length; i++) {
    const rule = game.rules[i];
    if (!rule.enabled) continue;
    spots.push({
      ruleIndex: i,
      id: rule.sideBetId || game.name,
      maxMultipleOfBet: rule.sideBetMinLimit || 100,
      maxAmount: rule.sideBetDealerLimit || 999999,
    });
    // Merged games play both spots as one.
    if (game.merge || spots.length === 2) break;
  }
  return spots;
}
