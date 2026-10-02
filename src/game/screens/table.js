// The playing table (the original's frmTable).
//
// The session owns the rules, the shoe, the bankroll and the strategy checks;
// this screen owns the picture of the table and the pace of play. The engine
// finishes a round in one go and hands back a list of events, which the
// animator plays at the speeds the player chose. Input is refused for as long
// as a timeline is playing.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { alert, confirm } from '../../ui/dialogs.js';
import { GameSession } from '../session.js';
import { STATE, ACTION } from '../engine/game.js';
import { PLAYER } from '../engine/hand.js';
import { TABLE_LIMITS } from '../../settings/schema.js';
import { tableLayout, seatSlot } from '../table/layout.js';
import { createTableRenderer } from '../table/renderer.js';
import { createTableState } from '../table/table-state.js';
import { createAnimator, planSteps, pauseForSpeed } from '../table/animator.js';
import { createBetOverlay } from '../table/bet-overlay.js';
import { attachSwipes } from '../table/gestures.js';
import { obviouslyBad, areYouSure } from '../table/bad-plays.js';
import { dealerErrorsOn, enabledErrors, pickDealerError, claimFoul, missedMessage, errorHandFrom } from '../dealer-errors.js';

/** How long a status message stays up. */
const STATUS_MS = 3500;
/** The insurance offer passes itself after this long, as the original did. */
const INSURANCE_MS = 5000;

const ACTION_LABELS = [
  [ACTION.stand, 'Stand', 'arrow-l', 'left'],
  [ACTION.hit, 'Hit', 'arrow-d', 'left'],
  [ACTION.double, 'Double', 'arrow-u', 'right'],
  [ACTION.split, 'Split', 'arrow-r', 'right'],
  [ACTION.surrender, 'Surrender', 'delete', 'right'],
];

export function tableScreen(app) {
  const { settings } = app;
  const session = new GameSession(app);
  const state = createTableState({ decks: session.table.decks });

  // --- DOM ------------------------------------------------------------------

  const canvas = h('canvas', { class: 'table__canvas' });
  const status = h('div', { class: 'table__status', hidden: true });
  const bankroll = h('div', { class: 'table__bankroll' });
  const counts = h('div', { class: 'table__counts' });
  const chips = new Map();
  const actionButtons = new Map();
  const sides = { left: h('div', { class: 'table__actions table__actions--left' }), right: h('div', { class: 'table__actions table__actions--right' }) };
  for (const [action, label, icon, side] of ACTION_LABELS) {
    const btn = button(label, { icon, onClick: () => play(action), hidden: true, 'data-action': action });
    actionButtons.set(action, btn);
    sides[side].append(btn);
  }
  const insureButton = button('Insure', { icon: 'arrow-d', onClick: () => answerInsurance(true), hidden: true, 'data-action': 'insure' });
  const passButton = button('Pass', { icon: 'arrow-l', onClick: () => answerInsurance(false), hidden: true, 'data-action': 'pass' });
  sides.left.append(insureButton, passButton);

  const overlay = createBetOverlay({
    onBet: placeBet,
    onSideBet: chooseSideBet,
    sideBetsAvailable: () => settings.get('bonuses.game') !== 0,
    onNoSideBet: () => overlay.setMessage('No side bet is configured.'),
    onCustomize: () => app.open('settings.betting'),
    onShuffle: shuffleNow,
    onResetBank: resetBank,
    onFoul: claimDealerError,
    onLastError: openLastError,
  });

  const felt = h('div', { class: 'table__felt' },
    canvas, status, bankroll, counts, sides.left, sides.right, overlay.el);
  const bar = h('header', { class: 'table__bar' },
    button('Back', { variant: 'nav', onClick: () => app.back(), 'data-action': 'back' }),
    h('div', { class: 'table__bar-end' },
      button('Stats', { variant: 'nav', icon: 'grid', onClick: openStats, 'data-action': 'stats' }),
      button('Error', { variant: 'nav', icon: 'info', onClick: openLastError, 'data-action': 'error' }),
      button('Help', { variant: 'nav', onClick: () => app.help('game.table'), 'data-action': 'help' })));
  const el = h('section', { class: 'table' }, bar, felt);

  // --- play state -----------------------------------------------------------

  const renderer = createTableRenderer(canvas);
  let layout = null;
  /** The bankroll before the last bet was placed, for the "you won" line. */
  let bankBeforeBet = session.bankroll;
  let previousBetLabel = null;
  /** A dealer mistake the player has not called yet. */
  let pendingError = null;
  /** True once the dealer has queried a bad play, which lets the next one through. */
  let warnedOfBadPlay = false;
  let statusTimer = null;
  let insuranceTimer = null;
  let nextRoundTimer = null;
  /** False once the screen has been closed, so late callbacks stop drawing. */
  let alive = true;

  const animator = createAnimator({ onStep: applyStep, onIdle: whenIdle });

  function pauses() {
    return {
      dealer: pauseForSpeed(settings.get('mechanics.dealerSpeed')),
      player: pauseForSpeed(settings.get('mechanics.otherPlayerSpeed')),
      payoff: pauseForSpeed(settings.get('mechanics.payoffSpeed')),
    };
  }

  const ownerOf = key => session.game.hands.find(hand => hand.key === key)?.owner;
  const isComputer = key => ownerOf(key) === PLAYER.computer;

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
    });
    renderer.resize(layout);
    placeLabels();
    overlay.layout();
    render();
  }

  /** Puts the absolutely positioned labels where the layout says. */
  function placeLabels() {
    box(bankroll, layout.bankroll);
    box(status, layout.status);
    box(counts, { ...layout.status, y: layout.status.y + layout.status.height + 2 });
    for (const [, chip] of chips) chip.remove();
    chips.clear();
    for (const seat of layout.seats) {
      const chip = h('div', { class: 'table__chip', dataset: { seat: String(seat.seat) } });
      box(chip, seat.chip);
      chips.set(seat.seat, chip);
      felt.append(chip);
    }
  }

  const box = (node, rect) => Object.assign(node.style, {
    left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`,
  });

  function render() {
    if (!layout) return;
    renderer.render({
      hands: state.hands.filter(hand => seatSlot(layout, hand.seat)),
      dealer: state.dealer,
      pointerHand: state.pointerHand,
      trayCards: state.trayCards,
      shoeCards: state.shoeCards,
    });
    bankroll.textContent = dollars(state.bankroll);
    bankroll.classList.toggle('is-negative', state.bankroll < 0);
    for (const [seat, chip] of chips) {
      const held = state.chips.get(seat);
      chip.textContent = held ? chipText(held) : '';
      chip.classList.toggle('is-result', Boolean(held?.result));
    }
  }

  const chipText = held => (held.result ? ` ${held.result} ` : money(held.amount) + (held.sideBet > 0 ? `, SB:$${held.sideBet}` : ''));

  function countsText() {
    const parts = [];
    const accuracy = session.accuracy();
    if (settings.get('display.showBetAccuracy') && session.stats.betDecisions > 0) parts.push(`Bets: ${accuracy.bet}%`);
    if (settings.get('display.showPlayAccuracy') && session.stats.playDecisions > 0) parts.push(`Plays: ${accuracy.play}%`);
    if (settings.get('display.showRunningCount')) parts.push(`RC: ${round1(session.counts.runningCount)}`);
    if (settings.get('display.showTrueCount')) parts.push(`TC: ${round1(session.counts.trueCount)}`);
    return parts.join(', ');
  }

  function showStatus(text, tone = 'plain') {
    clearTimeout(statusTimer);
    if (!text) {
      status.hidden = true;
      return;
    }
    status.textContent = text;
    status.className = `table__status table__status--${tone}`;
    status.hidden = false;
    statusTimer = setTimeout(() => { status.hidden = true; }, STATUS_MS);
  }

  // --- the animation timeline ----------------------------------------------

  /** Applies an engine event and redraws. */
  function applyStep({ event, sound }) {
    state.apply(event);
    if (sound) app.sound.play(sound);
    if (event.type === 'message') showStatus(` ${event.text} `, 'plain');
    if (event.type === 'offerInsurance') showStatus(' Insurance? ', 'plain');
    render();
  }

  /** Queues the events an engine call produced. */
  function queue(events) {
    if (session.state === STATE.settled) injectDealerError(events);
    animator.play(planSteps(events, { pauses: pauses(), isComputer }));
    updateControls();
  }

  /** Applies events with no animation (clearing the table). */
  function applyNow(events) {
    for (const event of events) state.apply(event);
    render();
  }

  function whenIdle() {
    for (const warning of session.takeWarnings()) showStatus(` ${warning} `, 'error');
    // The counts only mean anything once every card in the timeline is showing.
    counts.textContent = countsText();
    updateControls();
    if (session.state === STATE.insurance) startInsuranceTimer();
    if (session.state === STATE.settled && !nextRoundTimer) {
      nextRoundTimer = setTimeout(() => {
        nextRoundTimer = null;
        applyNow(session.nextRound());
        beginBetting();
      }, pauses().payoff);
    }
  }

  // --- controls -------------------------------------------------------------

  function updateControls() {
    const busy = animator.busy;
    const actions = session.availableActions();
    const hidden = settings.get('display.hideActionButtons');
    for (const [action, btn] of actionButtons) btn.hidden = hidden || busy || !actions[action];
    const offering = !busy && session.state === STATE.insurance;
    insureButton.hidden = hidden || !offering;
    passButton.hidden = hidden || !offering;
  }

  /** Every way in refuses while a timeline is playing (legacy race). */
  const accepting = () => !animator.busy && !overlay.visible;

  function play(action) {
    if (!accepting() || !session.availableActions()[action]) return;
    if (queryBadPlay(action)) return;
    queue(session.act(action));
  }

  /**
   * Asks "Are you sure?" before an obviously bad play and refuses it once. The
   * next such play goes through, as the original's toggle did.
   */
  function queryBadPlay(action) {
    if (!settings.get('mechanics.dealerPointsOutStupidPlays')) return false;
    const hand = session.game.activeHand;
    if (!hand || !obviouslyBad(action, hand.totals())) return false;
    warnedOfBadPlay = !warnedOfBadPlay;
    if (!warnedOfBadPlay) return false;
    alert(areYouSure(action));
    return true;
  }

  function answerInsurance(take) {
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
    insuranceTimer = null;
  }

  function onSwipe(action) {
    if (overlay.visible || animator.busy) return;
    if (session.state === STATE.insurance) {
      if (action === 'insure') answerInsurance(true);
      if (action === 'pass') answerInsurance(false);
      return;
    }
    if (action === 'insure' || action === 'pass') return;
    if (!session.availableActions()[action]) {
      showStatus(` Cannot ${action} `, 'error');
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

  function placeBet({ amount, hands, label }) {
    const [low, high] = TABLE_LIMITS[settings.get('table.limits')];
    // Asking for more hands than the player has seats quietly bets fewer.
    const seats = session.humanSeats().slice(0, hands);
    if (amount < low) {
      overlay.setMessage(`Bet below the table minimum of ${money(low)}.`);
      return;
    }
    if (amount > high) {
      overlay.setMessage(`Bet above the table maximum of ${money(high)}.`);
      return;
    }
    if (amount * seats.length > session.bankroll) {
      overlay.setMessage('Not enough in the bankroll for that bet.');
      return;
    }
    reportMissedError();
    previousBetLabel = label;
    bankBeforeBet = session.bankroll;
    overlay.hide();
    state.setBets(seats.map(seat => ({ seat, amount })));
    state.setBankroll(bankBeforeBet - amount * seats.length);
    queue(session.startRound({ betPerHand: amount, hands }));
  }

  /**
   * Picks a side-bet amount. The engine does not resolve side bets yet, so the
   * amount is reported rather than wagered.
   */
  function chooseSideBet() {
    app.open('game.betSelect', {
      mode: 'sideBet',
      chipValue: settings.get('betting.chipValue'),
      onPick: ({ amount }) => {
        if (amount > 0) alert('Side bets are not paid out in this build, so none was placed.');
      },
    });
  }

  function shuffleNow() {
    session.shuffleNow();
    applyNow(session.game.takeEvents());
    overlay.setMessage('The shoe will be shuffled.');
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

  /** Lets the dealer make one of the mistakes the player enabled. */
  function injectDealerError(events) {
    const enabled = enabledErrors(settings);
    if (enabled.length === 0 || pendingError) return;
    const hands = session.game.hands.filter(hand => hand.owner === PLAYER.human).map(errorHandFrom);
    const dealer = session.game.dealer;
    const error = pickDealerError({
      hands,
      dealer: { total: dealer.total, cardCount: dealer.cardCount, busted: dealer.busted() },
      dealerBlackjack: Boolean(session.game.dealerBlackjack),
      enabled,
      random: Math.random,
    });
    if (!error) return;
    pendingError = error;
    // The chips never arrive: take them back and show the result the dealer called.
    session.game.bankroll -= error.amount;
    session.save();
    for (const affected of error.hands) {
      const settled = events.find(event => event.type === 'settled' && event.hand === affected.key);
      if (!settled) continue;
      settled.result = affected.result;
      settled.payout -= affected.shortfall;
    }
    const end = events.find(event => event.type === 'roundEnd');
    if (end) end.bankroll = session.game.bankroll;
  }

  function claimDealerError() {
    const { caught, refund, message, tone } = claimFoul(pendingError);
    if (caught) {
      session.game.bankroll += refund;
      session.save();
      state.setBankroll(session.bankroll);
      pendingError = null;
      render();
    } else {
      app.sound.play('error');
    }
    overlay.setMessage(message.trim());
    showStatus(message, tone === 'good' ? 'good' : 'error');
  }

  function reportMissedError() {
    if (!pendingError) return;
    showStatus(` ${missedMessage(pendingError)} `, 'error');
    pendingError = null;
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
      showStatus(' No play errors yet ', 'error');
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
   * abandoning the round (the original kept them).
   */
  function refundOpenBets() {
    if (session.state === STATE.betting || session.state === STATE.settled) return;
    const staked = session.game.hands
      .filter(hand => hand.owner === PLAYER.human)
      .reduce((sum, hand) => sum + hand.wagered, 0);
    if (staked <= 0) return;
    session.game.bankroll += staked;
    session.save();
  }

  // --- wiring ---------------------------------------------------------------

  const detachSwipes = attachSwipes(felt, onSwipe, { insurance: () => session.state === STATE.insurance });
  const observer = new ResizeObserver(() => relayout());

  return {
    el,

    onShow() {
      observer.observe(felt);
      renderer.whenReady().then(() => { relayout(); });
      relayout();
      if (!overlay.visible && session.state === STATE.betting) {
        state.setBankroll(session.bankroll);
        applyNow(session.game.takeEvents());
        counts.textContent = countsText();
        beginBetting();
      }
    },

    onHide() {
      observer.disconnect();
    },

    destroy() {
      alive = false;
      observer.disconnect();
      detachSwipes();
      animator.cancel();
      clearTimeout(statusTimer);
      clearTimeout(nextRoundTimer);
      stopInsuranceTimer();
      refundOpenBets();
    },
  };
}

const round1 = n => Math.round(n * 10) / 10;

/** Chip labels drop the cents when there are none, as the original did. */
const money = amount => `$${amount.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** The bankroll always shows cents. */
const dollars = amount => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
