// Playing advisor: decides the strategy-correct action for a hand, given the
// tables built by buildStrategy() and the current count.

import { NEVER, ALWAYS, NO_ENTRY, BELOW_OFFSET, isBelowIndex } from './strategy-file.ts';
import { CODE, INSURANCE, SPLIT_PLUS3_PER_DECK } from './strategy-tables.ts';
import type { Strategy } from './strategy-tables.ts';
import type { CardId } from '../cards.ts';

export const ACTION = { hit: 0, stand: 1, double: 2, split: 3, surrender: 4 } as const;
export type Action = (typeof ACTION)[keyof typeof ACTION];
export const ACTION_NAMES = ['hit', 'stand', 'double', 'split', 'surrender'] as const;

/** Which part of the strategy produced the decision (the table that was consulted last). */
export const SECTION = {
  none: 0,
  surrender: 1,
  split: 2,
  softDouble: 3,
  hardDouble: 4,
  softStand: 5,
  hardStand: 6,
} as const;
export type Section = (typeof SECTION)[keyof typeof SECTION];

/** Marker threshold returned by a probe when a surrender cell holds no index. */
export const NO_INDEX_MARKER = 1234;

/** Probe modes: stop after the first section that applies to the hand (used by the flash drills). */
export const PROBE = { none: 0, markBasic: 2, section: 3 } as const;
export type Probe = (typeof PROBE)[keyof typeof PROBE];

/** Double/stand cells from 800 to 999 hold index + 900 and mean "double or less". */
const DOUBLE_OR_LESS_OFFSET = 900;

export interface PlayHand {
  /** Best total (an ace counts 11 when it doesn't bust). */
  total: number;
  /** Total with every ace counted as 1. */
  hardTotal: number;
  /** Value 1..10 of the first card (ace = 1). */
  card1: number;
  /** Value 1..10 of the second card. */
  card2: number;
  /** Cards in the hand. */
  cardCount: number;
  /** Card ids (1..52) of the first two cards, for suit-dependent codes. */
  cardIds?: readonly CardId[];
}

export interface PlayContext {
  /** Dealer upcard value 1..10 (ace = 1). */
  upcard: number;
  /** Dealer's best total (extended strategies only). */
  dealerTotal?: number;
  /** Dealer total counting aces as 1 (extended strategies only). */
  dealerHardTotal?: number;
  /** Count used for index decisions. */
  trueCount: number;
  /** Used instead of the true count for zero indices when `zeroIndexUsesRunningCount`. */
  runningCount: number;
  zeroIndexUsesRunningCount?: boolean;
  decks: number;
  cardsDealt: number;
  /** Default 52. */
  cardsPerDeck?: number;
  allowed: { double?: boolean; softDouble?: boolean; split?: boolean; surrender?: boolean };
  /** Default PROBE.none. */
  probe?: Probe;
}

/** The advised action and how it was reached. */
export interface PlayAdvice {
  action: Action;
  section: Section;
  /** Row of the table consulted last, or -1. */
  row: number;
  /** The index (or code) consulted last; null when no table cell was read. */
  threshold: number | null;
  doubleOrLess: boolean;
  standWith3OrMore: boolean;
  /** Row consulted in each section entered. */
  sectionRows: Partial<Record<Section, number>>;
}

/** Returns the advised action and how it was reached. */
export function advisePlay(
  strategy: Pick<Strategy, 'tables' | 'extended' | 'earlySurrender'>,
  hand: PlayHand,
  ctx: PlayContext,
): PlayAdvice {
  const t = strategy.tables;
  const { decks, cardsDealt, cardsPerDeck = 52, allowed, probe = PROBE.none } = ctx;
  const hc = hand.total;
  const sc = hand.hardTotal;
  const ncards = hand.cardCount;
  // No ids means the suits are unknown, not that both cards are spades.
  const [id1, id2]: readonly (CardId | undefined)[] = hand.cardIds ?? [];
  const card1 = Math.min(hand.card1, hand.card2);
  const card2 = Math.max(hand.card1, hand.card2);
  const isSoft = hc !== sc;

  const decksLeft = Math.floor((decks * cardsPerDeck - cardsDealt - 4) / cardsPerDeck);
  const plus3PerDeck = 21 + 3 * decksLeft + 3;
  const minus7PerDeck = 21 - 7 * decksLeft - 7;

  let column = ctx.upcard === 1 ? 9 : ctx.upcard - 2;
  if (strategy.extended) {
    // Missing totals give a NaN column, as arithmetic on undefined did.
    const { dealerTotal = NaN, dealerHardTotal = NaN } = ctx;
    column = dealerTotal !== dealerHardTotal && dealerHardTotal < 8 ? dealerHardTotal + 15 : dealerTotal - 4;
  }

  const result: PlayAdvice = {
    action: ACTION.hit,
    section: SECTION.none,
    row: -1,
    threshold: null,
    doubleOrLess: false,
    standWith3OrMore: false,
    sectionRows: {},
  };
  let section: Section = SECTION.none;
  /** The index (or code) consulted last; null until a table cell is read. */
  let threshold: number | null = null;
  let count = ctx.trueCount;
  const setRow = (row: number) => {
    result.row = row;
    result.sectionRows[section] = row;
  };
  const enter = (s: Section) => {
    section = s;
    result.section = s;
  };
  /** Loads a cell: chooses the count to compare against and resolves per-deck codes. Returns the new threshold. */
  const load = (cell: number): number => {
    count = ctx.zeroIndexUsesRunningCount && cell === 0 ? ctx.runningCount : ctx.trueCount;
    if (cell === CODE.plus3PerDeck) return plus3PerDeck;
    if (cell === CODE.minus7PerDeck) return minus7PerDeck;
    return cell;
  };
  const done = (action: Action) => {
    result.action = action;
    result.threshold = threshold;
    return result;
  };
  const stop = () => {
    result.threshold = threshold;
    return result;
  };

  if (hc === 21 && !strategy.extended) return done(ACTION.stand);

  // Surrender.
  if (allowed.surrender) {
    surrender: {
      enter(SECTION.surrender);
      setRow(-1);
      let merged = false;
      if (strategy.earlySurrender) {
        if (isSoft) break surrender;
        threshold = load(t.surrender[6][column]);
        if (card1 === 8 && card2 === 8 && threshold !== NO_ENTRY) {
          setRow(7);
          if (count >= threshold) return done(ACTION.surrender);
          break surrender;
        }
        if (hc > 4 && hc < 8) {
          threshold = t.surrender[hc + 2][column];
          merged = true;
        }
      } else {
        threshold = load(t.surrender[9][column]);
        if (card1 === 1 && card2 === 7) {
          setRow(9);
          if (count >= threshold) return done(ACTION.surrender);
          break surrender;
        }
        if (isSoft) break surrender;
        threshold = load(t.surrender[6][column]);
        if (card1 === 9 && card2 === 9 && t.surrender[6][column] !== NO_ENTRY) {
          setRow(6);
          if (count >= threshold) return done(ACTION.surrender);
          break surrender;
        }
        threshold = load(t.surrender[7][column]);
        if (card1 === 8 && card2 === 8 && threshold !== NO_ENTRY) {
          setRow(7);
          if (count >= threshold) return done(ACTION.surrender);
          break surrender;
        }
        threshold = load(t.surrender[8][column]);
        if (card1 === 7 && card2 === 7 && threshold !== NO_ENTRY) {
          setRow(8);
          if (count >= threshold) return done(ACTION.surrender);
          break surrender;
        }
      }
      if (!merged) {
        setRow(-1);
        if (hc > 17 || hc < 12) break surrender;
        setRow(17 - hc);
        threshold = t.surrender[17 - hc][column];
      }
      threshold = load(threshold);
      switch (threshold) {
        case CODE.surrender10v6Only:
          if (card1 === 6 && card2 === 10) return done(ACTION.surrender);
          break surrender;
        case CODE.surrenderExcept87:
          if (card1 !== 7 || card2 !== 8) return done(ACTION.surrender);
          break surrender;
        case CODE.surrenderUnless3Cards:
          return done(ncards > 2 ? ACTION.hit : ACTION.surrender);
        case CODE.surrender3Or4Cards: {
          let a: Action = ncards === 5 ? ACTION.hit : ACTION.surrender;
          if (ncards > 2 && ncards < 5) a = ACTION.stand;
          return done(a);
        }
        case CODE.surrenderUnless4Cards:
          return done(ncards > 3 ? ACTION.hit : ACTION.surrender);
        case CODE.surrenderFirstTwoOnly:
          return done(ncards !== 2 ? ACTION.hit : ACTION.surrender);
        default:
      }
      if (isBelowIndex(threshold) ? count < threshold + BELOW_OFFSET : count >= threshold)
        return done(ACTION.surrender);
      if (probe === PROBE.markBasic && (threshold === NEVER || threshold === ALWAYS)) {
        threshold = NO_INDEX_MARKER;
        return stop();
      }
      if (probe !== PROBE.none) return stop();
    }
  }

  // Splits.
  if (allowed.split && card1 === card2) {
    const row = card1 === 1 ? 0 : 11 - card1;
    enter(SECTION.split);
    result.row = row;
    threshold = load(t.split[row][column]);
    if (threshold === CODE.splitUnlessSuitedSevens && card1 === 7) {
      return done(id1 === id2 ? ACTION.hit : ACTION.split);
    }
    result.sectionRows[section] = row;
    if (threshold === SPLIT_PLUS3_PER_DECK) threshold = BELOW_OFFSET + plus3PerDeck;
    if (isBelowIndex(threshold) ? count < threshold + BELOW_OFFSET : count >= threshold) return done(ACTION.split);
    if (probe !== PROBE.none) return stop();
  }

  // Soft doubles.
  if (allowed.softDouble && card1 === 1 && card2 > 1 && isSoft) {
    enter(SECTION.softDouble);
    const row = strategy.extended ? 10 - card2 : 9 - card2;
    setRow(row);
    threshold = load(t.softDouble[row][column]);
    if (threshold > 799 && threshold < 1000) {
      threshold -= DOUBLE_OR_LESS_OFFSET;
      result.doubleOrLess = true;
    }
    const byCards = doubleUnlessCards(threshold, ncards);
    if (byCards !== null) return done(byCards);
    if (count >= threshold) return done(ACTION.double);
    if (probe !== PROBE.none) return stop();
  }

  // Hard doubles.
  if (allowed.double && card1 > 1 && hc < 12 && hc > 4) {
    enter(SECTION.hardDouble);
    setRow(11 - hc);
    threshold = load(t.hardDouble[11 - hc][column]);
    if (threshold > 799 && threshold < 1000) {
      threshold -= DOUBLE_OR_LESS_OFFSET;
      result.doubleOrLess = true;
    }
    hardDouble: {
      if (threshold === CODE.doubleUnless62) {
        if (count >= 6) return done(ACTION.double);
        if (count < -5) break hardDouble;
        return done(card1 === 2 && card2 === 6 ? ACTION.hit : ACTION.double);
      }
      if (threshold === CODE.noDouble29Or38) {
        threshold = (card1 === 2 && card2 === 9) || (card1 === 3 && card2 === 8) ? ALWAYS : NEVER;
      }
      const byCards = doubleUnlessCards(threshold, ncards);
      if (byCards !== null) return done(byCards);
      if (count >= threshold) return done(ACTION.double);
      if (probe !== PROBE.none) return stop();
    }
  }

  // Soft hit/stand.
  if (card1 === 1 && isSoft) {
    enter(SECTION.softStand);
    setRow(-1);
    if (card1 === 1 && card2 === 1) return done(ACTION.hit);
    const row = strategy.extended ? 10 - card2 : 9 - card2;
    setRow(row);
    threshold = load(t.softStand[row][column]);
    if (threshold > 800 && threshold < 1000) {
      threshold -= DOUBLE_OR_LESS_OFFSET;
      result.doubleOrLess = true;
    }
    if (threshold === CODE.hitBelow2ShoeElse0) threshold = decks > 2 ? 2 : 0;
    const byCards = standUnlessCards(threshold, ncards);
    if (byCards !== null) return done(byCards);
    return done(count < threshold ? ACTION.hit : ACTION.stand);
  }

  // Hard hit/stand.
  enter(SECTION.hardStand);
  setRow(-1);
  if (hc > 17 && !strategy.extended) return done(ACTION.stand);
  if (hc < 11) return done(ACTION.hit);
  if (strategy.extended) {
    if (hc < 12) return done(ACTION.hit);
    setRow(21 - hc);
    threshold = load(t.hardStand[21 - hc][column]);
  } else {
    setRow(17 - hc);
    threshold = load(t.hardStand[17 - hc][column]);
  }
  switch (threshold) {
    case CODE.sevenSevenHitBelow0Else13:
      threshold = card1 === 7 ? 0 : 13;
      break;
    case CODE.hitUnless77AtMinus6:
      if (card1 !== 7) return done(ACTION.hit);
      threshold = -6;
      break;
    case CODE.hitUnless77AtMinus1:
      if (card1 !== 7) return done(ACTION.hit);
      threshold = -1;
      break;
    case CODE.sevenSevenHitBelow1Else15:
      threshold = card1 === 7 ? 1 : 15;
      break;
    case CODE.sevenSevenByDecksElseHit:
      // 32222 (like 30000 below) is above any count: always hit.
      threshold = card1 === 7 ? (decks === 1 ? 0 : 4) : 32222;
      break;
    case CODE.hit102:
      threshold = card1 === 2 && card2 === 10 ? 30000 : NEVER;
      break;
    case CODE.sevenSevenByDecks:
      threshold = 15;
      if (card1 === 7 && decks === 2) threshold = 6;
      if (card1 === 7 && decks > 2) threshold = 11;
      break;
    case CODE.standWith3OrMoreCards:
      if (ncards === 2) return done(ACTION.hit);
      result.standWith3OrMore = true;
      return done(ACTION.stand);
    default:
  }
  const byCards =
    standUnlessCards(threshold, ncards) ?? standUnlessCardsOr678(threshold, ncards, card1, card2, id1, id2);
  if (byCards !== null) return done(byCards);
  return done(count < threshold ? ACTION.hit : ACTION.stand);
}

/** Codes "double, except hit with N or more cards". */
function doubleUnlessCards(code: number, ncards: number): Action | null {
  const limits: Partial<Record<number, number>> = {
    [CODE.doubleUnless3Cards]: 2,
    [CODE.doubleUnless4Cards]: 3,
    [CODE.doubleUnless5Cards]: 4,
    [CODE.doubleUnless6Cards]: 5,
  };
  const limit = limits[code];
  if (limit === undefined) return null;
  return ncards > limit ? ACTION.hit : ACTION.double;
}

/** Codes "stand, except hit with N or more cards". */
function standUnlessCards(code: number, ncards: number): Action | null {
  const limits: Partial<Record<number, number>> = {
    [CODE.standUnless3Cards]: 2,
    [CODE.standUnless4Cards]: 3,
    [CODE.standUnless5Cards]: 4,
    [CODE.standUnless6Cards]: 5,
  };
  const limit = limits[code];
  if (limit === undefined) return null;
  return ncards > limit ? ACTION.hit : ACTION.stand;
}

/** Codes that also hit two-card hands that could become a 6-7-8 bonus. */
function standUnlessCardsOr678(
  code: number,
  ncards: number,
  card1: number,
  card2: number,
  id1: CardId | undefined,
  id2: CardId | undefined,
): Action | null {
  const limits: Partial<Record<number, number>> = {
    [CODE.standUnless4CardsOr678]: 3,
    [CODE.standUnless5CardsOr678]: 4,
    [CODE.standUnless5CardsOrSuited678]: 4,
    [CODE.standUnless5CardsOrSpaded678]: 4,
    [CODE.standUnless6CardsOrSpaded678]: 5,
  };
  const limit = limits[code];
  if (limit === undefined) return null;
  let action: Action = ncards > limit ? ACTION.hit : ACTION.stand;
  const partOf678 = (card1 === 6 && card2 === 7) || (card1 === 6 && card2 === 8) || (card1 === 7 && card2 === 8);
  if (ncards === 2 && partOf678) {
    if (code === CODE.standUnless4CardsOr678 || code === CODE.standUnless5CardsOr678) action = ACTION.hit;
    // Deliberately compares ranks (id % 13), not suits.
    // Unknown ids never match (undefined % 13 is NaN).
    const sameRank = id1 !== undefined && id2 !== undefined && id1 % 13 === id2 % 13;
    if (code === CODE.standUnless5CardsOrSuited678 && sameRank) action = ACTION.hit;
    const spaded = id1 !== undefined && id2 !== undefined && id1 <= 13 && id2 <= 13;
    if ((code === CODE.standUnless5CardsOrSpaded678 || code === CODE.standUnless6CardsOrSpaded678) && spaded)
      action = ACTION.hit;
  }
  return action;
}

export interface InsuranceContext {
  /** Unrounded true count. */
  trueCount: number;
  /** Rounded count used for insurance decisions. */
  insuranceCount: number;
  /** Player's total with aces as 1 (for per-total insurance tables). */
  hardTotal: number;
  /** When the ten side count is used. */
  tenSideCount?: { tens: number; decks: number } | null;
}

/** Insurance decision. Returns true when insurance should be taken. */
export function adviseInsurance(
  strategy: Pick<Strategy, 'insurance' | 'insuranceByTotal' | 'insuranceByDecks'>,
  ctx: InsuranceContext,
): boolean {
  if (ctx.tenSideCount) return ctx.tenSideCount.tens > 4 * ctx.tenSideCount.decks;
  if (strategy.insurance === INSURANCE.byTotalTable) {
    const index = strategy.insuranceByTotal[ctx.hardTotal >= 12 ? ctx.hardTotal - 12 : 0];
    const fractional = strategy.insuranceByTotal.slice(1, 10).some(v => v % 10 !== 0);
    return (fractional ? ctx.trueCount : ctx.insuranceCount) * 10 >= index;
  }
  const fractional = strategy.insuranceByDecks.slice(1, 9).some(v => v % 10 !== 0);
  return (fractional ? ctx.trueCount : ctx.insuranceCount) * 10 >= strategy.insurance;
}
