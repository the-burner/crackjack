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
import { createAnimator, pauseForSpeed, RESULT_TONES } from './animator';
import { planSteps } from './choreography';
import type { Step } from './animator';
import { betCells, moveHighlight, overlayButtons, overlaySlots, startingHighlight } from './bet-grid';
import type { LastPick, OverlayButtonName } from './bet-grid';
import type { BetCell } from './bet-grid';
import { attachGestures } from './gestures';
import { attachGestureKeys } from '@/lib/gesture-keys';
import { gestureMapFor } from '@/settings/gesture-configs';
import type { Gesture, GestureAction } from '@/core/gestures';
import { obviouslyBad, areYouSure } from './bad-plays';
import { dealerErrorsOn, enabledErrors, missedMessage } from '@/game/dealer-errors';
import { betError } from '@/game/bet-validation';
import { blackjackUnknown, withDealerError, createDealerErrorRound } from '@/game/dealer-error-round';
import type { TablesParams } from '@/screens/strategy/tables';

/** How long a table message stays up, as the original's bar did. */
const MESSAGE_MS = 3500;
/** How long an error stays up. */
const ERROR_MS = 1800;

export type ToastTone = 'plain' | 'good' | 'error';

/** Shows a pop-up, returning its id; `onGone` runs once it has gone or been replaced. */
export type Notify = (text: string, options: { tone: ToastTone; ms: number | null; onGone: () => void }) => number;

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
  /** The highlighted bet: the last one placed at first; swipes left and right move it, a double tap places it. */
  selected: number;
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

type TableSession = ReturnType<typeof createTableSession>;
export type TableController = ReturnType<typeof createTableController>;

/** Where the table's buttons lead; the screen supplies them from the router. */
export type TableNav = {
  stats(): void;
  lastError(params: TablesParams): void;
  customize(): void;
  /** The side-bet picker for spot `index`, replacing the one showing when `replace`. */
  sideBet(index: number, replace: boolean): void;
  back(): void;
  /** The app's settings, leaving the table as Back does. */
  settings(): void;
  help(): void;
};

type TableOptions = {
  notify: Notify;
  /** Takes a pop-up down before its time. */
  dismiss: (id: number) => void;
  confirm: (message: string) => Promise<boolean>;
  nav: TableNav;
};

/**
 * The table, built the first time it takes over its felt rather than when the
 * screen renders: a new session shuffles its shoe, which must happen once
 * however often React renders (StrictMode renders twice). Until then the
 * snapshot is null.
 */
export function createTableController(app: App, options: TableOptions) {
  let table: TableSession | null = null;
  /** Listeners that subscribed before the table was built. */
  const waiting = new Set<() => void>();
  const live = (): TableSession => {
    if (!table) throw new Error('The table has no felt yet');
    return table;
  };
  return {
    subscribe(listener: () => void) {
      if (table) return table.subscribe(listener);
      waiting.add(listener);
      return () => waiting.delete(listener);
    },
    getSnapshot: (): TableSnapshot | null => table?.getSnapshot() ?? null,
    /** Takes over the felt; again after destroy() too, as StrictMode remounts. */
    attach(felt: HTMLElement, canvas: HTMLCanvasElement) {
      if (!table) {
        table = createTableSession(app, options);
        for (const listener of waiting) table.subscribe(listener);
        waiting.clear();
      }
      table.attach(felt, canvas);
    },
    get session() {
      return live().session;
    },
    play: (...args: Parameters<TableSession['play']>) => live().play(...args),
    answerInsurance: (...args: Parameters<TableSession['answerInsurance']>) => live().answerInsurance(...args),
    placeBet: (...args: Parameters<TableSession['placeBet']>) => live().placeBet(...args),
    chooseSideBet: () => live().chooseSideBet(),
    wong: () => live().wongRound(),
    shuffleNow: () => live().shuffleNow(),
    resetBank: () => live().resetBank(),
    claimDealerError: () => live().claimDealerError(),
    openStats: () => live().openStats(),
    openLastError: () => live().openLastError(),
    customize: options.nav.customize,
    back: options.nav.back,
    settings: options.nav.settings,
    help: options.nav.help,
    sideBetParams: (index: number) => live().sideBetParams(index),
    open: () => table?.open() ?? (() => {}),
    onShow: () => table?.onShow(),
    onHide: () => table?.onHide(),
    destroy: () => table?.destroy(),
  };
}

function createTableSession(app: App, { notify, dismiss, confirm, nav }: TableOptions) {
  const { settings } = app;
  const session = new GameSession(app);
  const state = createTableState({ decks: session.table.decks });

  let felt: HTMLElement | null = null;
  let renderer: ReturnType<typeof createTableRenderer> | null = null;
  let rendererCanvas: HTMLCanvasElement | null = null;
  let detachSwipes = () => {};
  let layout: TableLayout | null = null;
  /** The bankroll before the last bet was placed, for the "you won" line. */
  let bankBeforeBet = session.bankroll;
  let lastPick: LastPick = null;
  /** The dealer's mistakes: the one the player has not called yet. */
  const dealerErrors = createDealerErrorRound({ enabled: () => enabledErrors(settings) });
  /** True once the dealer has queried a bad play, which lets the next one through. */
  let warnedOfBadPlay = false;
  /** True while an error pop-up is up, which a passing message does not cover. */
  let errorShowing = false;
  /** Counts pop-ups, so a replaced one's going does not clear the next one's state. */
  let toastCount = 0;
  /** The "Insurance?" pop-up, while the question is open. */
  let insuranceToast: number | null = null;
  /** True while the table is on screen. */
  let showing = false;
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
    source: betSource(),
    cells: [] as BetCell[],
    /** The highlighted bet, which the gestures move and place. */
    selected: 0,
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
        selected: overlay.selected,
        foul: overlay.foul,
      },
    };
  }

  function emit() {
    snapshot = buildSnapshot();
    for (const listener of listeners) listener();
  }

  const sideBetPicker = createSideBetPicker({
    open: nav.sideBet,
    chipValue: () => settings.get('game.betting.chipValue'),
    onChange: sideBets => setSideBet(sideBetLabel(sideBets)),
  });

  const animator = createAnimator({ onStep: applyStep, onIdle: whenIdle });

  /** The count as the player has seen it, which the readout shows. */
  const shown = createShownCount({
    strategy: session.strategy,
    settings: session.trueCountSettings(),
    decks: session.table.decks,
  });

  /** The cards gone as the player has seen them, by Remaining Cards. */
  const shownCardsGone = () => state.cardsGone(settings.get('game.trueCount.remainingCards'));

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
    // The canvas fills the felt element's parent (the window); the layout sits where the felt element is.
    const room = rendererCanvas?.parentElement;
    renderer.resize(
      layout,
      room ? { width: room.clientWidth, height: room.clientHeight, x: felt.offsetLeft, y: felt.offsetTop } : undefined,
    );
    render();
  }

  function render() {
    if (!layout || !renderer) return;
    const shownLayout = layout;
    renderer.render({
      hands: state.hands.filter(hand => seatSlot(shownLayout, hand.seat)),
      dealer: state.dealer,
      pointerHand: state.pointerHand,
      seatOrder: state.seatOrder,
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
    if (settings.get('display.showTrueCount'))
      parts.push(`TC: ${round1(shown.trueCountAt(shownCardsGone(), session.trueCountSettings()))}`);
    return parts.join(', ');
  }

  function updateReadout() {
    countsText = readout();
    emit();
  }

  /** Shows a pop-up in place of the one up, if any; `ms` null keeps it up until dismissed. */
  function popUp(text: string, tone: ToastTone, ms: number | null, error: boolean, gone?: () => void): number {
    const count = ++toastCount;
    errorShowing = error;
    return notify(text.trim(), {
      tone,
      ms,
      onGone: () => {
        if (count === toastCount) {
          errorShowing = false;
          // A pop-up that replaced the open question has gone: ask it again.
          if (insuranceToast === null && asking()) askInsurance();
        }
        gone?.();
      },
    });
  }

  /** A passing message from the table. It does not cover an error pop-up that is still up. */
  function showMessage(text: string): number | null {
    if (errorShowing) return null;
    return popUp(text, 'plain', MESSAGE_MS, false);
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
    shown.see(event, shownCardsGone());
    countsText = readout();
    if (sound) app.sound.play(sound);
    if (event.type === 'message') showMessage(event.text);
    if (event.type === 'offerInsurance' && showing) askInsurance();
    render();
  }

  /** Queues the events an engine call produced. */
  function queue(events: GameEvent[]) {
    // A round sat out has none of the player's money for the dealer to get wrong.
    if (session.state === STATE.settled && !session.satOut) events = injectDealerError(events);
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
    armNextRound();
  }

  /** The next round waits on a timer, which runs only while the table shows. */
  function armNextRound() {
    if (session.state === STATE.settled && !nextRoundTimer) {
      nextRoundTimer = window.setTimeout(() => {
        nextRoundTimer = null;
        // The shoe is shuffled here, so the player sees it before betting.
        openBettingWhenIdle = true;
        queue(session.nextRound());
        // No wait of its own: the last hand's sweep already held a payoff beat, so the dealer's cards
        // go as long after it as each hand went after the one before.
      }, 0);
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

  /** True while the insurance question waits on the player at the table on screen. */
  const asking = () => showing && session.state === STATE.insurance && !animator.busy;

  /** "Insurance?" stays up until it is answered. */
  function askInsurance() {
    const id = popUp('Insurance?', 'plain', null, false, () => {
      if (insuranceToast === id) insuranceToast = null;
    });
    insuranceToast = id;
  }

  function dismissInsurance() {
    if (insuranceToast !== null) dismiss(insuranceToast);
    insuranceToast = null;
  }

  function answerInsurance(take: boolean) {
    if (animator.busy || session.state !== STATE.insurance) return;
    dismissInsurance();
    queue(take ? session.takeInsurance() : session.declineInsurance());
  }

  /** A gesture, as the player's mapping for how the screen is held plays it. */
  function onGesture(gesture: Gesture) {
    if (animator.busy) return;
    const action = gestureMapFor(k => settings.get(k), window.innerHeight > window.innerWidth)[gesture];
    if (overlay.visible) {
      betBySwipe(action);
      return;
    }
    // Hit's and Double's gestures take insurance, Stand's and Split's decline it.
    if (session.state === STATE.insurance) {
      if (action === 'hit' || action === 'double') answerInsurance(true);
      if (action === 'stand' || action === 'split') answerInsurance(false);
      return;
    }
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

  /** The bets the overlay offers, from the settings as they are now. */
  function betSource(): BetSource {
    return {
      ramp: settings.get('game.betting.ramp'),
      chipValue: settings.get('game.betting.chipValue'),
    };
  }

  function setBetSource(source: BetSource) {
    overlay.source = source;
    overlay.cells = betCells(source);
    const options = overlay.cells.length + overlayButtons(overlay.foul).length;
    overlay.selected = Math.min(overlay.selected, Math.max(0, options - 1));
  }

  /** Betting: the plays' gestures move the highlight over the bets and buttons (BET_DIRECTIONS); Surrender's picks it. */
  function betBySwipe(action: GestureAction) {
    const buttons = overlayButtons(overlay.foul);
    const count = overlay.cells.length + buttons.length;
    if (count === 0) return;
    if (action === 'surrender') {
      const { selected } = overlay;
      if (selected < overlay.cells.length) placeBet(overlay.cells[selected]);
      else void pressButton(buttons[selected - overlay.cells.length]);
      return;
    }
    const direction = BET_DIRECTIONS[action];
    if (!direction) return;
    overlay.selected = moveHighlight(overlay.selected, overlaySlots(overlay.cells.length, buttons.length), direction);
    emit();
  }

  /** What a betting panel button does when a gesture presses it. */
  function pressButton(name: OverlayButtonName) {
    const press: Record<OverlayButtonName, () => unknown> = {
      wong: wongRound,
      resetBank,
      shuffle: shuffleNow,
      sideBet: chooseSideBet,
      customize: nav.customize,
      foul: claimDealerError,
    };
    return press[name]();
  }

  function beginBetting() {
    session.startBetting();
    setBetSource(betSource());
    const change = session.bankroll - bankBeforeBet;
    overlay.foul = dealerErrorsOn(settings);
    overlay.selected = startingHighlight(overlay.cells, overlay.foul, lastPick);
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
    lastPick = { bet: label };
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

  /** Sits the round out, unless the player would be alone at the table. */
  function wongRound() {
    if (!overlay.visible) return;
    if (session.soloNextRound()) {
      showError('In solo play you must play every hand.');
      return;
    }
    reportMissedError();
    lastPick = 'wong';
    bankBeforeBet = session.bankroll;
    overlay.visible = false;
    swept.clear();
    state.setBets([]);
    queue(session.wong());
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
    nav.stats();
  }

  function openLastError() {
    if (animator.busy) return;
    const error = session.lastError;
    if (!error || !error.table) {
      showError('No play errors yet', 'plain');
      return;
    }
    nav.lastError({
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

  /** The opening shuffle and burn waiting for the table to be drawable, if any. */
  let opening: { cancelled: boolean } | null = null;
  function cancelOpening() {
    if (!opening) return;
    opening.cancelled = true;
    opening = null;
    openBettingWhenIdle = false;
  }

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
    /** Takes over the felt; again after destroy() too, as React's StrictMode remounts. */
    attach(feltEl: HTMLElement, canvas: HTMLCanvasElement) {
      alive = true;
      felt = feltEl;
      // The same canvas keeps its renderer, and the images it has loaded.
      if (canvas !== rendererCanvas) {
        renderer = createTableRenderer(canvas);
        rendererCanvas = canvas;
      }
      const detachPointer = attachGestures(feltEl, onGesture);
      // Keys reach the window: only the table on screen hears them.
      const detachKeys = attachGestureKeys(
        () => settings.get('gestures.keys'),
        gesture => {
          if (showing) onGesture(gesture);
        },
      );
      detachSwipes = () => {
        detachPointer();
        detachKeys();
      };
    },

    play,
    answerInsurance,
    placeBet,
    wongRound,
    chooseSideBet,
    shuffleNow,
    resetBank,
    claimDealerError,
    openStats,
    openLastError,
    customize: nav.customize,
    back: nav.back,
    settings: nav.settings,
    help: nav.help,
    /** What the side-bet picker for spot `index` shows. */
    sideBetParams: (index: number) => sideBetPicker.paramsFor(index),

    onShow() {
      if (!felt || !renderer) return;
      const ready = renderer.whenReady();
      releaseWakeLock ??= app.wakeLock.hold();
      observer.observe(felt);
      ready.then(() => relayout());
      relayout();
      // Customize may have changed the ramp or the chip value behind the overlay.
      if (overlay.visible) {
        setBetSource(betSource());
        emit();
      } else if (!animator.busy) armNextRound();
      showing = true;
      if (insuranceToast === null && asking()) askInsurance();
    },

    /**
     * Plays the new shoe's shuffle and burn, then opens betting, once the felt,
     * cards and pointer can be drawn, so nothing appears half-made. Returns a
     * function calling it off (before it starts), for an effect's cleanup.
     */
    open(): () => void {
      if (!renderer || overlay.visible || session.state !== STATE.betting || opening) return () => {};
      state.setBankroll(session.bankroll);
      updateReadout();
      const token = { cancelled: false };
      opening = token;
      openBettingWhenIdle = true;
      renderer.whenReady().then(() => {
        if (token.cancelled || !alive) return;
        opening = null;
        queue(session.game.takeEvents());
      });
      return () => {
        if (opening === token) cancelOpening();
      };
    },

    onHide() {
      showing = false;
      releaseWakeLock?.();
      releaseWakeLock = null;
      observer.disconnect();
      clearTimeout(nextRoundTimer ?? undefined);
      nextRoundTimer = null;
      // Not over the screen shown instead; asked again on return.
      dismissInsurance();
    },

    destroy() {
      cancelOpening();
      alive = false;
      showing = false;
      releaseWakeLock?.();
      releaseWakeLock = null;
      observer.disconnect();
      detachSwipes();
      animator.cancel();
      clearTimeout(nextRoundTimer ?? undefined);
      nextRoundTimer = null;
      dismissInsurance();
      refundOpenBets();
      listeners.clear();
    },
  };
}

/** The way each play's gesture moves the bet highlight. */
const BET_DIRECTIONS: Partial<Record<GestureAction, Parameters<typeof moveHighlight>[2]>> = {
  stand: 'left',
  split: 'right',
  double: 'up',
  hit: 'down',
};

/** Where the tiles come from: a betting.ramp value and the chip value. */
interface BetSource {
  ramp: Ramp;
  chipValue: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
