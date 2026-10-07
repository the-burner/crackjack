// @ts-nocheck
// The playing table.
//
// The session owns the rules, the shoe, the bankroll and the strategy checks;
// this screen owns the picture of the table and the pace of play. The engine
// finishes a round in one go and hands back a list of events, which the
// animator plays at the speeds the player chose. Input is refused for as long
// as a timeline is playing.

import { h } from '../../ui/dom.ts';
import { button } from '../../ui/components.ts';
import { alert, confirm } from '../../ui/dialogs.ts';
import { toast } from '../../ui/toast.ts';
import { GameSession } from '../session.ts';
import { STATE, ACTION, checkAffordable } from '../engine/game.ts';
import { PLAYER } from '../engine/hand.ts';
import { TABLE_LIMITS } from '../../settings/schema.ts';
import { dealerPeeks } from '../engine/rules.ts';
import { valueOf } from '../../core/cards.ts';
import { tableLayout, seatSlot } from '../table/layout.ts';
import { createTableRenderer } from '../table/renderer.ts';
import { createTableState } from '../table/table-state.ts';
import { Counter } from '../../core/counting.ts';
import { createAnimator, planSteps, pauseForSpeed } from '../table/animator.ts';
import { createBetOverlay } from '../table/bet-overlay.ts';
import { attachSwipes } from '../table/gestures.ts';
import { obviouslyBad, areYouSure } from '../table/bad-plays.ts';
import {
  dealerErrorsOn,
  enabledErrors,
  pickDealerError,
  claimFoul,
  missedMessage,
  errorHandFrom,
  dealerStandsByMistake,
  bustsGoodHandByMistake,
  bustedGoodHandShortfall,
  DEALER_ERROR,
  ERROR_LABELS,
} from '../dealer-errors.ts';

/** The insurance offer passes itself after this long. */
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
  const bankroll = h('div', { class: 'table__bankroll' });
  const counts = h('div', { class: 'table__counts' });
  const chips = new Map();
  const actionButtons = new Map();
  const sides = {
    left: h('div', { class: 'table__actions table__actions--left' }),
    right: h('div', { class: 'table__actions table__actions--right' }),
  };
  for (const [action, label, icon, side] of ACTION_LABELS) {
    const btn = button(label, { icon, onClick: () => play(action), hidden: true, 'data-action': action });
    actionButtons.set(action, btn);
    sides[side].append(btn);
  }
  const insureButton = button('Insure', {
    icon: 'arrow-d',
    onClick: () => answerInsurance(true),
    hidden: true,
    'data-action': 'insure',
  });
  const passButton = button('Pass', {
    icon: 'arrow-l',
    onClick: () => answerInsurance(false),
    hidden: true,
    'data-action': 'pass',
  });
  sides.left.append(insureButton, passButton);

  const overlay = createBetOverlay({
    onBet: placeBet,
    onSideBet: chooseSideBet,
    sideBetsAvailable: () => session.sideBetSpots().length > 0,
    onNoSideBet: () => overlay.setMessage('No side bet is configured.'),
    onCustomize: () => app.open('settings.betting'),
    onShuffle: shuffleNow,
    onResetBank: resetBank,
    onFoul: claimDealerError,
    onLastError: openLastError,
  });

  const felt = h('div', { class: 'table__felt' }, canvas, bankroll, counts, sides.left, sides.right, overlay.el);
  const bar = h(
    'header',
    { class: 'table__bar' },
    button('Back', { variant: 'nav', onClick: () => app.back(), 'data-action': 'back' }),
    h(
      'div',
      { class: 'table__bar-end' },
      button('Stats', { variant: 'nav', icon: 'grid', onClick: openStats, 'data-action': 'stats' }),
      button('Error', { variant: 'nav', icon: 'info', onClick: openLastError, 'data-action': 'error' }),
      button('Help', { variant: 'nav', onClick: () => app.help('game.table', 'Blackjack'), 'data-action': 'help' }),
    ),
  );
  const el = h('section', { class: 'table' }, bar, felt);

  // --- play state -----------------------------------------------------------

  const renderer = createTableRenderer(canvas);
  let layout = null;
  /** The bankroll before the last bet was placed, for the "you won" line. */
  let bankBeforeBet = session.bankroll;
  let previousBetLabel = null;
  /** Side-bet amounts chosen for the next round, by spot label. */
  let pendingSideBets = {};
  /** A dealer mistake the player has not called yet. */
  let pendingError = null;
  /** Set when the dealer wrongly stood on a hard 16 this round. */
  let stoodOnSixteen = false;
  /** True once the dealer has queried a bad play, which lets the next one through. */
  let warnedOfBadPlay = false;
  /** The error pop-up showing, if any. */
  let errorPopUp = null;
  let insuranceTimer = null;
  let nextRoundTimer = null;
  /** Set while the next round's shuffle plays, so betting opens after it. */
  let openBettingWhenIdle = false;
  /** Hands whose payoff has been planned this round. */
  const swept = new Set();
  /** False once the screen has been closed, so late callbacks stop drawing. */
  let alive = true;

  const animator = createAnimator({ onStep: applyStep, onIdle: whenIdle });

  /**
   * The count as the player has seen it. The session's count is already final
   * when the first card is drawn, so the readout follows this one instead.
   */
  const shown = new Counter(session.strategy, session.trueCountSettings());
  shown.reset(session.table.decks);
  /** Cards the readout has already counted, so a flashed hole card counts once. */
  const countedCards = new Set();

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
      noHoleCard: session.rules.noHoleCard,
    });
    renderer.resize(layout);
    placeLabels();
    overlay.layout();
    render();
  }

  /** Puts the absolutely positioned labels where the layout says. */
  function placeLabels() {
    box(bankroll, layout.bankroll);
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

  const box = (node, rect) =>
    Object.assign(node.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

  function render() {
    if (!layout) return;
    renderer.render({
      hands: state.hands.filter(hand => seatSlot(layout, hand.seat)),
      dealer: state.dealer,
      pointerHand: state.pointerHand,
      burns: state.burns,
      trayCards: state.trayCards,
      shoeCards: state.shoeCards,
    });
    bankroll.textContent = dollars(state.bankroll);
    bankroll.classList.toggle('is-negative', state.bankroll < 0);
    for (const [seat, chip] of chips) {
      const held = state.chips.get(seat);
      if (held?.result) {
        // A result is shown as a pill, like the app's other pop-ups.
        const shown = chip.firstElementChild;
        if (shown?.textContent !== held.result || shown.dataset.tone !== RESULT_TONES[held.result]) {
          chip.replaceChildren(
            h('span', { class: 'table__result', dataset: { tone: RESULT_TONES[held.result] ?? 'push' } }, held.result),
          );
        }
      } else {
        chip.textContent = held ? chipText(held) : '';
      }
    }
  }

  const chipText = held => {
    if (held.result) return ` ${held.result} `;
    if (held.paid !== null) return money(held.paid);
    if (held.amount === 0) return '';
    return money(held.amount) + (held.sideBet > 0 ? `, SB:$${held.sideBet}` : '');
  };

  function countsText() {
    const parts = [];
    const accuracy = session.accuracy();
    if (settings.get('display.showBetAccuracy') && session.stats.betDecisions > 0) parts.push(`Bets: ${accuracy.bet}%`);
    if (settings.get('display.showPlayAccuracy') && session.stats.playDecisions > 0)
      parts.push(`Plays: ${accuracy.play}%`);
    if (settings.get('display.showRunningCount')) parts.push(`RC: ${round1(shown.running)}`);
    if (settings.get('display.showTrueCount')) parts.push(`TC: ${round1(shown.trueCount)}`);
    return parts.join(', ');
  }

  /** Counts a card the moment the player sees it, as the original did. */
  function countStep(event) {
    if (event.type === 'shuffle' || event.type === 'clear') {
      if (event.type === 'shuffle') shown.reset(session.table.decks);
      countedCards.clear();
      return;
    }
    // A split moves the second card to a new hand; its counted mark moves with it.
    if (event.type === 'split') {
      if (countedCards.delete(`${event.hand}:1`)) countedCards.add(`${event.newHand}:0`);
      return;
    }
    const card = event.card;
    if (card === undefined) return;
    const faceUp = event.type === 'reveal' || event.type === 'peek' || event.faceUp;
    if (!faceUp) return;
    // A hole card that flashed is turned over again later; count it once.
    const seen = `${event.hand}:${event.cardIndex}`;
    if (event.hand !== undefined && countedCards.has(seen)) return;
    countedCards.add(seen);
    shown.addCard(card, state.dealt);
  }

  /** A passing message from the table. It does not cover an error pop-up that is still up. */
  function showMessage(text) {
    if (errorPopUp?.isConnected) return;
    toast(text.trim(), { position: 'top', ms: MESSAGE_MS });
  }

  /** An error, in the same drop-down pop-up as the drills. */
  function showError(text, tone = 'error') {
    errorPopUp = toast(text.trim(), { position: 'top', tone });
  }

  /** Shows the session's strategy and betting warnings as soon as they are made. */
  function showWarnings() {
    const warnings = session.takeWarnings();
    if (warnings.length) showError(warnings.join(' · '));
  }

  // --- the animation timeline ----------------------------------------------

  /** Applies an engine event and redraws. */
  function applyStep({ event, sound }) {
    state.apply(event);
    countStep(event);
    counts.textContent = countsText();
    if (sound) app.sound.play(sound);
    if (event.type === 'message') showMessage(event.text);
    if (event.type === 'offerInsurance') showMessage('Insurance?');
    render();
  }

  /** Queues the events an engine call produced. */
  function queue(events) {
    if (session.state === STATE.settled) injectDealerError(events);
    animator.play(planSteps(events, { pauses: pauses(), isComputer, swept, sweepNaturals: !blackjackUnknown() }));
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
    const busy = animator.busy;
    const actions = session.availableActions();
    const hidden = settings.get('display.hideActionButtons');
    for (const [action, btn] of actionButtons) btn.hidden = hidden || busy || !actions[action];
    const offering = !busy && session.state === STATE.insurance;
    insureButton.disabled = !session.game.canInsure();
    insureButton.hidden = hidden || !offering;
    passButton.hidden = hidden || !offering;
  }

  /** Every way in refuses while a timeline is playing, so input cannot race it. */
  const accepting = () => !animator.busy && !overlay.visible;

  function play(action) {
    if (!accepting() || !session.availableActions()[action]) return;
    if (queryBadPlay(action)) return;
    queue(session.act(action));
  }

  /**
   * Asks "Are you sure?" before an obviously bad play and refuses it once. The
   * next such play goes through.
   */
  function queryBadPlay(action) {
    if (!settings.get('mechanics.dealerPointsOutStupidPlays')) return false;
    const hand = session.game.activeHand;
    if (!hand || !obviouslyBad(action, hand.totals())) return false;
    warnedOfBadPlay = !warnedOfBadPlay;
    if (!warnedOfBadPlay) return false;
    app.sound.play('card');
    toast(areYouSure(action), { position: 'top', ms: MESSAGE_MS });
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
    if (
      !checkAffordable({
        bankroll: session.bankroll,
        betPerHand: amount,
        hands: seats.length,
        sideBets: pendingSideBets,
      })
    ) {
      overlay.setMessage('Not enough in the bankroll for that bet.');
      return;
    }
    const overTheMultiple = sideBetOverTheMultiple(amount);
    if (overTheMultiple) {
      overlay.setMessage(`Side bet cannot be greater than ${overTheMultiple} times the main bet.`);
      return;
    }
    reportMissedError();
    previousBetLabel = label;
    bankBeforeBet = session.bankroll;
    overlay.hide();
    swept.clear();
    const sideBetTotal = Object.values(pendingSideBets).reduce((sum, staked) => sum + staked, 0);
    state.setBets(seats.map(seat => ({ seat, amount, sideBet: sideBetTotal })));
    state.setBankroll(bankBeforeBet - (amount + sideBetTotal) * seats.length);
    const sideBets = pendingSideBets;
    pendingSideBets = {};
    overlay.setSideBet('');
    queue(session.startRound({ betPerHand: amount, hands, sideBets }));
  }

  /** The limit a pending side bet breaks against this main bet, if any. */
  function sideBetOverTheMultiple(betPerHand) {
    for (const spot of session.sideBetSpots()) {
      const staked = pendingSideBets[spot.id] ?? 0;
      if (staked > betPerHand * spot.maxMultipleOfBet) return spot.maxMultipleOfBet;
    }
    return 0;
  }

  /** Picks the amount to put on each side-bet spot for the next round. */
  function chooseSideBet() {
    const spots = session.sideBetSpots();
    if (spots.length === 0) {
      alert('The selected game has no side bet.');
      return;
    }
    askSideBet(spots, 0);
  }

  /** Asks for one spot's amount, then the next: a game may offer two. */
  function askSideBet(spots, index) {
    if (spots[index]) app.open('game.betSelect', sideBetParams(spots, index));
  }

  function sideBetParams(spots, index) {
    const spot = spots[index];
    return {
      mode: 'sideBet',
      title: spots.length > 1 ? `${spot.id} side bet` : undefined,
      chipValue: settings.get('betting.chipValue'),
      onPick: ({ amount }) => {
        if (amount > spot.maxAmount) {
          alert(`The maximum ${spot.id} bet is ${money(spot.maxAmount)}.`);
          // Stay on the picker so another amount can be chosen.
          return true;
        }
        pendingSideBets = { ...pendingSideBets };
        if (amount > 0) pendingSideBets[spot.id] = amount;
        else delete pendingSideBets[spot.id];
        overlay.setSideBet(sideBetLabel());
        if (!spots[index + 1]) return false;
        // Swap this picker for the next spot's, so Back still lands on the table.
        app.router.replace('game.betSelect', sideBetParams(spots, index + 1));
        return true;
      },
    };
  }

  const sideBetLabel = () =>
    Object.entries(pendingSideBets)
      .map(([id, amount]) => `${id} side bet ${money(amount)}`)
      .join(', ');

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
  session.beforeDealerDraw = dealer => {
    const enabled = enabledErrors(settings);
    const dealt = { ...dealer.totals(), cardCount: dealer.cardCount };
    if (!dealerStandsByMistake({ dealer: dealt, playerTotal: lastPlayerTotal(), enabled, random: Math.random }))
      return true;
    stoodOnSixteen = true;
    return false;
  };

  // The dealer may call a good hand a bust as soon as the card lands.
  session.onGoodHandBusted = hand => {
    if (pendingError) return false;
    const enabled = enabledErrors(settings);
    const judged = { total: hand.total, cardCount: hand.cardCount, doubled: hand.doubled };
    if (!bustsGoodHandByMistake({ hand: judged, enabled, random: Math.random })) return false;
    // The hand pays nothing, so the bankroll is already short by what it owed.
    const shortfall = bustedGoodHandShortfall({
      bet: hand.bet,
      playerTotal: hand.total,
      dealerTotal: session.game.dealer.total,
    });
    pendingError = {
      type: DEALER_ERROR.bustedGoodHand,
      label: ERROR_LABELS[DEALER_ERROR.bustedGoodHand],
      amount: shortfall,
      hands: [{ key: hand.key, shortfall, result: 'Bust' }],
    };
    return true;
  };

  /** Lets the dealer make one of the mistakes the player enabled. */
  function injectDealerError(events) {
    const enabled = enabledErrors(settings);
    if (enabled.length === 0 || pendingError) return;
    const hands = session.game.hands
      .filter(hand => hand.owner === PLAYER.human)
      .map(hand =>
        errorHandFrom(hand, {
          sideBetWin: sideBetWinOf(events, hand.key),
          sideBetPaid: sideBetPaidOf(events, hand.key),
        }),
      );
    const dealer = session.game.dealer;
    const error = pickDealerError({
      hands,
      dealer: { total: dealer.total, cardCount: dealer.cardCount, busted: dealer.busted(), stoodOnSixteen },
      dealerBlackjack: Boolean(session.game.dealerBlackjack),
      dealerPeeked: !blackjackUnknown(),
      blackjackBonus: session.game.rules.blackjackPayout !== '1:1',
      enabled,
      random: Math.random,
    });
    if (!error) return;
    pendingError = error;
    // A mistake made during play has cost the hand already; one made at the
    // payoff is made here: the chips never arrive.
    if (!error.alreadyPaid) {
      session.adjustBankroll(-error.amount);
      for (const affected of error.hands) {
        const settled = events.find(event => event.type === 'settled' && event.hand === affected.key);
        if (!settled) continue;
        settled.result = affected.result;
        settled.payout -= affected.shortfall;
      }
    }
    const end = events.find(event => event.type === 'roundEnd');
    if (end) end.bankroll = session.game.bankroll;
  }

  /** The total the last human hand left behind, which is what the original compared. */
  function lastPlayerTotal() {
    const human = session.game.hands.filter(hand => hand.owner === PLAYER.human);
    return human.length ? human[human.length - 1].total : 0;
  }

  /** True when a blackjack could still be under an ace or ten the dealer never checked. */
  function blackjackUnknown() {
    const upcard = session.game.dealer.cards[0];
    if (upcard === undefined) return false;
    const value = valueOf(upcard);
    return (value === 1 || value === 10) && !dealerPeeks(session.game.rules, upcard);
  }

  /** What a hand's side bets paid, read from its settled event. */
  function sideBetWinOf(events, key) {
    const settled = events.find(event => event.type === 'settled' && event.hand === key);
    return (settled?.sideBets ?? []).reduce((sum, bet) => sum + Math.max(0, bet.payout - bet.stake), 0);
  }

  /** Everything a hand's side bets returned, stakes included. */
  function sideBetPaidOf(events, key) {
    const settled = events.find(event => event.type === 'settled' && event.hand === key);
    return (settled?.sideBets ?? []).reduce((sum, bet) => sum + bet.payout, 0);
  }

  function claimDealerError() {
    const { caught, refund, message, tone } = claimFoul(pendingError);
    if (caught) {
      session.adjustBankroll(refund);
      session.recordFoulCaught();
      state.setBankroll(session.bankroll);
      pendingError = null;
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
    stoodOnSixteen = false;
    if (!pendingError) return;
    session.recordMissedDealerError();
    showError(missedMessage(pendingError));
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
    const staked = session.game.hands
      .filter(hand => hand.owner === PLAYER.human)
      .reduce((sum, hand) => sum + hand.wagered, 0);
    if (staked <= 0) return;
    session.adjustBankroll(staked);
  }

  // --- wiring ---------------------------------------------------------------

  const detachSwipes = attachSwipes(felt, onSwipe, { insurance: () => session.state === STATE.insurance });
  const observer = new ResizeObserver(() => relayout());

  return {
    el,

    onShow() {
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
      observer.disconnect();
      stopInsuranceTimer();
      clearTimeout(nextRoundTimer);
      nextRoundTimer = null;
    },

    destroy() {
      alive = false;
      observer.disconnect();
      detachSwipes();
      animator.cancel();
      clearTimeout(nextRoundTimer);
      stopInsuranceTimer();
      refundOpenBets();
    },
  };
}

const round1 = n => Math.round(n * 10) / 10;

/** Chip labels drop the cents when there are none. */
/** How long a table message stays up, as the original's bar did. */
const MESSAGE_MS = 3500;

/** The original's colours for a result on the chips. */
const RESULT_TONES = {
  Win: 'win',
  21: 'win',
  Bonus: 'win',
  Push: 'push',
  Lose: 'lose',
  Bust: 'lose',
  Surrender: 'lose',
};

const money = amount =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** The bankroll always shows cents. */
const dollars = amount => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
