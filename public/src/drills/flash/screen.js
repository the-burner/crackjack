// Flash drills: a hand and a count are flashed and the player picks the play.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { confirm } from '../../ui/dialogs.js';
import { toast } from '../../ui/toast.js';
import { setupCanvas, drawCard, cardWidthFor, loadCardImages } from '../../ui/card-sprites.js';
import { doubleTapDetector } from '../../ui/double-tap.js';
import { cssVar } from '../../ui/theme.js';
import { valueName } from '../../core/cards.js';
import { ACTION } from '../../core/strategy/advisor.js';
import { drillShell, drillClockFor } from '../shared/drill-screen.js';
import { progressiveSpeed, TIMER_MODE } from '../shared/drill-clock.js';
import { drillStrategy } from '../shared/drill-settings.js';
import { countGrid, countWindow, INITIAL_WINDOW } from '../shared/count-grid.js';
import { drawGridIn } from '../shared/answer-grid.js';
import {
  buildHandList, dealHand, handIndex, countForHand, correctPlay, errorCell, RoundRobin,
  describeHand, rowOf, columnOf, ACTION_LABELS, SITUATION_LABELS,
} from './logic.js';

/** The answer buttons, in two rows, with their swipe hints. */
const ANSWER_BUTTONS = [
  [{ action: ACTION.double, label: 'Double', icon: 'arrow-u' },
    { action: ACTION.split, label: 'Split', icon: 'arrow-r' },
    { action: ACTION.surrender, label: 'Surrender', icon: 'delete' }],
  [{ action: ACTION.hit, label: 'Hit', icon: 'arrow-d' },
    { action: ACTION.stand, label: 'Stand', icon: 'arrow-l' }],
];

/** Hands whose own index is too far outside the grid are skipped in the index test. */
const MAX_REDEALS = 200;
const PAUSE_AFTER_ANSWER_MS = 100;
/** Shorter drags than this are taps, not swipes. */
const MIN_SWIPE_PIXELS = 10;

export function flashScreen(app) {
  const s = app.settings;
  const options = {
    hands: s.get('drills.flash.hands'),
    situations: s.get('drills.flash.situations'),
    countMode: s.get('drills.flash.countMode'),
    fixedCount: s.get('drills.flash.fixedCount'),
    maxCards: s.get('drills.flash.maxCards'),
    testMode: s.get('drills.flash.testMode'),
    nonBlockingErrors: s.get('drills.flash.nonBlockingErrors'),
    timerMode: s.get('drills.flash.timerMode'),
    handsPerDrill: s.get('drills.flash.handsPerDrill'),
    timePerHand: s.get('drills.flash.timePerHand'),
    decks: s.get('drills.flash.decks'),
    spanish: s.get('drills.flash.spanishDecks'),
    seconds: s.get('drills.flash.seconds'),
    drillSeconds: s.get('drills.flash.drillSeconds'),
    progressive: s.get('drills.flash.progressiveSpeed'),
    doubleAnyCards: s.get('rules.doubleAnyNumberOfCards'),
  };
  const { strategy } = drillStrategy(app, options.decks);
  const indexTest = options.countMode === 'indexTest';
  const warn = options.testMode === 'warn';
  const silent = options.testMode === 'none';
  /** Warns with a brief pop-up and lets the player keep trying, instead of stopping to explain. */
  const nonBlocking = warn && options.nonBlockingErrors;
  // The Drill-Errors list is about mistakes, so splitting is always a legal answer.
  const situations = { ...options.situations, split: options.situations.split || options.hands === 'drillErrors' };

  const canvas = h('canvas', { class: 'drill__cards' });
  const countPanel = h('div', { class: 'drill__count' });
  const grid = h('canvas', { class: 'drill__answers' });
  const gridWrap = h('div', { class: 'drill__answers-wrap' }, grid);
  const answerButtons = ANSWER_BUTTONS.flat().map(b => {
    const el = button(b.label, { icon: b.icon, iconPos: 'bottom', onClick: () => answer(b.action) });
    el.dataset.action = b.label.toLowerCase();
    el.drillAction = b.action;
    return el;
  });
  let next = 0;
  const answers = h('div', { class: 'drill__buttons' },
    ANSWER_BUTTONS.map(row => h('div', { class: 'drill__answer-row' }, row.map(() => answerButtons[next++]))));

  let run = -1;
  let list = [];
  /** Deals the Round Robin list in order; null for the other hand lists. */
  let robin = null;
  /** Round Robin rounds finished this run. */
  let rounds = 0;
  let hand = null;
  let count = 0;
  let index = null;
  let play = null;
  let answered = false;
  let gridWindow = INITIAL_WINDOW;
  let answerGrid = null;
  let finished = false;
  let started = false;

  const shell = drillShell(app, {
    title: 'Flash Drills',
    help: 'drills.flash',
    countLabel: 'Hands',
    className: 'drill--flash',
    pausable: true,
    accuracyText: score => (warn ? `Accuracy: ${score.accuracy}%` : silent ? 'No Tests' : 'Displayed at end'),
    countText: score => (options.hands === 'roundRobin' ? `Hands: ${score.tests}, Rounds: ${rounds}` : `Hands: ${score.tests}`),
    onStart: start,
    onStop: stop,
    onLayout: draw,
    onPause: pause,
    onResume: resume,
  });
  shell.setDisplay(canvas, countPanel);
  shell.body.append(indexTest ? gridWrap : answers);
  showButtons();

  /** Rounds and Infinite can time each hand; Count Down & Halt times the whole drill. */
  const timedHands = options.timePerHand
    && (options.timerMode === TIMER_MODE.auto || options.timerMode === TIMER_MODE.infinite);
  /** Seconds per hand; with Progressive Speed, 10% less on each Restart. */
  const speed = () => progressiveSpeed(options.seconds, run, options.progressive);

  function start() {
    run += 1;
    rounds = 0;
    finished = false;
    gridWindow = INITIAL_WINDOW;
    const built = buildHandList({
      hands: options.hands,
      situations: options.situations,
      strategy,
      customMask: s.get('drills.flash.customHands'),
      tallies: app.errorTallies.load(),
    });
    list = built.entries;
    // Round Robin deals every hand once, in a random order, before any repeats.
    robin = options.hands === 'roundRobin' ? new RoundRobin(list, Math.random) : null;
    if (built.error) {
      shell.setMessage(built.error);
      return;
    }
    drillClockFor(shell, {
      mode: options.timerMode,
      limit: options.drillSeconds,
      onHalt: () => finish(),
    }).start();
    nextHand();
  }

  function stop() {
    shell.clock?.stop();
    answered = false;
    hand = null;
    showButtons();
    draw();
  }

  /** Deals the next hand. */
  function nextHand() {
    for (let attempt = 0; attempt < MAX_REDEALS; attempt++) {
      hand = dealHand(robin ? [robin.next()] : list, options, Math.random);
      if (!hand) {
        shell.setMessage('There are no situations selected. Try changing the Situations or Hands option.');
        finish();
        return;
      }
      index = handIndex(strategy, hand, situations);
      // The index test can only ask about hands whose index fits on the grid.
      if (!indexTest || index !== null) break;
      hand = null;
    }
    if (!hand) {
      shell.setMessage('You have no tests configured in the options.');
      finish();
      return;
    }
    count = indexTest ? 0 : countForHand({ ...options, index }, Math.random);
    play = correctPlay(strategy, hand, { count, situations, doubleAnyCards: options.doubleAnyCards });
    answered = false;
    shell.score.beginTest();
    shell.clearMessage();
    if (indexTest) {
      gridWindow = countWindow(index, gridWindow);
      answerGrid = countGrid(gridWindow);
    }
    highlight(null);
    draw();
    shell.updateStats(shell.clock);
    // A hand only times out when the drill gives each hand a time limit.
    if (timedHands) shell.clock.after('hand', speed(), timeout);
  }

  function timeout() {
    if (silent) {
      advance();
      return;
    }
    recordError(null);
    if (indexTest) {
      answerGrid.mark(answerGrid.cellFor(index), 'correct');
      draw();
    } else if (nonBlocking) {
      toast('Out of time', { position: 'top' });
    } else if (warn) {
      highlight(play.action);
    } else {
      advance();
    }
  }

  /** Grades a tapped answer button or a swipe. */
  function answer(action) {
    if (!hand || finished || action === null) return;
    if (!visibleActions()[action]) {
      shell.setMessage(`${ACTION_LABELS[action]} situations were not selected on the Options page.`);
      return;
    }
    const illegal = illegalPress(action);
    if (illegal) {
      shell.setMessage(illegal);
      return;
    }
    shell.clock.cancel('hand');
    if (action === play.action) {
      if (warn) app.sound.play('correct');
      advance();
      return;
    }
    if (!answered) recordError(action);
    if (nonBlocking) {
      toast(`${ACTION_LABELS[action]} is incorrect`, { position: 'top' });
    } else if (warn) {
      highlight(play.action);
      explain(action);
    } else {
      advance();
    }
  }

  /** Grades a tap on the index-test grid. */
  function gridTap(event) {
    if (!hand || finished || !answerGrid) return;
    const box = grid.getBoundingClientRect();
    const cell = answerGrid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    if (!cell) return;
    shell.clock.cancel('hand');
    if (cell.value === index) {
      answerGrid.mark(cell, 'correct');
      draw();
      app.sound.play('correct');
      setTimeout(advance, PAUSE_AFTER_ANSWER_MS);
      return;
    }
    if (!answered) recordError(null);
    answerGrid.mark(cell, 'wrong');
    if (warn) answerGrid.mark(answerGrid.cellFor(index), 'correct');
    draw();
  }

  function illegalPress(action) {
    if (action === ACTION.split && (hand.cardCount > 2 || hand.cards[0] !== hand.cards[1])) return 'Cannot split.';
    if (action === ACTION.double && hand.cardCount > 2 && !options.doubleAnyCards) return 'Cannot double with more than two cards.';
    if (action === ACTION.surrender && hand.cardCount > 2) return 'Cannot surrender with more than two cards.';
    return null;
  }

  /** Counts the error once per hand and files it in the strategy tables. */
  function recordError(action) {
    answered = true;
    shell.score.recordError();
    if (warn) app.sound.play('error');
    // The index test asks about the index, so the error belongs to the hand's
    // own table rather than to whichever table decided the play.
    const cell = indexTest
      ? { table: hand.kind, row: rowOf(hand.entry), column: columnOf(hand.upcard) }
      : errorCell(play, action, hand);
    if (cell && cell.row >= 0) app.errorTallies.record(cell.table, cell.row, cell.column);
    shell.updateStats(shell.clock);
  }

  /** Moves on, or ends the drill when the round count is reached (Rounds mode only). */
  function advance() {
    if (robin?.endsRound) {
      rounds += 1;
      toast(`Round ${rounds} done`, { position: 'top', tone: 'good' });
    }
    if (options.timerMode === TIMER_MODE.auto && shell.score.tests >= options.handsPerDrill) finish();
    else nextHand();
  }

  function finish() {
    finished = true;
    shell.finish();
    draw();
  }

  const resultText = () => (silent ? 'Done' : `Accuracy: ${shell.score.accuracy}%`);

  function highlight(action) {
    for (const el of answerButtons) el.classList.toggle('is-correct', el.drillAction === action);
  }

  /** Offers the strategy explanation for a wrong answer, with the clock frozen. */
  async function explain(action) {
    const cell = errorCell(play, action, hand);
    shell.clock.pause();
    const lines = [
      `Action: ${ACTION_LABELS[action] ?? 'Timeout'}; Correct: ${ACTION_LABELS[play.action]}`,
      `Dealer: ${valueName(hand.upcard)}; Player: ${describeHand(hand)}`,
      cell ? `Table: ${SITUATION_LABELS[cell.table]}` : null,
    ].filter(Boolean);
    const show = await confirm(`${lines.join('\n')}\n\nShow the strategy table?`, { yes: 'Table', no: 'OK' });
    if (show) {
      app.open('strategy.tables', {
        decks: options.decks,
        title: cell ? SITUATION_LABELS[cell.table] : 'Tables',
        view: cell?.table,
        highlight: cell ? { row: cell.row, column: cell.column } : null,
      });
    }
    shell.clock.resume();
  }

  function pause() {
    shell.clock.pause();
    // The paused hand is thrown away, so it must not count.
    shell.score.discardTest();
    hand = null;
    draw();
  }

  function resume() {
    shell.clock.resume();
    nextHand();
  }

  /** Which answers the chosen situations allow. */
  function visibleActions() {
    const all = options.hands === 'illustrious18' || options.hands === 'drillErrors';
    return {
      [ACTION.hit]: true,
      [ACTION.stand]: true,
      [ACTION.double]: all || options.situations.hardDouble || options.situations.softDouble,
      [ACTION.split]: all || situations.split,
      [ACTION.surrender]: all || options.situations.surrender,
    };
  }

  function showButtons() {
    const visible = visibleActions();
    answers.hidden = silent || indexTest;
    for (const el of answerButtons) el.hidden = !visible[el.drillAction];
  }

  /** Redraws the cards, the count panel and (in the index test) the grid. */
  function draw() {
    const width = shell.display.clientWidth;
    const height = shell.display.clientHeight;
    if (width < 2 || height < 2) return;
    const ctx = setupCanvas(canvas, width, height);
    ctx.fillStyle = cssVar('--felt', '#008000');
    ctx.fillRect(0, 0, width, height);
    if (hand) drawCards(ctx, width, height);
    if (finished) {
      ctx.fillStyle = cssVar('--felt-text', '#ffffff');
      ctx.font = '40px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(resultText(), width / 2, height / 2);
    }
    countPanel.hidden = !hand;
    if (hand) countPanel.textContent = indexTest ? SITUATION_LABELS[hand.kind] : `Count: ${count}`;
    if (indexTest && answerGrid) {
      drawGridIn(answerGrid, grid, gridWrap);
    }
  }

  /** Dealer card top left, the player's hand fanned from the bottom left. */
  function drawCards(ctx, width, height) {
    const cardHeight = height / 2.2;
    const cardWidth = cardWidthFor(cardHeight);
    const { spanish } = options;
    drawCard(ctx, hand.upcardId, 2, 2, cardWidth, cardHeight, { spanish });
    const slots = Math.max(4, options.maxCards);
    let stepY = (height - 37 - cardHeight) / (slots - 1);
    if (stepY > cardHeight) stepY = cardHeight * 0.7;
    const left = cardWidth / 2;
    const stepX = (width - cardWidth - left - 2) / (slots - 1);
    const bottom = height - cardHeight - 2;
    hand.cardIds.forEach((id, i) => drawCard(ctx, id, left + i * stepX, bottom - i * stepY, cardWidth, cardHeight, { spanish }));
  }

  grid.addEventListener('click', gridTap);
  let swipeFrom = null;
  const doubleTap = doubleTapDetector();
  canvas.addEventListener('pointerdown', event => { swipeFrom = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', event => {
    if (!swipeFrom || indexTest || silent) return;
    const dx = event.clientX - swipeFrom.x;
    const dy = event.clientY - swipeFrom.y;
    swipeFrom = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_PIXELS) {
      if (doubleTap({ x: event.clientX, y: event.clientY, t: event.timeStamp })) answer(ACTION.surrender);
      return;
    }
    answer(swipeAction(dx, dy));
  });

  loadCardImages().then(draw);

  return {
    el: shell.el,
    onShow() {
      if (started) {
        shell.resumeIfSuspended();
        draw();
        return;
      }
      started = true;
      shell.begin();
    },
    onHide: shell.suspend,
    destroy: shell.destroy,
  };
}

/**
 * The action a swipe stands for: down = hit, left = stand, up = double,
 * right = split. Diagonals and taps are ignored (a double tap is Surrender).
 * @returns {number|null}
 */
export function swipeAction(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < MIN_SWIPE_PIXELS) return null;
  if (ax < 1.5 * ay && ay < 1.5 * ax) return null;
  if (ax > ay) return dx < 0 ? ACTION.stand : ACTION.split;
  return dy < 0 ? ACTION.double : ACTION.hit;
}
