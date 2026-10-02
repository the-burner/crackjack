// A play session at the table: the engine plus the things that live across
// rounds — the count, the bankroll, statistics, and checking the player's
// decisions against their strategy.

import { BlackjackGame, STATE, ACTION } from './engine/game.js';
import { rulesFrom } from './engine/rules.js';
import { Counter } from '../core/counting.js';
import { checkPlay, checkInsurance, checkBet, expectedBet } from './play-check.js';
import { TC_DIVISION, TC_LAST_DECK, TC_ROUNDING } from '../core/counting.js';

const BANKROLL_KEY = 'bankroll';
const STATS_KEY = 'gameStats';

const DIVISION = { full: TC_DIVISION.fullDeck, half: TC_DIVISION.halfDeck, quarter: TC_DIVISION.quarterDeck, exact: TC_DIVISION.exact };
const LAST_DECK = { half: TC_LAST_DECK.halfDeck, quarter: TC_LAST_DECK.quarterDeck, exact: TC_LAST_DECK.exact };
const ROUNDING = { round: TC_ROUNDING.round, truncate: TC_ROUNDING.truncate, floor: TC_ROUNDING.floor };

/** Fresh statistics for a session. */
const emptyStats = () => ({
  rounds: 0, totalBet: 0, highBet: 0, lowBet: 0,
  highBankroll: 0, lowBankroll: 0, bankrollSum: 0,
  playDecisions: 0, playErrors: 0, betDecisions: 0, betErrors: 0,
});

export class GameSession {
  /** @param {object} app  The application services (settings, storage, strategies, sound, errorTallies). */
  constructor(app) {
    this.app = app;
    this.settings = app.settings;
    this.rules = rulesFrom(this.settings);
    this.table = this.tableFrom();
    this.strategy = app.strategies.current(this.settings, this.table.decks);
    this.counter = new Counter(this.strategy, this.trueCountSettings());
    this.stats = { ...emptyStats(), ...app.storage.get(STATS_KEY, {}) };
    this.warnings = [];
    this.lastError = null;

    const startingBankroll = this.settings.get('table.startingBankroll');
    const saved = app.storage.get(BANKROLL_KEY, null);
    const bankroll = this.settings.get('table.refreshBankrollOnStart') || saved === null ? startingBankroll : saved;

    this.game = new BlackjackGame({
      rules: this.rules,
      table: this.table,
      bankroll,
      computerPlay: (hand, context) => this.computerAction(hand, context),
      onCardSeen: card => this.counter.addCard(card, this.game.shoe.dealt),
    });
    this.counter.reset(this.table.decks);
  }

  tableFrom() {
    const get = key => this.settings.get(key);
    const seatCount = get('table.seatCount');
    const computerSeats = get('table.computerSeats')
      .map((isComputer, i) => (isComputer ? i + 1 : null))
      .filter(seat => seat !== null && seat <= seatCount);
    return {
      decks: get('table.decks'),
      shuffleMode: get('table.shuffleMode'),
      cardsBehindCutCard: get('table.cardsBehindCutCard'),
      roundsPerShoe: get('table.roundsPerShoe'),
      burnCards: get('table.burnCards'),
      seatCount,
      computerSeats,
      cardsFaceDown: get('table.cardsFaceDown'),
      doubleDownCardFaceUp: get('table.doubleDownCardFaceUp'),
      limits: get('table.limits'),
      maxCardsPerHand: 7,
    };
  }

  trueCountSettings() {
    const get = key => this.settings.get(key);
    return {
      division: DIVISION[get('trueCount.resolution')],
      lastDeck: LAST_DECK[get('trueCount.lastDeckResolution')],
      rounding: ROUNDING[get('trueCount.rounding')],
      aceSideCount: get('trueCount.aceSideCount'),
    };
  }

  // --- counting -------------------------------------------------------------

  get counts() {
    return {
      runningCount: this.counter.running,
      trueCount: this.counter.trueCount,
      exactTrueCount: this.counter.exactTrueCount,
      betCount: this.counter.betCount,
      aces: this.counter.aces,
      tens: this.counter.tens,
      decksRemaining: this.counter.decksRemaining(this.game.shoe.dealt),
    };
  }

  // --- betting --------------------------------------------------------------

  /** The bet the player's ramp calls for right now. */
  suggestedBet() {
    return expectedBet({
      ramp: this.settings.get('betting.ramp'),
      chipValue: this.settings.get('betting.chipValue'),
      count: this.settings.get('trueCount.aceSideCount') ? this.counter.betCount : this.counter.trueCount,
    });
  }

  /**
   * Starts a round. `betPerHand` is wagered on `hands` human seats.
   * @returns {object[]} engine events
   */
  startRound({ betPerHand, hands = 1, sideBets = {} }) {
    if (this.game.shoe.needsShuffle) this.counter.reset(this.table.decks);
    this.warnings = [];
    const humanSeats = this.humanSeats().slice(0, hands);
    if (this.settings.get('betting.warnOnError')) this.checkBetting(betPerHand, humanSeats.length);

    this.stats.rounds += 1;
    this.stats.totalBet += betPerHand * humanSeats.length;
    this.stats.highBet = Math.max(this.stats.highBet, betPerHand);
    this.stats.lowBet = this.stats.lowBet === 0 ? betPerHand : Math.min(this.stats.lowBet, betPerHand);

    const events = this.game.startRound(humanSeats.map(seat => ({ seat, bet: betPerHand, sideBets })));
    this.afterEngineStep();
    return events;
  }

  humanSeats() {
    const seats = [];
    for (let seat = 1; seat <= this.table.seatCount; seat++) if (!this.table.computerSeats.includes(seat)) seats.push(seat);
    return seats;
  }

  checkBetting(betPerHand, hands) {
    const check = checkBet({
      ramp: this.settings.get('betting.ramp'),
      chipValue: this.settings.get('betting.chipValue'),
      count: this.settings.get('trueCount.aceSideCount') ? this.counter.betCount : this.counter.trueCount,
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
  availableActions() {
    return this.game.availableActions();
  }

  /** Plays an action, after checking it against the strategy. */
  act(action) {
    const hand = this.game.activeHand;
    if (hand) this.checkAction(hand, action);
    const events = this.game.act(action);
    this.afterEngineStep();
    return events;
  }

  takeInsurance() {
    this.checkInsuranceDecision(true);
    const events = this.game.takeInsurance();
    this.afterEngineStep();
    return events;
  }

  declineInsurance() {
    this.checkInsuranceDecision(false);
    const events = this.game.declineInsurance();
    this.afterEngineStep();
    return events;
  }

  checkAction(hand, action) {
    if (!this.settings.get('strategy.warnOnError')) return;
    const check = checkPlay({
      strategy: this.strategy, rules: this.rules, hand, upcard: this.game.dealer.cards[0],
      counts: this.counts, shoe: this.game.shoe, handsInSeat: this.game.handsInSeat(hand.seat), action,
    });
    this.stats.playDecisions += 1;
    if (check.correct) return;
    this.stats.playErrors += 1;
    if (check.table && check.row >= 0) this.app.errorTallies.record(check.table, check.row, check.column);
    this.lastError = { ...check, hand: hand.key, cards: [...hand.cards], upcard: this.game.dealer.cards[0], action };
    this.warn(check.message);
  }

  checkInsuranceDecision(took) {
    if (!this.settings.get('strategy.warnOnError')) return;
    const check = checkInsurance({
      strategy: this.strategy, counts: this.counts, hand: this.game.activeHand,
      tenSideCount: this.settings.get('trueCount.tenSideCount') ? { tens: this.counter.tens, decks: this.table.decks } : null,
      tookInsurance: took,
    });
    this.stats.playDecisions += 1;
    if (check.correct) return;
    this.stats.playErrors += 1;
    this.warn(check.message);
  }

  warn(message) {
    if (!message) return;
    this.warnings.push(message);
    this.app.sound.play('error');
  }

  /** Takes the warnings raised since the last call. */
  takeWarnings() {
    const warnings = this.warnings;
    this.warnings = [];
    return warnings;
  }

  /** How a computer seat plays: with the player's own strategy. */
  computerAction(hand, { dealerUpcard }) {
    const { action } = checkPlay({
      strategy: this.strategy, rules: this.rules, hand, upcard: dealerUpcard,
      counts: this.counts, shoe: this.game.shoe, handsInSeat: this.game.handsInSeat(hand.seat), action: null,
    });
    return action === ACTION.surrender ? ACTION.stand : action;
  }

  afterEngineStep() {
    if (this.game.state !== STATE.settled) return;
    this.stats.bankrollSum += this.game.bankroll;
    this.stats.highBankroll = Math.max(this.stats.highBankroll, this.game.bankroll);
    this.stats.lowBankroll = this.stats.lowBankroll === 0 ? this.game.bankroll : Math.min(this.stats.lowBankroll, this.game.bankroll);
    this.save();
  }

  nextRound() {
    return this.game.nextRound();
  }

  /** Puts the bankroll back to its starting amount. */
  resetBankroll() {
    this.game.bankroll = this.settings.get('table.startingBankroll');
    this.save();
  }

  resetStats() {
    this.stats = emptyStats();
    this.save();
  }

  /** Shuffles before the next round. */
  shuffleNow() {
    this.game.shoe.needsShuffle = true;
  }

  save() {
    this.app.storage.set(BANKROLL_KEY, this.game.bankroll);
    this.app.storage.set(STATS_KEY, this.stats);
  }

  /** Accuracy percentages for the stats screen. */
  accuracy() {
    const pct = (errors, total) => (total === 0 ? 100 : Math.round(100 * (1 - errors / total)));
    return {
      play: pct(this.stats.playErrors, this.stats.playDecisions),
      bet: pct(this.stats.betErrors, this.stats.betDecisions),
    };
  }

  get bankroll() {
    return this.game.bankroll;
  }

  get state() {
    return this.game.state;
  }
}
