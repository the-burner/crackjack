// The playing table.
//
// The session owns the rules, the shoe, the bankroll and the strategy checks;
// this screen owns the picture of the table and the pace of play. The engine
// finishes a round in one go and hands back a list of events, which the
// animator plays at the speeds the player chose. Input is refused for as long
// as a timeline is playing.

import { h } from '../../ui/dom.ts';
import { confirm } from '../../ui/dialogs.ts';
import { toast } from '../../ui/toast.ts';
import type { ToastOptions } from '../../ui/toast.ts';
import type { App, Screen } from '../../app/app.ts';
import { GameSession } from '../session.ts';
import { STATE } from '../engine/game.ts';
import type { GameAction } from '../engine/game.ts';
import { PLAYER } from '../engine/hand.ts';
import type { HandKey } from '../engine/hand.ts';
import type { GameEvent } from '../engine/events.ts';
import { TABLE_LIMITS } from '../../settings/schema.ts';
import { money, dollars } from '../../core/money.ts';
import { tableLayout, seatSlot } from '../table/layout.ts';
import type { TableLayout } from '../table/layout.ts';
import { createTableRenderer } from '../table/renderer.ts';
import { createTableState } from '../table/table-state.ts';
import { createShownCount } from '../table/shown-count.ts';
import { createChipLabels, placeBox } from '../table/labels.ts';
import { createTableControls, createTableBar } from '../table/controls.ts';
import { createSideBetPicker, sideBetLabel } from '../table/side-bet-picker.ts';
import { createAnimator, planSteps, pauseForSpeed } from '../table/animator.ts';
import type { Step } from '../table/animator.ts';
import { createBetOverlay } from '../table/bet-overlay.ts';
import type { BetCell } from '../table/bet-grid.ts';
import { attachSwipes } from '../table/gestures.ts';
import type { SwipeAction } from '../table/gestures.ts';
import { obviouslyBad, areYouSure } from '../table/bad-plays.ts';
import { dealerErrorsOn, enabledErrors, missedMessage } from '../dealer-errors.ts';
import { betError } from '../bet-validation.ts';
import { blackjackUnknown, withDealerError, createDealerErrorRound } from '../dealer-error-round.ts';

/** The insurance offer passes itself after this long. */
const INSURANCE_MS = 5000;

export function tableScreen(app: App): Screen {
  const { settings } = app;
  const session = new GameSession(app);
  const state = createTableState({ decks: session.table.decks });

  // --- DOM ------------------------------------------------------------------

  const canvas = h('canvas', { class: 'table__canvas' });
  const bankroll = h('div', { class: 'table__bankroll' });
  const counts = h('div', { class: 'table__counts' });
  const controls = createTableControls({ onAction: play, onInsurance: answerInsurance });

  const overlay = createBetOverlay({
    onBet: placeBet,
    onSideBet: () => sideBetPicker.choose(session.sideBetSpots()),
    sideBetsAvailable: () => session.sideBetSpots().length > 0,
    onNoSideBet: () => overlay.setMessage('No side bet is configured.'),
    onCustomize: () => app.open('settings.betting'),
    onShuffle: shuffleNow,
    onResetBank: resetBank,
    onFoul: claimDealerError,
    onLastError: openLastError,
  });

  const felt = h('div', { class: 'table__felt' }, canvas, bankroll, counts, controls.left, controls.right, overlay.el);
  const chips = createChipLabels(felt);
  const bar = createTableBar({
    onBack: () => app.back(),
    onStats: openStats,
    onError: openLastError,
    onHelp: () => app.help('game.table', 'Blackjack'),
  });
  const el = h('section', { class: 'table' }, bar, felt);

  // --- play state -----------------------------------------------------------

  const renderer = createTableRenderer(canvas);
  let layout: TableLayout | null = null;
  /** The bankroll before the last bet was placed, for the "you won" line. */
  let bankBeforeBet = session.bankroll;
  let previousBetLabel: string | null = null;
  const sideBetPicker = createSideBetPicker({
    app,
    chipValue: () => settings.get('betting.chipValue'),
    onChange: sideBets => overlay.setSideBet(sideBetLabel(sideBets)),
  });
  /** The dealer's mistakes: the one the player has not called yet. */
  const dealerErrors = createDealerErrorRound({ enabled: () => enabledErrors(settings) });
  /** True once the dealer has queried a bad play, which lets the next one through. */
  let warnedOfBadPlay = false;
  /** The error pop-up showing, if any. */
  let errorPopUp: HTMLElement | null = null;
  let insuranceTimer: number | undefined;
  let nextRoundTimer: number | null = null;
  /** Set while the next round's shuffle plays, so betting opens after it. */
  let openBettingWhenIdle = false;
  /** Hands whose payoff has been planned this round. */
  const swept = new Set<HandKey>();
  /** False once the screen has been closed, so late callbacks stop drawing. */
  let alive = true;
  /** Keeps the screen on while the table shows. */
  let releaseWakeLock: (() => void) | null = null;

  const animator = createAnimator({ onStep: applyStep, onIdle: whenIdle });

  /** The count as the player has seen it, which the readout shows. */
  const shown = createShownCount({
    strategy: session.strategy,
    settings: session.trueCountSettings(),
    decks: session.table.decks,
  });

  function pauses() {
    return {
      dealer: pauseForSpeed(settings.get('mechanics.dealerSpeed')),
      player: pauseForSpeed(settings.get('mechanics.otherPlayerSpeed')),
      payoff: pauseForSpeed(settings.get('mechanics.payoffSpeed')),
    };
  }

  const ownerOf = (key: HandKey) => session.game.hands.find(hand => hand.key === key)?.owner;
  const isComputer = (key: HandKey) => ownerOf(key) === PLAYER.computer;

  // --- rendering ------------------------------------------------------------

  function relayout() {
    if (!alive) return;
    const width = Math.max(200, Math.round(felt.clientWidth));
    const height = Math.max(200, Math.round(felt.clientHeight));
    layout = tableLayout({
      width,
      height,
      seatCount: session.table.seatCount,
      humanSeats: session.humanSeats(),
      decks: session.table.decks,
      showTray: !settings.get('display.hideDiscardTray'),
      showShoe: !settings.get('display.hideShoe'),
      noHoleCard: session.rules.noHoleCard,
    });
    renderer.resize(layout);
    // The absolutely positioned labels go where the layout says.
    placeBox(bankroll, layout.bankroll);
    placeBox(counts, { ...layout.status, y: layout.status.y + layout.status.height + 2 });
    chips.place(layout.seats);
    overlay.layout();
    render();
  }

  function render() {
    if (!layout) return;
    const shownLayout = layout;
    renderer.render({
      hands: state.hands.filter(hand => seatSlot(shownLayout, hand.seat)),
      dealer: state.dealer,
      pointerHand: state.pointerHand,
      burns: state.burns,
      trayCards: state.trayCards,
      shoeCards: state.shoeCards,
    });
    bankroll.textContent = dollars(state.bankroll);
    bankroll.classList.toggle('is-negative', state.bankroll < 0);
    chips.update(state.chips);
  }

  function countsText() {
    const parts: string[] = [];
    const accuracy = session.accuracy();
    if (settings.get('display.showBetAccuracy') && session.stats.betDecisions > 0) parts.push(`Bets: ${accuracy.bet}%`);
    if (settings.get('display.showPlayAccuracy') && session.stats.playDecisions > 0)
      parts.push(`Plays: ${accuracy.play}%`);
    if (settings.get('display.showRunningCount')) parts.push(`RC: ${round1(shown.running)}`);
    if (settings.get('display.showTrueCount')) parts.push(`TC: ${round1(shown.trueCount)}`);
    return parts.join(', ');
  }

  /** A passing message from the table. It does not cover an error pop-up that is still up. */
  function showMessage(text: string) {
    if (errorPopUp?.isConnected) return;
    toast(text.trim(), { position: 'top', ms: MESSAGE_MS });
  }

  /** An error, in the same drop-down pop-up as the drills. */
  function showError(text: string, tone: ToastOptions['tone'] = 'error') {
    errorPopUp = toast(text.trim(), { position: 'top', tone });
  }

  /** Shows the session's strategy and betting warnings as soon as they are made. */
  function showWarnings() {
    const warnings = session.takeWarnings();
    if (warnings.length) showError(warnings.join(' · '));
  }

  // --- the animation timeline ----------------------------------------------

  /** Applies an engine event and redraws. */
  function applyStep({ event, sound }: Step) {
    state.apply(event);
    shown.see(event, state.dealt);
    counts.textContent = countsText();
    if (sound) app.sound.play(sound);
    if (event.type === 'message') showMessage(event.text);
    if (event.type === 'offerInsurance') showMessage('Insurance?');
    render();
  }

  /** Queues the events an engine call produced. */
  function queue(events: GameEvent[]) {
    if (session.state === STATE.settled) events = injectDealerError(events);
    animator.play(planSteps(events, { pauses: pauses(), isComputer, swept, sweepNaturals: !upcardUnchecked() }));
    // A betting mistake shows while the cards are being dealt.
    showWarnings();
    updateControls();
  }

  function whenIdle() {
    warnedOfBadPlay = false;
    showWarnings();
    counts.textContent = countsText();
    updateControls();
    if (openBettingWhenIdle) {
      openBettingWhenIdle = false;
      beginBetting();
      return;
    }
    armTimers();
  }

  /** The insurance offer and the next round wait on timers, which run only while the table shows. */
  function armTimers() {
    if (session.state === STATE.insurance) startInsuranceTimer();
    if (session.state === STATE.settled && !nextRoundTimer) {
      nextRoundTimer = setTimeout(() => {
        nextRoundTimer = null;
        // The shoe is shuffled here, so the player sees it before betting.
        openBettingWhenIdle = true;
        queue(session.nextRound());
      }, pauses().payoff);
    }
  }

  // --- controls -------------------------------------------------------------

  function updateControls() {
    controls.update({
      hidden: settings.get('display.hideActionButtons'),
      busy: animator.busy,
      actions: session.availableActions(),
      insurance: session.state === STATE.insurance,
      canInsure: session.game.canInsure(),
    });
  }

  /** Every way in refuses while a timeline is playing, so input cannot race it. */
  const accepting = () => !animator.busy && !overlay.visible;

  function play(action: GameAction) {
    if (!accepting() || !session.availableActions()[action]) return;
    if (queryBadPlay(action)) return;
    queue(session.act(action));
  }

  /**
   * Asks "Are you sure?" before an obviously bad play and refuses it once. The
   * next such play goes through.
   */
  function queryBadPlay(action: GameAction) {
    if (!settings.get('mechanics.dealerPointsOutStupidPlays')) return false;
    const hand = session.game.activeHand;
    if (!hand || !obviouslyBad(action, hand.totals())) return false;
    warnedOfBadPlay = !warnedOfBadPlay;
    if (!warnedOfBadPlay) return false;
    app.sound.play('card');
    toast(areYouSure(action), { position: 'top', ms: MESSAGE_MS });
    return true;
  }

  function answerInsurance(take: boolean) {
    if (animator.busy || session.state !== STATE.insurance) return;
    stopInsuranceTimer();
    queue(take ? session.takeInsurance() : session.declineInsurance());
  }

  function startInsuranceTimer() {
    stopInsuranceTimer();
    insuranceTimer = setTimeout(() => answerInsurance(false), INSURANCE_MS);
  }

  function stopInsuranceTimer() {
    clearTimeout(insuranceTimer);
    insuranceTimer = undefined;
  }

  function onSwipe(action: SwipeAction) {
    if (overlay.visible || animator.busy) return;
    if (session.state === STATE.insurance) {
      if (action === 'insure') answerInsurance(true);
      if (action === 'pass') answerInsurance(false);
      return;
    }
    if (action === 'insure' || action === 'pass') return;
    if (!session.availableActions()[action]) {
      showError(`Cannot ${action}`);
      return;
    }
    play(action);
  }

  // --- betting --------------------------------------------------------------

  function beginBetting() {
    stopInsuranceTimer();
    overlay.show({
      ramp: settings.get('betting.ramp'),
      chipValue: settings.get('betting.chipValue'),
      previous: previousBetLabel,
      change: session.bankroll - bankBeforeBet,
      foul: dealerErrorsOn(settings),
    });
    updateControls();
    render();
  }

  function placeBet({ amount, hands, label }: BetCell) {
    // Asking for more hands than the player has seats quietly bets fewer.
    const seats = session.humanSeats().slice(0, hands);
    const error = betError({
      amount,
      hands: seats.length,
      limits: TABLE_LIMITS[settings.get('table.limits')],
      bankroll: session.bankroll,
      sideBets: sideBetPicker.pending,
      spots: session.sideBetSpots(),
    });
    if (error) {
      overlay.setMessage(error);
      return;
    }
    reportMissedError();
    previousBetLabel = label;
    bankBeforeBet = session.bankroll;
    overlay.hide();
    swept.clear();
    const sideBets = sideBetPicker.take();
    const sideBetTotal = Object.values(sideBets).reduce((sum, staked) => sum + staked, 0);
    state.setBets(seats.map(seat => ({ seat, amount, sideBet: sideBetTotal })));
    state.setBankroll(bankBeforeBet - (amount + sideBetTotal) * seats.length);
    overlay.setSideBet('');
    queue(session.startRound({ betPerHand: amount, hands, sideBets }));
  }

  function shuffleNow() {
    // Played out like any shuffle: the burn is shown, then goes into the tray.
    queue(session.shuffleNow());
    overlay.setMessage('Shuffled.');
  }

  async function resetBank() {
    if (!(await confirm('Reset the bankroll to its starting amount?'))) return;
    session.resetBankroll();
    bankBeforeBet = session.bankroll;
    state.setBankroll(session.bankroll);
    overlay.setMessage(`Bankroll reset to ${money(session.bankroll)}.`);
    render();
  }

  // --- dealer errors --------------------------------------------------------

  // The dealer may wrongly stand on a hard 16; the engine asks before each draw.
  session.beforeDealerDraw = dealer => dealerErrors.dealerDraws(dealer, session.game.humanHands());
  // The dealer may call a good hand a bust as soon as the card lands.
  session.onGoodHandBusted = hand => dealerErrors.bustsGoodHand(hand, session.game.dealer.total);

  /** Lets the dealer make one of the mistakes the player enabled; returns the events as the player sees them. */
  function injectDealerError(events: GameEvent[]): GameEvent[] {
    const error = dealerErrors.settle({
      events,
      humanHands: session.game.humanHands(),
      dealer: session.game.dealer,
      dealerBlackjack: Boolean(session.game.dealerBlackjack),
      rules: session.game.rules,
    });
    if (!error) return events;
    if (!error.alreadyPaid) session.adjustBankroll(-error.amount);
    return withDealerError(events, error, session.game.bankroll);
  }

  /** True when a blackjack could still be under an ace or ten the dealer never checked. */
  const upcardUnchecked = () => blackjackUnknown(session.game.rules, session.game.dealer.cards[0]);

  function claimDealerError() {
    const { caught, refund, message, tone } = dealerErrors.claim();
    if (caught) {
      session.adjustBankroll(refund);
      session.recordFoulCaught();
      state.setBankroll(session.bankroll);
      render();
      app.sound.play('card');
    } else {
      session.recordFalseFoul();
      app.sound.play('error');
    }
    overlay.setMessage(message.trim());
    showError(message, tone === 'good' ? 'good' : 'error');
  }

  function reportMissedError() {
    const missed = dealerErrors.takeMissed();
    if (!missed) return;
    session.recordMissedDealerError();
    showError(missedMessage(missed));
  }

  // --- other screens --------------------------------------------------------

  function openStats() {
    if (animator.busy) return;
    app.open('game.stats', { session });
  }

  function openLastError() {
    if (animator.busy) return;
    const error = session.lastError;
    if (!error || !error.table) {
      showError('No play errors yet', 'plain');
      return;
    }
    app.open('strategy.tables', {
      title: 'Last Error',
      view: error.table,
      highlight: { row: error.row, column: error.column },
      decks: session.table.decks,
    });
  }

  // --- leaving --------------------------------------------------------------

  /**
   * Chips on the table belong to the player: hand them back rather than
   * abandoning the round with them.
   */
  function refundOpenBets() {
    if (session.state === STATE.betting || session.state === STATE.settled) return;
    const staked = session.game.humanHands().reduce((sum, hand) => sum + hand.wagered, 0);
    if (staked <= 0) return;
    session.adjustBankroll(staked);
  }

  // --- wiring ---------------------------------------------------------------

  const detachSwipes = attachSwipes(felt, onSwipe, { insurance: () => session.state === STATE.insurance });
  const observer = new ResizeObserver(() => relayout());

  return {
    el,

    onShow() {
      releaseWakeLock ??= app.wakeLock.hold();
      observer.observe(felt);
      renderer.whenReady().then(() => {
        relayout();
      });
      relayout();
      // Customize may have changed the ramp or the chip value behind the overlay.
      if (overlay.visible)
        overlay.setSource({ ramp: settings.get('betting.ramp'), chipValue: settings.get('betting.chipValue') });
      else if (!animator.busy) armTimers();
      if (!overlay.visible && session.state === STATE.betting) {
        state.setBankroll(session.bankroll);
        counts.textContent = countsText();
        // The shoe's shuffle and burn play out before betting opens, once the
        // felt, cards and pointer can be drawn, so nothing appears half-made.
        openBettingWhenIdle = true;
        renderer.whenReady().then(() => {
          if (alive) queue(session.game.takeEvents());
        });
      }
    },

    onHide() {
      releaseWakeLock?.();
      releaseWakeLock = null;
      observer.disconnect();
      stopInsuranceTimer();
      clearTimeout(nextRoundTimer ?? undefined);
      nextRoundTimer = null;
    },

    destroy() {
      alive = false;
      observer.disconnect();
      detachSwipes();
      animator.cancel();
      clearTimeout(nextRoundTimer ?? undefined);
      stopInsuranceTimer();
      refundOpenBets();
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** How long a table message stays up, as the original's bar did. */
const MESSAGE_MS = 3500;
