// The play at the table, for the table screen to show.
//
// The session owns the rules, the shoe, the bankroll and the strategy checks;
// this owns the picture of the table and the pace of play. The engine finishes
// a round in one go and hands back a list of events, which the animator plays
// at the speeds the player chose. Input is refused for as long as a timeline is
// playing. The screen reads a snapshot (subscribe/getSnapshot) and calls the
// methods; the felt itself is drawn here, into the canvas it attaches.

import type { App } from '@/app/app';
import { GameSession } from '@/game/session';
import { STATE } from '@/game/engine/game';
import type { AvailableActions, GameAction } from '@/game/engine/game';
import { PLAYER } from '@/game/engine/hand';
import type { HandKey } from '@/game/engine/hand';
import type { GameEvent } from '@/game/engine/events';
import type { Result } from '@/game/engine/settlement';
import { TABLE_LIMITS } from '@/settings/schema';
import type { Ramp } from '@/settings/bet-ramp';
import { money } from '@/core/money';
import { tableLayout, seatSlot } from './layout';
import type { Box, TableLayout } from './layout';
import { createTableRenderer } from './renderer';
import { createTableState } from './table-state';
import { createShownCount } from './shown-count';
import { chipText } from './labels';
import { createSideBetPicker, sideBetLabel } from './side-bet-picker';
import { createAnimator, planSteps, pauseForSpeed, RESULT_TONES } from './animator';
import type { Step } from './animator';
import { betCells } from './bet-grid';
import type { BetCell } from './bet-grid';
import { attachSwipes } from './gestures';
import type { SwipeAction } from './gestures';
import { obviouslyBad, areYouSure } from './bad-plays';
import { dealerErrorsOn, enabledErrors, missedMessage } from '@/game/dealer-errors';
import { betError } from '@/game/bet-validation';
import { blackjackUnknown, withDealerError, createDealerErrorRound } from '@/game/dealer-error-round';

/** The insurance offer passes itself after this long. */
const INSURANCE_MS = 5000;
/** How long a table message stays up, as the original's bar did. */
const MESSAGE_MS = 3500;
/** How long an error stays up. */
const ERROR_MS = 1800;

export type ToastTone = 'plain' | 'good' | 'error';

/** Shows a pop-up; `onGone` runs once it has gone or been replaced. */
export type Notify = (text: string, options: { tone: ToastTone; ms: number; onGone: () => void }) => void;

/** What one seat's chip label shows. */
export interface SeatLabel {
  seat: number;
  box: Box;
  text: string;
  result: Result | null;
  tone: 'win' | 'lose' | 'push';
}

export interface ControlsView {
  /** The player plays by gesture (`display.hideActionButtons`). */
  hidden: boolean;
  /** A timeline is playing. */
  busy: boolean;
  actions: AvailableActions;
  /** The insurance offer is up. */
  insurance: boolean;
  canInsure: boolean;
}

export interface BetOverlayView {
  visible: boolean;
  title: string;
  cells: BetCell[];
  /** Label of the last bet, highlighted. */
  previous: string | null;
  /** Whether a Foul claim is possible. */
  foul: boolean;
}

export interface TableSnapshot {
  layout: TableLayout | null;
  bankroll: number;
  counts: string;
  seats: SeatLabel[];
  controls: ControlsView;
  overlay: BetOverlayView;
}

export type TableController = ReturnType<typeof createTableController>;

export function createTableController(
  app: App,
  { notify, confirm }: { notify: Notify; confirm: (message: string) => Promise<boolean> },
) {
  const { settings } = app;
  const session = new GameSession(app);
  const state = createTableState({ decks: session.table.decks });

  let felt: HTMLElement | null = null;
  let renderer: ReturnType<typeof createTableRenderer> | null = null;
  let detachSwipes = () => {};
  let layout: TableLayout | null = null;
  /** The bankroll before the last bet was placed, for the "you won" line. */
  let bankBeforeBet = session.bankroll;
  let previousBetLabel: string | null = null;
  /** The dealer's mistakes: the one the player has not called yet. */
  const dealerErrors = createDealerErrorRound({ enabled: () => enabledErrors(settings) });
  /** True once the dealer has queried a bad play, which lets the next one through. */
  let warnedOfBadPlay = false;
  /** True while an error pop-up is up, which a passing message does not cover. */
  let errorShowing = false;
  /** Counts pop-ups, so a replaced one's going does not clear the next one's state. */
  let toastCount = 0;
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

  // What the screen shows, as last drawn.
  let shownBankroll = state.bankroll;
  let countsText = '';
  let seatLabels: SeatLabel[] = [];
  let controls: ControlsView = {
    hidden: settings.get('display.hideActionButtons'),
    busy: false,
    actions: session.availableActions(),
    insurance: false,
    canInsure: false,
  };
  const overlay = {
    visible: false,
    source: { ramp: settings.get('betting.ramp'), chipValue: settings.get('betting.chipValue') } as BetSource,
    cells: [] as BetCell[],
    previous: null as string | null,
    heading: 'Place your bets.',
    foul: false,
    /** Label of the side bet chosen for the next round, if any. */
    sideBet: '',
    /** A one-off message shown instead of the heading. */
    message: '',
  };

  const listeners = new Set<() => void>();
  let snapshot = buildSnapshot();

  function buildSnapshot(): TableSnapshot {
    return {
      layout,
      bankroll: shownBankroll,
      counts: countsText,
      seats: seatLabels,
      controls,
      overlay: {
        visible: overlay.visible,
        title: overlayTitle(),
        cells: overlay.cells,
        previous: overlay.previous,
        foul: overlay.foul,
      },
    };
  }

  function emit() {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  const sideBetPicker = createSideBetPicker({
    app,
    chipValue: () => settings.get('betting.chipValue'),
    onChange: sideBets => setSideBet(sideBetLabel(sideBets)),
  });

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
    if (!alive || !felt || !renderer) return;
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
    render();
  }

  function render() {
    if (!layout || !renderer) return;
    const shownLayout = layout;
    renderer.render({
      hands: state.hands.filter(hand => seatSlot(shownLayout, hand.seat)),
      dealer: state.dealer,
      pointerHand: state.pointerHand,
      burns: state.burns,
      trayCards: state.trayCards,
      shoeCards: state.shoeCards,
    });
    shownBankroll = state.bankroll;
    seatLabels = shownLayout.seats.map(({ seat, chip }): SeatLabel => {
      const held = state.chips.get(seat);
      const result = held?.result ?? null;
      return {
        seat,
        box: chip,
        text: held && !result ? chipText(held) : '',
        result,
        tone: (result && RESULT_TONES[result]) ?? 'push',
      };
    });
    emit();
  }

  function readout() {
    const parts: string[] = [];
    const accuracy = session.accuracy();
    if (settings.get('display.showBetAccuracy') && session.stats.betDecisions > 0) parts.push(`Bets: ${accuracy.bet}%`);
    if (settings.get('display.showPlayAccuracy') && session.stats.playDecisions > 0)
      parts.push(`Plays: ${accuracy.play}%`);
    if (settings.get('display.showRunningCount')) parts.push(`RC: ${round1(shown.running)}`);
    if (settings.get('display.showTrueCount')) parts.push(`TC: ${round1(shown.trueCount)}`);
    return parts.join(', ');
  }

  function updateReadout() {
    countsText = readout();
    emit();
  }

  /** Shows a pop-up in place of the one up, if any. */
  function popUp(text: string, tone: ToastTone, ms: number, error: boolean) {
    const count = ++toastCount;
    errorShowing = error;
    notify(text.trim(), {
      tone,
      ms,
      onGone: () => {
        if (count === toastCount) errorShowing = false;
      },
    });
  }

  /** A passing message from the table. It does not cover an error pop-up that is still up. */
  function showMessage(text: string) {
    if (errorShowing) return;
    popUp(text, 'plain', MESSAGE_MS, false);
  }

  /** An error, in the same drop-down pop-up as the drills. */
  function showError(text: string, tone: ToastTone = 'error') {
    popUp(text, tone, ERROR_MS, true);
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
    countsText = readout();
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
    countsText = readout();
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
      nextRoundTimer = window.setTimeout(() => {
        nextRoundTimer = null;
        // The shoe is shuffled here, so the player sees it before betting.
        openBettingWhenIdle = true;
        queue(session.nextRound());
      }, pauses().payoff);
    }
  }

  // --- controls -------------------------------------------------------------

  function updateControls() {
    controls = {
      hidden: settings.get('display.hideActionButtons'),
      busy: animator.busy,
      actions: session.availableActions(),
      insurance: session.state === STATE.insurance,
      canInsure: session.game.canInsure(),
    };
    emit();
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
    popUp(areYouSure(action), 'plain', MESSAGE_MS, false);
    return true;
  }

  function answerInsurance(take: boolean) {
    if (animator.busy || session.state !== STATE.insurance) return;
    stopInsuranceTimer();
    queue(take ? session.takeInsurance() : session.declineInsurance());
  }

  function startInsuranceTimer() {
    stopInsuranceTimer();
    insuranceTimer = window.setTimeout(() => answerInsurance(false), INSURANCE_MS);
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

  function overlayTitle() {
    if (overlay.message) return overlay.message;
    return overlay.sideBet ? `${overlay.heading} · ${overlay.sideBet}` : overlay.heading;
  }

  function setOverlayMessage(text: string) {
    overlay.message = text;
    emit();
  }

  /** Notes the side bet waiting for the next round, so redraws keep showing it. */
  function setSideBet(label: string) {
    overlay.sideBet = label;
    overlay.message = '';
    emit();
  }

  function setBetSource(source: BetSource) {
    overlay.source = source;
    overlay.cells = betCells(source);
  }

  function beginBetting() {
    stopInsuranceTimer();
    setBetSource({ ramp: settings.get('betting.ramp'), chipValue: settings.get('betting.chipValue') });
    const change = session.bankroll - bankBeforeBet;
    overlay.previous = previousBetLabel;
    overlay.foul = dealerErrorsOn(settings);
    overlay.heading = 'Place your bets.';
    if (change > 0) overlay.heading += ` You won ${money(change)}`;
    if (change < 0) overlay.heading += ` You lost ${money(-change)}`;
    overlay.message = '';
    overlay.visible = true;
    updateControls();
    render();
  }

  function placeBet({ amount, hands, label }: BetCell) {
    if (!overlay.visible) return;
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
      setOverlayMessage(error);
      return;
    }
    reportMissedError();
    previousBetLabel = label;
    bankBeforeBet = session.bankroll;
    overlay.visible = false;
    swept.clear();
    const sideBets = sideBetPicker.take();
    const sideBetTotal = Object.values(sideBets).reduce((sum, staked) => sum + staked, 0);
    state.setBets(seats.map(seat => ({ seat, amount, sideBet: sideBetTotal })));
    state.setBankroll(bankBeforeBet - (amount + sideBetTotal) * seats.length);
    setSideBet('');
    queue(session.startRound({ betPerHand: amount, hands, sideBets }));
  }

  function chooseSideBet() {
    if (session.sideBetSpots().length === 0) {
      setOverlayMessage('No side bet is configured.');
      return;
    }
    sideBetPicker.choose(session.sideBetSpots());
  }

  function shuffleNow() {
    // Played out like any shuffle: the burn is shown, then goes into the tray.
    queue(session.shuffleNow());
    setOverlayMessage('Shuffled.');
  }

  async function resetBank() {
    if (!(await confirm('Reset the bankroll to its starting amount?'))) return;
    session.resetBankroll();
    bankBeforeBet = session.bankroll;
    state.setBankroll(session.bankroll);
    overlay.message = `Bankroll reset to ${money(session.bankroll)}.`;
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
    setOverlayMessage(message.trim());
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

  const observer = new ResizeObserver(() => relayout());

  return {
    session,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: (): TableSnapshot => snapshot,

    /** Gives the table its felt (for size and gestures) and the canvas to draw on. */
    attach(feltEl: HTMLElement, canvas: HTMLCanvasElement) {
      felt = feltEl;
      renderer = createTableRenderer(canvas);
      detachSwipes = attachSwipes(feltEl, onSwipe, { insurance: () => session.state === STATE.insurance });
    },

    play,
    answerInsurance,
    placeBet,
    chooseSideBet,
    shuffleNow,
    resetBank,
    claimDealerError,
    openStats,
    openLastError,
    customize: () => app.open('settings.betting'),
    back: () => app.back(),
    help: () => app.help('game.table', 'Blackjack'),

    onShow() {
      if (!felt || !renderer) return;
      const ready = renderer.whenReady();
      releaseWakeLock ??= app.wakeLock.hold();
      observer.observe(felt);
      ready.then(() => relayout());
      relayout();
      // Customize may have changed the ramp or the chip value behind the overlay.
      if (overlay.visible) {
        setBetSource({ ramp: settings.get('betting.ramp'), chipValue: settings.get('betting.chipValue') });
        emit();
      } else if (!animator.busy) armTimers();
      if (!overlay.visible && session.state === STATE.betting) {
        state.setBankroll(session.bankroll);
        updateReadout();
        // The shoe's shuffle and burn play out before betting opens, once the
        // felt, cards and pointer can be drawn, so nothing appears half-made.
        openBettingWhenIdle = true;
        ready.then(() => {
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
      releaseWakeLock?.();
      releaseWakeLock = null;
      observer.disconnect();
      detachSwipes();
      animator.cancel();
      clearTimeout(nextRoundTimer ?? undefined);
      nextRoundTimer = null;
      stopInsuranceTimer();
      refundOpenBets();
      listeners.clear();
    },
  };
}

/** Where the tiles come from: a betting.ramp value and the chip value. */
interface BetSource {
  ramp: Ramp;
  chipValue: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
