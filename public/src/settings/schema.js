// Every user setting, with its type and default. Shared groups (rules,
// strategy, trueCount, display) are used by both the game and the drills;
// drills.* groups belong to one drill each.

const bool = value => ({ type: 'bool', default: value });
const int = (value, min, max) => ({ type: 'int', default: value, min, max });
const oneOf = (values, value) => ({ type: 'enum', values, default: value });
const json = value => ({ type: 'json', default: value });

const grid = (rows, cols, value) => Array.from({ length: rows }, () => new Array(cols).fill(value));
const tableGrids = value => ({
  split: grid(10, 10, value), hardStand: grid(10, 10, value), softDouble: grid(10, 10, value),
  hardDouble: grid(10, 10, value), softStand: grid(10, 10, value), surrender: grid(10, 10, value),
});

export const DECKS = [1, 2, 3, 4, 5, 6, 7, 8];
export const TIMER_MODES = ['auto', 'countDown', 'countUp', 'countDownHalt'];
export const ACCURACY = [0, 1, 2];
export const TRAY_STYLES = ['eightDeckFront', 'sixDeckFront', 'doubleDeckFront', 'sixDeckRear', 'doubleDeckRear'];
export const TABLE_LIMITS = [
  [1, 50], [5, 250], [5, 1000], [10, 2000], [25, 2500], [100, 5000], [500, 25000], [1, 100000],
];

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
  'table.limits': oneOf(TABLE_LIMITS.map((_, i) => i), 7),
  'table.cardsFaceDown': bool(false),
  'table.doubleDownCardFaceUp': bool(true),
  'table.showBurnCards': bool(true),
  'table.playersComeAndGo': bool(false),
  'table.refreshBankrollOnStart': bool(false),

  // Playing strategy (shared).
  'strategy.system': int(100),
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
  'betting.ramp': json({ minCount: 0, rows: [1, 2, 4, 6, 12, 16].map(chips => ({ chips, hands: 1 })) }),

  // Unusual games, side bets and bonuses (game).
  'bonuses.game': int(0),
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
  'dealerErrors.dealingBias': oneOf(['none', 'positiveCounts', 'negativeCounts', 'manyCardHands', 'repeatErrors', 'difficultHands'], 'none'),

  // Peeking / hole carding (game).
  'peeking.mode': oneOf(['off', 'holeCard', 'whenDealerPeeks'], 'off'),
  'peeking.percent': oneOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 100),
  'peeking.adjacentHands': bool(false),
  'peeking.randomizeCard': bool(false),
  'peeking.randomizeHand': bool(false),
  'peeking.strategyHigh': int(99),
  'peeking.strategyLow': int(99),

  // Speed and dealer behavior (game).
  'mechanics.dealerSpeed': int(30, 1, 100),
  'mechanics.otherPlayerSpeed': int(30, 1, 100),
  'mechanics.payoffSpeed': int(30, 1, 100),
  'mechanics.dealerMakesObviousPlays': bool(false),
  'mechanics.dealerPointsOutStupidPlays': bool(true),

  // Display and sound.
  'display.theme': oneOf(['classic', 'latte', 'mocha'], 'mocha'),
  'display.sound': bool(false),
  'display.quietErrorSound': bool(false),
  'display.hideActionButtons': bool(false),
  'display.hideDiscardTray': bool(false),
  'display.hideShoe': bool(false),
  'display.showBetAccuracy': bool(false),
  'display.showPlayAccuracy': bool(false),
  'display.showRunningCount': bool(false),
  'display.showTrueCount': bool(false),

  // Flash drills.
  'drills.flash.hands': oneOf(['default', 'illustrious18', 'withIndices', 'drillErrors', 'custom'], 'default'),
  'drills.flash.customHands': json(tableGrids(true)),
  'drills.flash.situations': json({ hardStand: true, softStand: true, hardDouble: true, softDouble: true, split: true, surrender: true }),
  'drills.flash.countMode': oneOf(['zero', 'random', 'fixed', 'indexTest'], 'random'),
  'drills.flash.fixedCount': int(0, -99, 99),
  'drills.flash.maxCards': oneOf([2, 3, 4, 5], 2),
  'drills.flash.testMode': oneOf(['warn', 'errorsAtEnd', 'none'], 'warn'),
  'drills.flash.timerMode': oneOf(TIMER_MODES, 'auto'),
  'drills.flash.handsPerDrill': int(50, 10, 1000),
  'drills.flash.decks': oneOf(DECKS, 6),
  'drills.flash.spanishDecks': bool(false),
  'drills.flash.seconds': int(10, 1, 60),
  'drills.flash.progressiveSpeed': bool(false),

  // Depth (discard tray) drills.
  'drills.depth.drill': oneOf(['decksLeft', 'halfDecksLeft', 'quarterDecksLeft', 'acesLeft', 'trueCount', 'trueCountAndDecks'], 'decksLeft'),
  'drills.depth.accuracy': oneOf(ACCURACY, 0),
  'drills.depth.resolution': oneOf(['full', 'half', 'quarter'], 'half'),
  'drills.depth.decks': oneOf(DECKS, 6),
  'drills.depth.trayStyle': oneOf(TRAY_STYLES, 'sixDeckFront'),
  'drills.depth.timerMode': oneOf(TIMER_MODES, 'auto'),
  'drills.depth.testsPerDrill': int(50, 10, 200),
  'drills.depth.seconds': int(2, 1, 60),
  'drills.depth.cardThickness': int(100, 100, 110),
  'drills.depth.countRangeMin': int(-10, -99, 99),
  'drills.depth.countRangeMax': int(15, -99, 99),
  'drills.depth.askCardsInTray': bool(false),
  'drills.depth.progressiveSpeed': bool(false),

  // Count drills.
  'drills.count.drill': oneOf(['runningCount', 'trueCount', 'acesLeft', 'acesDealt', 'aceBetCount', 'acePlayCount', 'aceInsureCount', 'tenSideCount'], 'runningCount'),
  'drills.count.testEvery': oneOf(['everyCard', 'about8', 'about16', 'about36', 'never'], 'about36'),
  'drills.count.accuracy': oneOf(ACCURACY, 0),
  'drills.count.orientation': oneOf(['vertical', 'horizontal', 'mixed'], 'vertical'),
  'drills.count.positions': oneOf(['vertical', 'horizontal', 'diagonal', 'mixed'], 'diagonal'),
  'drills.count.cardsPerFlash': oneOf(['1', '2', '3', '4', '1-2', '1-3', '1-4'], '1-2'),
  'drills.count.bias': oneOf(['none', 'negative', 'positive'], 'none'),
  'drills.count.endWarning': oneOf(['none', 'oneCardLeft', 'twoCardsLeft'], 'none'),
  'drills.count.decks': oneOf(DECKS, 6),
  'drills.count.trayStyle': oneOf(TRAY_STYLES, 'sixDeckFront'),
  'drills.count.timerMode': oneOf(TIMER_MODES.slice(0, 3), 'auto'),
  /** Tenths of a second between flashes. */
  'drills.count.dealTenths': int(20, 1, 60),
  'drills.count.testSeconds': int(6, 1, 15),
  'drills.count.cardThickness': int(100, 100, 110),
  'drills.count.alarmSeconds': int(120, 15, 300),
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
  'drills.full.timerMode': oneOf(TIMER_MODES.slice(0, 3), 'auto'),
  'drills.full.flashSpeed': int(10, 1, 30),
  'drills.full.testSeconds': int(15, 1, 40),
  'drills.full.alarmSeconds': int(120, 15, 300),
  'drills.full.progressiveSpeed': bool(false),
  'drills.full.twoCounts': bool(false),
};
