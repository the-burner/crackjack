// Every user setting, with its type and default. Shared groups (rules,
// strategy, trueCount, display) are used by both the game and the drills;
// drills.* groups belong to one drill each.

import { BUILTIN_STRATEGIES, HOLE_CARD_STRATEGY } from './strategies';
import { BUILTIN_SIDE_BET_GAMES } from '@/data/side-bet-games';
import { isRamp } from './bet-ramp';
import { STANDARD, isGestureMap } from '@/core/gestures';
import type { Ramp } from './bet-ramp';
import type { BoolDef, EnumDef, JsonDef, NumberDef, SettingDef, Settings, SettingsValues } from './store';

const bool = (value: boolean): BoolDef => ({ type: 'bool', default: value });
const int = (value: number, min?: number, max?: number): NumberDef => ({ type: 'int', default: value, min, max });
const oneOf = <const T extends string | number>(values: readonly T[], value: NoInfer<T>): EnumDef<T> => ({
  type: 'enum',
  values,
  default: value,
});
const json = <T>(value: T, shape?: (value: unknown) => value is T): JsonDef<T> => ({
  type: 'json',
  default: value,
  shape,
});

const grid = <T>(rows: number, cols: number, value: T): T[][] =>
  Array.from({ length: rows }, () => new Array<T>(cols).fill(value));
const tableGrids = <T>(value: T) => ({
  split: grid(10, 10, value),
  hardStand: grid(10, 10, value),
  softDouble: grid(10, 10, value),
  hardDouble: grid(10, 10, value),
  softStand: grid(10, 10, value),
  surrender: grid(10, 10, value),
});

export const DECKS = [1, 2, 3, 4, 5, 6, 7, 8];
export const ACCURACY = [0, 1, 2];
export const TRAY_STYLES = ['eightDeckFront', 'sixDeckFront', 'doubleDeckFront', 'sixDeckRear', 'doubleDeckRear'];
export const TABLE_LIMITS = [
  [1, 50],
  [5, 250],
  [5, 1000],
  [10, 2000],
  [25, 2500],
  [100, 5000],
  [500, 25000],
  [1, 100000],
];

/** Every strategy a setting may name: the built-in ones and the hole-carding one. */
const STRATEGY_IDS = [HOLE_CARD_STRATEGY.id, ...BUILTIN_STRATEGIES.map(strategy => strategy.id)];

export const SETTINGS_SCHEMA = {
  // Common rules.
  'rules.dealerHitsSoft17': bool(true),
  'rules.dealerPeeksTen': bool(true),
  'rules.dealerPeeksAce': bool(true),
  'rules.noHoleCard': bool(false),
  'rules.dealerBlackjackWinsAll': bool(false),
  'rules.doubleAfterSplit': bool(true),
  'rules.hardDoubles': oneOf(['none', '10-11', '9-11', '8-11', 'any'], 'any'),
  'rules.softDoubles': oneOf(['none', 'a8a9', 'any'], 'any'),
  'rules.insurance': oneOf(['none', 'normal', 'blackjackOnly'], 'normal'),
  'rules.surrender': oneOf(['none', 'late', 'early', 'earlyVsTen', 'macao'], 'late'),
  // Rule variations.
  'rules.doubleOnThreeCards': bool(false),
  'rules.doubleAnyNumberOfCards': bool(false),
  'rules.redouble': bool(false),
  'rules.tripleDown': bool(false),
  'rules.hitAfterDouble': bool(false),
  'rules.doubleDownRescue': bool(false),
  'rules.maxSplitHands': oneOf([2, 3, 4], 4),
  'rules.doubleAfterSplitAces': bool(false),
  'rules.resplitAces': bool(false),
  'rules.hitSplitAces': bool(false),
  'rules.splitTensSameRankOnly': bool(false),
  'rules.noAceSplits': bool(false),
  'rules.noSplit4s5s10s': bool(false),
  // Play variations.
  'rules.surrenderAfterInsurance': bool(true),
  'rules.dealerWinsTies': bool(false),
  'rules.dealerWinsTied17': bool(false),
  'rules.dealerWinsTies17to19': bool(false),
  'rules.autoWinFiveCards': bool(false),
  'rules.autoWinSixCards': bool(false),
  'rules.autoWinSevenCards': bool(false),
  'rules.player22CountsAs21': bool(false),
  // Blackjack payout and special games.
  'rules.blackjackPayout': oneOf(['3:2', '2:1', '1:1', '6:5'], '3:2'),
  'rules.blackjackRoundUp': bool(false),
  'rules.playerBlackjackAlwaysWins': bool(false),

  // Table setup (game).
  'table.decks': oneOf(DECKS, 6),
  'table.shuffleMode': oneOf(['cutCard', 'rounds'], 'cutCard'),
  'table.cardsBehindCutCard': int(65, 1, 415),
  'table.roundsPerShoe': int(6, 1, 80),
  'table.burnCards': int(1, 0, 5),
  'table.startingBankroll': int(30000, 100, 1000000),
  'table.seatCount': oneOf([1, 2, 4, 6], 4),
  /** Seats 1..6: true = computer player. */
  'table.computerSeats': json([true, false, false, false, false, false]),
  'table.limits': oneOf(
    TABLE_LIMITS.map((_, i) => i),
    7,
  ),
  'table.cardsFaceDown': bool(false),
  'table.doubleDownCardFaceUp': bool(true),
  'table.showBurnCards': bool(true),
  'table.playersComeAndGo': bool(false),
  'table.refreshBankrollOnStart': bool(false),

  // Playing strategy (shared).
  'strategy.system': oneOf(
    BUILTIN_STRATEGIES.map(strategy => strategy.id),
    BUILTIN_STRATEGIES[0].id,
  ),
  'strategy.indexSet': oneOf(['all', 'illustrious18', 'sweet16', 'catch20', 'none', 'custom'], 'all'),
  'strategy.customIndexMask': json(tableGrids(false)),
  'strategy.indexRangeMin': int(-99, -99, 99),
  'strategy.indexRangeMax': int(99, -99, 99),
  'strategy.adjustInitialCount': bool(false),
  'strategy.initialCount': int(0, -999, 999),
  'strategy.warnOnError': bool(true),

  // True count calculation (shared).
  'trueCount.resolution': oneOf(['full', 'half', 'quarter', 'exact'], 'half'),
  'trueCount.lastDeckResolution': oneOf(['half', 'quarter', 'exact'], 'half'),
  'trueCount.rounding': oneOf(['round', 'truncate', 'floor'], 'truncate'),
  'trueCount.remainingCards': oneOf(['dealt', 'shown', 'inTray'], 'inTray'),
  'trueCount.allowedErrorCards': int(13, 0, 13),
  'trueCount.aceSideCount': bool(false),
  'trueCount.tenSideCount': bool(false),

  // Betting (game).
  'betting.chipValue': oneOf([1, 5, 10, 25, 100, 500, 1000], 25),
  'betting.warnOnError': bool(true),
  /** Bet ramp: rows[i] applies at count minCount + i (first row "or less", last row "or more"). */
  'betting.ramp': json<Ramp>({ minCount: 0, rows: [1, 2, 4, 6, 12, 16].map(chips => ({ chips, hands: 1 })) }, isRamp),

  // Unusual games, side bets and bonuses (game).
  'bonuses.game': oneOf(
    BUILTIN_SIDE_BET_GAMES.map(game => game.id),
    0,
  ),
  /** The rules an unusual game overwrote, put back when it is left. */
  'bonuses.savedRules': json<Record<string, unknown>>({}),
  'bonuses.sevens777': oneOf(['none', '2:1', '3:2', 'suited10:1'], 'none'),
  'bonuses.suitedAceJack': bool(false),
  'bonuses.heartsAceJack': bool(false),
  'bonuses.diamondBlackjack': bool(false),
  'bonuses.fiveCard21': bool(false),
  'bonuses.sixCard21': bool(false),
  'bonuses.fivePlusCard21': bool(false),
  'bonuses.suited678': bool(false),
  'bonuses.suited678IfWins': bool(false),
  'bonuses.splitTenAceIsBlackjack': bool(false),

  // Dealer errors (game).
  'dealerErrors.insurancePayoff': bool(false),
  'dealerErrors.blackjackPayoff': bool(false),
  'dealerErrors.noPayOnWin': bool(false),
  'dealerErrors.bustOn21OrLess': bool(false),
  'dealerErrors.standOn16': bool(false),
  'dealerErrors.shouldHaveBusted': bool(false),
  'dealerErrors.loseOnPush': bool(false),
  'dealerErrors.noBonusPayoff': bool(false),
  'dealerErrors.dealingBias': oneOf(
    ['none', 'positiveCounts', 'negativeCounts', 'manyCardHands', 'repeatErrors', 'difficultHands'],
    'none',
  ),

  // Peeking / hole carding (game).
  'peeking.mode': oneOf(['off', 'holeCard', 'whenDealerPeeks'], 'off'),
  'peeking.percent': oneOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 100),
  'peeking.adjacentHands': bool(false),
  'peeking.randomizeCard': bool(false),
  'peeking.randomizeHand': bool(false),
  'peeking.strategyHigh': oneOf(STRATEGY_IDS, HOLE_CARD_STRATEGY.id),
  'peeking.strategyLow': oneOf(STRATEGY_IDS, HOLE_CARD_STRATEGY.id),

  // Speed and dealer behavior (game).
  'mechanics.dealerSpeed': int(30, 1, 100),
  'mechanics.otherPlayerSpeed': int(30, 1, 100),
  'mechanics.payoffSpeed': int(30, 1, 100),
  'mechanics.dealerMakesObviousPlays': bool(false),
  'mechanics.dealerPointsOutStupidPlays': bool(true),

  // Display and sound.
  'display.theme': oneOf(['latte', 'mocha'], 'mocha'),
  /** The play each gesture makes, for the game and the drills; one mapping per orientation. */
  'gestures.portrait': json(STANDARD, isGestureMap),
  'gestures.landscape': json(STANDARD, isGestureMap),
  'display.sound': bool(false),
  'display.quietErrorSound': bool(false),
  'display.hideActionButtons': bool(true),
  'display.hideDiscardTray': bool(false),
  'display.hideShoe': bool(false),
  'display.showBetAccuracy': bool(false),
  'display.showPlayAccuracy': bool(false),
  'display.showRunningCount': bool(false),
  'display.showTrueCount': bool(false),

  // Flash drills.
  'drills.flash.hands': oneOf(
    ['default', 'illustrious18', 'withIndices', 'drillErrors', 'custom', 'roundRobin'],
    'default',
  ),
  'drills.flash.customHands': json(tableGrids(true)),
  'drills.flash.situations': json({
    hardStand: true,
    softStand: true,
    hardDouble: true,
    softDouble: true,
    split: true,
    surrender: true,
  }),
  'drills.flash.countMode': oneOf(['zero', 'random', 'fixed', 'indexTest'], 'random'),
  'drills.flash.fixedCount': int(0, -99, 99),
  'drills.flash.maxCards': oneOf([2, 3, 4, 5], 2),
  'drills.flash.testMode': oneOf(['warn', 'errorsAtEnd', 'none'], 'warn'),
  /** Warn on error: a brief "X is incorrect" instead of the blocking explanation. */
  'drills.flash.nonBlockingErrors': bool(false),
  'drills.flash.timerMode': oneOf(['auto', 'countDownHalt', 'infinite'], 'countDownHalt'),
  /** Rounds and Infinite: whether each hand has a time limit (the Time per hand below). */
  'drills.flash.timePerHand': bool(true),
  'drills.flash.handsPerDrill': int(50, 10, 1000),
  'drills.flash.decks': oneOf(DECKS, 6),
  'drills.flash.spanishDecks': bool(false),
  /** Rounds and Infinite timer modes: seconds to answer each hand. */
  'drills.flash.seconds': int(10, 1, 60),
  /** The count-down and count-up timer modes: seconds for the whole drill. */
  'drills.flash.drillSeconds': int(180, 10, 1799),
  'drills.flash.progressiveSpeed': bool(false),
  /** Infinite: pause by itself every `autoPauseSeconds` of drill time, after the hand on screen. */
  'drills.flash.autoPause': bool(false),
  'drills.flash.autoPauseSeconds': int(180, 1, 3600),

  // Depth (discard tray) drills.
  'drills.depth.drill': oneOf(
    ['decksLeft', 'halfDecksLeft', 'quarterDecksLeft', 'acesLeft', 'trueCount', 'trueCountAndDecks'],
    'decksLeft',
  ),
  'drills.depth.accuracy': oneOf(ACCURACY, 0),
  'drills.depth.resolution': oneOf(['full', 'half', 'quarter'], 'half'),
  'drills.depth.decks': oneOf(DECKS, 6),
  'drills.depth.trayStyle': oneOf(TRAY_STYLES, 'sixDeckFront'),
  'drills.depth.timerMode': oneOf(['auto', 'countDownHalt'], 'countDownHalt'),
  'drills.depth.testsPerDrill': int(50, 10, 200),
  /** Rounds mode: seconds to answer each test. */
  'drills.depth.seconds': int(10, 1, 60),
  /** Count Down & Halt: seconds for the whole drill. */
  'drills.depth.drillSeconds': int(180, 10, 1799),
  'drills.depth.cardThickness': int(100, 100, 110),
  'drills.depth.countRangeMin': int(-10, -99, 99),
  'drills.depth.countRangeMax': int(15, -99, 99),
  'drills.depth.askCardsInTray': bool(false),
  'drills.depth.progressiveSpeed': bool(false),

  // Count drills.
  'drills.count.drill': oneOf(
    [
      'runningCount',
      'trueCount',
      'acesLeft',
      'acesDealt',
      'aceBetCount',
      'acePlayCount',
      'aceInsureCount',
      'tenSideCount',
    ],
    'runningCount',
  ),
  'drills.count.testEvery': oneOf(['everyCard', 'about8', 'about16', 'about36', 'never'], 'about36'),
  'drills.count.accuracy': oneOf(ACCURACY, 0),
  'drills.count.orientation': oneOf(['vertical', 'horizontal', 'mixed'], 'vertical'),
  'drills.count.positions': oneOf(['vertical', 'horizontal', 'diagonal', 'mixed'], 'diagonal'),
  'drills.count.cardsPerFlash': oneOf(['1', '2', '3', '4', '1-2', '1-3', '1-4'], '1-2'),
  'drills.count.bias': oneOf(['none', 'negative', 'positive'], 'none'),
  'drills.count.endWarning': oneOf(['none', 'oneCardLeft', 'twoCardsLeft'], 'none'),
  'drills.count.decks': oneOf(DECKS, 6),
  'drills.count.trayStyle': oneOf(TRAY_STYLES, 'sixDeckFront'),
  'drills.count.timerMode': oneOf(['auto', 'countDownHalt'], 'countDownHalt'),
  /** Deal each group of cards with Next instead of at the deal speed. */
  'drills.count.dealByHand': bool(false),
  /** Tenths of a second between flashes. */
  'drills.count.dealTenths': int(8, 1, 59),
  'drills.count.testSeconds': int(10, 1, 15),
  'drills.count.cardThickness': int(100, 100, 110),
  /** Count Down & Halt: seconds for the whole drill. */
  'drills.count.alarmSeconds': int(180, 10, 1799),
  'drills.count.progressiveSpeed': bool(false),
  'drills.count.twoCounts': bool(false),

  // Full table drills.
  'drills.full.drill': oneOf(['runningCount', 'acesLeft', 'acesDealt', 'tenSideCount', 'twoTables'], 'runningCount'),
  'drills.full.accuracy': oneOf(ACCURACY, 0),
  'drills.full.players': oneOf([2, 4, 6], 6),
  'drills.full.handStyle': oneOf(['twoToFourCards', 'firstTwoCards', 'scattered'], 'firstTwoCards'),
  'drills.full.bias': oneOf(['none', 'negative', 'positive'], 'none'),
  'drills.full.endWarning': oneOf(['none', 'oneCardLeft', 'twoCardsLeft'], 'none'),
  'drills.full.decks': oneOf(DECKS, 6),
  'drills.full.timerMode': oneOf(['auto', 'countDownHalt'], 'countDownHalt'),
  /** Seconds the cards stay on the table before they are hidden. */
  'drills.full.flashSpeed': int(10, 1, 30),
  'drills.full.testSeconds': int(10, 1, 40),
  /** Count Down & Halt: seconds for the whole drill. */
  'drills.full.alarmSeconds': int(180, 10, 1799),
  'drills.full.progressiveSpeed': bool(false),
  'drills.full.twoCounts': bool(false),
} satisfies Record<string, SettingDef>;

export type AppSchema = typeof SETTINGS_SCHEMA;
/** Every setting's dotted key. */
export type SettingKey = keyof AppSchema;
/** Every setting's value type, by key. */
export type SettingValues = SettingsValues<AppSchema>;
/** Some settings to apply together, as `Settings.update` takes them. */
export type SettingsPatch = Partial<SettingValues>;
/** Reads the current value of a setting. */
export type SettingReader = <K extends SettingKey>(key: K) => SettingValues[K];
/** The app's settings store. */
export type AppSettings = Settings<AppSchema>;
