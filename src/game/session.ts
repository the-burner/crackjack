// A play session at the table: the engine plus the things that live across
// rounds — the count, the bankroll, statistics, and checking the player's
// decisions against their strategy.

import { BlackjackGame, STATE, ACTION } from './engine/game';
import type { AvailableActions, ComputerPlayContext, GameAction, GameState } from './engine/game';
import type { GameEvent } from './engine/events';
import type { Hand, HandKey } from './engine/hand';
import { rulesFrom, MAX_CARDS_PER_HAND } from './engine/rules';
import type { Rules } from './engine/rules';
import { Counter } from '@/core/counting';
import type { CounterSettings } from '@/core/counting';
import type { CardId } from '@/core/cards';
import type { Strategy } from '@/core/strategy/strategy-tables';
import type { Services } from '@/app/app';
import type { AppSettings } from '@/settings/schema';
import type { SideBetGame } from '@/settings/side-bet-games';
import { checkPlay, correctPlay, checkInsurance, checkBet, expectedBet } from './play-check';
import { shoeStartsIn, wongedIn } from './wonging';
import type { ExpectedBet, PlayCheck, PlayCounts, PlayQuestion } from './play-check';
import { TC_DIVISION, TC_LAST_DECK, TC_ROUNDING } from '@/core/counting';
import { decodeSideBetGame } from '@/settings/side-bet-games';
import { SIDE_BET_GAME_DEFINITIONS } from '@/data/side-bet-games';
import { sideBetSpots } from './engine/side-bets';
import type { SideBetSpot } from './engine/side-bets';
import { emptyStats } from './record';
import type { GameStats } from './record';

const DIVISION = {
  full: TC_DIVISION.fullDeck,
  half: TC_DIVISION.halfDeck,
  quarter: TC_DIVISION.quarterDeck,
  exact: TC_DIVISION.exact,
};
const LAST_DECK = { half: TC_LAST_DECK.halfDeck, quarter: TC_LAST_DECK.quarterDeck, exact: TC_LAST_DECK.exact };
const ROUNDING = { round: TC_ROUNDING.round, truncate: TC_ROUNDING.truncate, floor: TC_ROUNDING.floor };

/** The table as the session sets it up from the settings. */
export type SessionTable = ReturnType<GameSession['tableFrom']>;

/** The counts the player is judged at, plus the shoe's state. */
export interface SessionCounts extends PlayCounts {
  exactTrueCount: number;
  betCount: number;
  aces: number;
  tens: number;
  decksRemaining: number;
}

/** The player's last strategy error, for the Last Error screen. */
export type PlayError = PlayCheck & { hand: HandKey; cards: CardId[]; upcard: CardId; action: GameAction };

/** A settled round's bankroll figures. */
interface SettledRound {
  bankroll: number;
  highBankroll: number;
  lowBankroll: number;
}

export class GameSession {
  app: Services;
  settings: AppSettings;
  rules: Rules;
  table: SessionTable;
  strategy: Strategy;
  sideBetGame: SideBetGame | null;
  counter: Counter;
  /** Whether the wong counts have the player in this shoe; null until its first bet. */
  wongPlaying: boolean | null = null;
  /** The round in play is one the player sat out. */
  satOut = false;
  stats: GameStats;
  warnings: string[];
  lastError: PlayError | null;
  /** The last settled round's bankroll figures, until the next round starts. */
  settledRound: SettledRound | null;
  /** The counts as betting opened for the round in play (or the last one); null before the first. */
  roundStartCounts: Pick<SessionCounts, 'runningCount' | 'decksRemaining' | 'trueCount'> | null = null;
  game: BlackjackGame;
  /**
   * Set by the table screen: asked before each dealer draw; false makes the
   * dealer stand (dealer errors).
   */
  beforeDealerDraw?: (dealer: Hand) => boolean;
  /** Set by the table screen: true lets the dealer wrongly bust this good hand. */
  onGoodHandBusted?: (hand: Hand) => boolean;

  /** `app` is the application services (settings, storage, strategies, sound, errorTallies). */
  constructor(app: Services) {
    this.app = app;
    this.settings = app.settings;
    this.rules = rulesFrom(this.settings);
    this.table = this.tableFrom();
    this.strategy = app.strategies.current(this.settings, this.table.decks);
    this.sideBetGame = this.loadSideBetGame();
    this.counter = new Counter(this.strategy, this.trueCountSettings());
    this.stats = { ...app.gameStats.getState().value };
    this.warnings = [];
    this.lastError = null;
    this.settledRound = null;

    const startingBankroll = this.settings.get('table.startingBankroll');
    const saved = app.bankroll.getState().value;
    const bankroll = this.settings.get('table.refreshBankrollOnStart') || saved === null ? startingBankroll : saved;

    this.game = new BlackjackGame({
      rules: this.rules,
      table: this.table,
      bankroll,
      computerPlay: (hand, context) => this.computerAction(hand, context),
      onCardSeen: (card, faceUp, cardsGone) => this.counter.addCard(card, cardsGone),
      sideBetGame: this.sideBetGame,
      trueCount: () => this.counter.trueCount,
      beforeDealerDraw: dealer => this.beforeDealerDraw?.(dealer) ?? true,
      onGoodHandBusted: hand => this.onGoodHandBusted?.(hand) ?? false,
      onShuffle: () => {
        this.counter.reset(this.table.decks);
        // A new shoe begins wonged in or out afresh.
        this.wongPlaying = null;
      },
    });
  }

  /** The decoded side-bet game the player selected, if any. */
  loadSideBetGame(): SideBetGame | null {
    const id = this.settings.get('bonuses.game');
    if (!id) return null;
    const definition = SIDE_BET_GAME_DEFINITIONS[id];
    if (!definition) return null;
    try {
      return decodeSideBetGame(definition);
    } catch {
      return null;
    }
  }

  /** The side-bet spots the selected game offers, for the betting screen. */
  sideBetSpots(): SideBetSpot[] {
    return sideBetSpots(this.sideBetGame);
  }

  tableFrom() {
    const get: AppSettings['get'] = key => this.settings.get(key);
    const seatCount = get('table.seatCount');
    const computerSeats = get('table.computerSeats')
      .map((isComputer, i) => (isComputer ? i + 1 : null))
      .filter((seat): seat is number => seat !== null && seat <= seatCount);
    return {
      decks: get('table.decks'),
      shuffleMode: get('table.shuffleMode'),
      cardsBehindCutCard: get('table.cardsBehindCutCard'),
      roundsPerShoe: get('table.roundsPerShoe'),
      burnCards: get('table.burnCards'),
      showBurnCards: get('table.showBurnCards'),
      seatCount,
      computerSeats,
      cardsFaceDown: get('table.cardsFaceDown'),
      doubleDownCardFaceUp: get('table.doubleDownCardFaceUp'),
      dealerMakesObviousPlays: get('mechanics.dealerMakesObviousPlays'),
      playersComeAndGo: get('table.playersComeAndGo'),
      peeking: {
        mode: get('peeking.mode'),
        percent: get('peeking.percent'),
        adjacentHands: get('peeking.adjacentHands'),
        randomizeCard: get('peeking.randomizeCard'),
        randomizeHand: get('peeking.randomizeHand'),
      },
      limits: get('table.limits'),
      maxCardsPerHand: MAX_CARDS_PER_HAND,
      remainingCards: get('trueCount.remainingCards'),
    };
  }

  trueCountSettings(): CounterSettings {
    const get: AppSettings['get'] = key => this.settings.get(key);
    return {
      division: DIVISION[get('trueCount.resolution')],
      lastDeck: LAST_DECK[get('trueCount.lastDeckResolution')],
      rounding: ROUNDING[get('trueCount.rounding')],
      aceSideCount: get('trueCount.aceSideCount'),
    };
  }

  // --- counting -------------------------------------------------------------

  get counts(): SessionCounts {
    return {
      runningCount: this.counter.running,
      trueCount: this.counter.trueCount,
      exactTrueCount: this.counter.exactTrueCount,
      betCount: this.counter.betCount,
      aces: this.counter.aces,
      tens: this.counter.tens,
      decksRemaining: this.counter.decksRemaining(this.game.cardsGone()),
    };
  }

  // --- betting --------------------------------------------------------------

  /** The bet the player's ramp calls for right now. */
  suggestedBet(): ExpectedBet {
    return expectedBet({
      ramp: this.settings.get('betting.ramp'),
      chipValue: this.settings.get('betting.chipValue'),
      count: this.betCount(),
    });
  }

  /** Starts a round, returning the engine events. `betPerHand` is wagered on `hands` human seats. */
  startRound({
    betPerHand,
    hands = 1,
    sideBets = {},
  }: {
    betPerHand: number;
    hands?: number;
    sideBets?: Record<string, number>;
  }): GameEvent[] {
    this.warnings = [];
    const humanSeats = this.humanSeats().slice(0, hands);
    const verdict = this.wongVerdict(false);
    if (this.settings.get('betting.warnOnError')) {
      if (verdict === null) this.checkBetting(betPerHand, humanSeats.length);
      else this.recordBetDecision(verdict);
    }
    this.satOut = false;

    // Bet stats are round totals, not per hand.
    const roundBet = betPerHand * humanSeats.length;
    this.stats.rounds += 1;
    this.stats.totalBet += roundBet;
    this.stats.highBet = Math.max(this.stats.highBet, roundBet);
    if (roundBet > 0) this.stats.lowBet = this.stats.lowBet === 0 ? roundBet : Math.min(this.stats.lowBet, roundBet);

    this.settledRound = null;
    const events = this.game.startRound(humanSeats.map(seat => ({ seat, bet: betPerHand, sideBets })));
    this.afterEngineStep();
    return events;
  }

  /** Sits out a round: the computer seats play it while the player counts. */
  wong(): GameEvent[] {
    this.warnings = [];
    const verdict = this.wongVerdict(true);
    if (this.settings.get('betting.warnOnError') && verdict !== null) this.recordBetDecision(verdict);
    // Graded as a bet, but not a round played.
    this.satOut = true;
    this.settledRound = null;
    const events = this.game.startRound([]);
    this.afterEngineStep();
    return events;
  }

  /** Whether the wong counts say to sit out the next round. */
  shouldWong(): boolean {
    return !this.nextWongPlaying();
  }

  /** Whether the player would be alone at the table next round, and so must play it. */
  soloNextRound(): boolean {
    return this.game.upcomingComputerSeats().every(seat => seat > this.table.seatCount);
  }

  /** The wong state the count now moves the shoe to. */
  nextWongPlaying(): boolean {
    const rule = { wongIn: this.settings.get('betting.wongIn'), wongOut: this.settings.get('betting.wongOut') };
    const was = this.wongPlaying ?? shoeStartsIn(rule, this.settings.get('betting.wongStartOut'));
    return wongedIn(was, this.betCount(), rule);
  }

  /**
   * Moves the shoe's wong state on and judges sitting out, or not, against it:
   * a message when wrong, '' when right, null when the bet itself is to be judged.
   */
  wongVerdict(wonged: boolean): string | null {
    if (!this.settings.get('betting.wonging')) return null;
    const playing = this.nextWongPlaying();
    this.wongPlaying = playing;
    if (wonged) return playing ? 'That should have been a bet, not a Wong' : '';
    // Alone at the table every hand is played, so only the bet is judged.
    if (!playing && !this.soloNextRound()) return 'That should have been a Wong';
    return null;
  }

  /** Counts a bet decision, warning when it was wrong. */
  recordBetDecision(message: string): void {
    this.stats.betDecisions += 1;
    if (!message) return;
    this.stats.betErrors += 1;
    this.warn(message);
  }

  /** The count bets are judged by. */
  betCount(): number {
    return this.settings.get('trueCount.aceSideCount') ? this.counter.betCount : this.counter.trueCount;
  }

  humanSeats(): number[] {
    const seats: number[] = [];
    for (let seat = 1; seat <= this.table.seatCount; seat++)
      if (!this.table.computerSeats.includes(seat)) seats.push(seat);
    return seats;
  }

  checkBetting(betPerHand: number, hands: number): void {
    const check = checkBet({
      ramp: this.settings.get('betting.ramp'),
      chipValue: this.settings.get('betting.chipValue'),
      count: this.betCount(),
      betPerHand,
      hands,
    });
    this.stats.betDecisions += 1;
    if (!check.correct) {
      this.stats.betErrors += 1;
      this.warn(check.message);
    }
  }

  // --- actions --------------------------------------------------------------

  /** The actions the player may take, from the engine. */
  availableActions(): AvailableActions {
    return this.game.availableActions();
  }

  /** Plays an action, after checking it against the strategy. */
  act(action: GameAction): GameEvent[] {
    const hand = this.game.activeHand;
    if (hand) this.checkAction(hand, action);
    const events = this.game.act(action);
    this.afterEngineStep();
    return events;
  }

  takeInsurance(): GameEvent[] {
    this.checkInsuranceDecision(true);
    const events = this.game.takeInsurance();
    this.afterEngineStep();
    return events;
  }

  declineInsurance(): GameEvent[] {
    this.checkInsuranceDecision(false);
    const events = this.game.declineInsurance();
    this.afterEngineStep();
    return events;
  }

  checkAction(hand: Hand, action: GameAction): void {
    if (!this.settings.get('strategy.warnOnError')) return;
    const check = checkPlay({
      strategy: this.strategy,
      rules: this.rules,
      hand,
      upcard: this.game.dealer.cards[0],
      dealer: this.game.dealer,
      counts: this.counts,
      shoe: this.game.shoe,
      handsInSeat: this.game.handsInSeat(hand.seat),
      action,
      nearby: this.nearbyCounts(),
    });
    this.stats.playDecisions += 1;
    if (check.correct) return;
    this.stats.playErrors += 1;
    // As in the original, an extended strategy's errors are not tallied: its columns are not the upcard's.
    if (check.table && check.row >= 0 && !this.strategy.extended)
      this.app.errorTallies.record(check.table, check.row, check.column);
    this.lastError = { ...check, hand: hand.key, cards: [...hand.cards], upcard: this.game.dealer.cards[0], action };
    this.warn(check.message);
  }

  /** The cards left in the shoe under each Remaining Cards choice, and the exact decks and true count for the one in use. */
  advancedCounts() {
    const inUse = this.settings.get('trueCount.remainingCards');
    const total = this.game.shoe.decks * 52;
    const cardsLeft = {
      dealt: total - this.game.cardsGone('dealt'),
      shown: total - this.game.cardsGone('shown'),
      inTray: total - this.game.cardsGone('inTray'),
    };
    const exactDecks = cardsLeft[inUse] / 52;
    return { cardsLeft, inUse, exactDecks, exactTrueCount: this.counter.exactTrueCountOver(exactDecks) };
  }

  /** A round starts as its betting opens: notes the counts it starts at. */
  startBetting(): void {
    const { runningCount, decksRemaining, trueCount } = this.counts;
    this.roundStartCounts = { runningCount, decksRemaining, trueCount };
  }

  /** The counts with the allowed estimation error's cards more and fewer gone, as the original checked a close call. */
  nearbyCounts(): Pick<PlayQuestion, 'counts' | 'shoe'>[] {
    const error = this.settings.get('trueCount.allowedErrorCards');
    if (!error) return [];
    const gone = this.game.cardsGone();
    const { decks } = this.game.shoe;
    return [gone - error, gone + error].map(shifted => {
      const at = Math.min(Math.max(shifted, 1), decks * 52 - 1);
      return {
        counts: { ...this.counts, trueCount: this.counter.trueCountAt(at) },
        shoe: { decks, dealt: this.game.shoe.dealt - gone + at },
      };
    });
  }

  checkInsuranceDecision(took: boolean): void {
    if (!this.settings.get('strategy.warnOnError')) return;
    const check = checkInsurance({
      strategy: this.strategy,
      counts: this.counts,
      hand: this.game.activeHand,
      tenSideCount: this.settings.get('trueCount.tenSideCount')
        ? { tens: this.counter.tens, decks: this.table.decks }
        : null,
      tookInsurance: took,
    });
    this.stats.playDecisions += 1;
    if (check.correct) return;
    this.stats.playErrors += 1;
    this.warn(check.message);
  }

  warn(message: string): void {
    if (!message) return;
    this.warnings.push(message);
    this.app.sound.play('error');
  }

  /** Takes the warnings raised since the last call. */
  takeWarnings(): string[] {
    const warnings = this.warnings;
    this.warnings = [];
    return warnings;
  }

  // --- dealer errors --------------------------------------------------------

  /** The player called Foul and there was an error to catch. */
  recordFoulCaught(): void {
    this.stats.foulDecisions += 1;
    this.save();
  }

  /** The player called Foul with nothing wrong. */
  recordFalseFoul(): void {
    this.stats.foulDecisions += 1;
    this.stats.foulErrors += 1;
    this.save();
  }

  /** A dealer error went uncalled. */
  recordMissedDealerError(): void {
    this.stats.foulDecisions += 1;
    this.stats.foulErrors += 1;
    this.save();
  }

  /** How a computer seat plays: with the player's own strategy. */
  computerAction(hand: Hand, { dealerUpcard }: ComputerPlayContext): GameAction {
    // Computer seats never give a hand up, as in the original, so the strategy is
    // asked for its best move with surrender taken away.
    const { action } = correctPlay({
      strategy: this.strategy,
      rules: { ...this.rules, surrender: 'none' },
      hand,
      upcard: dealerUpcard,
      dealer: this.game.dealer,
      counts: this.counts,
      shoe: this.game.shoe,
      handsInSeat: this.game.handsInSeat(hand.seat),
    });
    return action === ACTION.surrender ? ACTION.stand : action;
  }

  afterEngineStep(): void {
    if (this.game.state !== STATE.settled) return;
    // A round sat out moves no money and is not one played.
    if (this.satOut) {
      this.save();
      return;
    }
    // Kept so a later change to this round's bankroll (a dealer error, a Foul
    // refund) replaces what the round recorded rather than going unrecorded.
    this.settledRound = {
      bankroll: this.game.bankroll,
      highBankroll: this.stats.highBankroll,
      lowBankroll: this.stats.lowBankroll,
    };
    this.recordBankroll();
    this.save();
  }

  /** Adds the bankroll to the high, low and average figures. */
  recordBankroll(): void {
    const bankroll = this.game.bankroll;
    this.stats.bankrollSum += bankroll;
    this.stats.highBankroll = Math.max(this.stats.highBankroll, bankroll);
    this.stats.lowBankroll = this.stats.lowBankroll === 0 ? bankroll : Math.min(this.stats.lowBankroll, bankroll);
  }

  nextRound(): GameEvent[] {
    return this.game.nextRound();
  }

  /** Puts the bankroll back to its starting amount. */
  resetBankroll(): void {
    this.settledRound = null;
    this.game.bankroll = this.settings.get('table.startingBankroll');
    this.save();
  }

  resetStats(): void {
    this.stats = emptyStats();
    this.save();
  }

  /**
   * Shuffles now and returns the events, so the screen can animate the new shoe
   * and tray straight away.
   */
  shuffleNow(): GameEvent[] {
    this.game.shuffleAndBurn();
    // The round being bet starts over on the new shoe.
    this.startBetting();
    return this.game.takeEvents();
  }

  /** Adjusts the bankroll (dealer-error refunds, mid-round returns). */
  adjustBankroll(delta: number): void {
    this.game.bankroll += delta;
    const round = this.settledRound;
    if (round) {
      this.stats.bankrollSum -= round.bankroll;
      this.stats.highBankroll = round.highBankroll;
      this.stats.lowBankroll = round.lowBankroll;
      round.bankroll = this.game.bankroll;
      this.recordBankroll();
    }
    this.save();
  }

  save(): void {
    this.app.bankroll.setState({ value: this.game.bankroll });
    this.app.gameStats.setState({ value: { ...this.stats } });
  }

  /** Accuracy percentages for the stats screen. */
  accuracy(): { play: number; bet: number; foul: number } {
    // Plays round, bets truncate.
    const rate = (errors: number, total: number) => (total === 0 ? 100 : 100 * (1 - errors / total));
    return {
      play: Math.round(rate(this.stats.playErrors, this.stats.playDecisions)),
      bet: Math.floor(rate(this.stats.betErrors, this.stats.betDecisions)),
      foul: Math.floor(rate(this.stats.foulErrors, this.stats.foulDecisions)),
    };
  }

  get bankroll(): number {
    return this.game.bankroll;
  }

  get state(): GameState {
    return this.game.state;
  }
}
