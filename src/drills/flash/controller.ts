// Flash drills: a hand and a count are flashed and the player picks the play.
// The run and the drawing; the screen component renders around it.

import { toast } from '@/components/ui/toast';
import { confirm } from '@/components/dialogs';
import { setupCanvas, drawCard, cardWidthFor, loadCardImages } from '@/lib/card-sprites';
import { doubleTapDetector } from '@/lib/double-tap';
import { swipeOf } from '@/core/gestures';
import { gestureMapFor } from '@/settings/gesture-configs';
import { cssVar } from '@/lib/theme';
import { valueName } from '@/core/cards';
import { ACTION } from '@/core/strategy/advisor';
import type { Action, PlayAdvice } from '@/core/strategy/advisor';
import type { App } from '@/app/app';
import { DrillShell, drillClockFor, snapshotOf } from '@/drills/shared/drill-shell';
import type { DrillShellView } from '@/drills/shared/drill-shell';
import { progressiveSpeed, TIMER_MODE } from '@/drills/shared/drill-clock';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { countGrid, countWindow, INITIAL_WINDOW } from '@/drills/shared/count-grid';
import { drawGridIn } from '@/drills/shared/answer-grid';
import type { AnswerGrid } from '@/drills/shared/answer-grid';
import { AnswerPause, cellAtEvent } from '@/drills/shared/grid-answers';
import type { GridTap } from '@/drills/shared/grid-answers';
import {
  buildHandList,
  dealHand,
  ownIndex,
  countCentre,
  countForHand,
  correctPlay,
  errorCell,
  RoundRobin,
  describeHand,
  rowOf,
  columnOf,
  ACTION_LABELS,
  SITUATION_LABELS,
} from './logic';
import type { Entry, FlashHand } from './logic';
import { autoPauseDue, intervalLeft, startAutoPause, takeAutoPause } from '@/drills/shared/auto-pause';
import type { AutoPause } from '@/drills/shared/auto-pause';
import type { TablesParams } from '@/screens/strategy/tables';

/** A hand a pause interrupted, with what the player had already done. */
interface HeldHand {
  hand: FlashHand;
  count: number;
  answered: boolean;
}

/** Hands whose own index is too far outside the grid are skipped in the index test. */
const MAX_REDEALS = 200;
/** Shorter drags than this are taps, not swipes. */
const MIN_SWIPE_PIXELS = 10;
/** One pop-up at a time: a new one replaces the last. */

/** A pointer on the cards. */
export interface CardsPointer {
  clientX: number;
  clientY: number;
  timeStamp: number;
}

export interface FlashElements {
  display: HTMLElement;
  canvas: HTMLCanvasElement;
  /** The index test's grid; the other drills have none. */
  grid: { canvas: HTMLCanvasElement; wrap: HTMLElement } | null;
}

export interface FlashView {
  shell: DrillShellView;
  /** The index test asks on a grid instead of the buttons. */
  indexTest: boolean;
  /** The answer buttons are up (not in the index test or with No Tests). */
  buttonsShown: boolean;
  /** Which answer buttons the chosen situations allow. */
  visible: Record<Action, boolean>;
  /** The answer marked as the right one, after a wrong one. */
  correct: Action | null;
  /** The count panel's text, or null when no hand is up. */
  countPanel: string | null;
}

/** `openTable` shows the strategy table over the drill (its explanation of a wrong answer). */
export function createFlashDrill(app: App, { openTable }: { openTable: (params: TablesParams) => void }) {
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
    autoPause: s.get('drills.flash.autoPause'),
    autoPauseSeconds: s.get('drills.flash.autoPauseSeconds'),
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

  let els: FlashElements | null = null;
  let run = -1;
  let list: Entry[] = [];
  /** Deals the Round Robin list in order; null for the other hand lists. */
  let robin: RoundRobin | null = null;
  /** Round Robin rounds finished this run. */
  let rounds = 0;
  /** The hand a pause interrupted, dealt again on resume. */
  let held: HeldHand | null = null;
  let hand: FlashHand | null = null;
  let count = 0;
  let index: number | null = null;
  let play: PlayAdvice | null = null;
  let answered = false;
  /** The hand on screen has had no answer, so ending the drill now discards it. */
  let pending = false;
  let gridWindow = INITIAL_WINDOW;
  let answerGrid: AnswerGrid | null = null;
  let finished = false;
  let correct: Action | null = null;
  /** The wait between a right index answer and the next hand, so it can be called off. */
  const advanceTimer = new AnswerPause();
  /** A pause called off that wait: move on when play resumes. */
  let advanceOnResume = false;
  /** Infinite with "Pause every": the interval in progress. */
  let autoPause: AutoPause | null = null;
  /** Paused at the end of an interval: the one that begins on Continue. */
  let nextInterval: AutoPause | null = null;
  /** Paused between hands at the end of an interval: deal the next one on resume. */
  let dealOnResume = false;

  const shell = new DrillShell(app, {
    countLabel: 'Hands',
    // The next interval starts as Continue is tapped, so Time shows it during the countdown.
    onContinue: () => {
      if (!nextInterval) return;
      autoPause = nextInterval;
      nextInterval = null;
      shell.clearMessage();
    },
    // With Pause every interval, Time counts down each interval.
    timeShown: clock => (autoPause ? intervalLeft(autoPause, clock.elapsed) : clock.display()),
    pausable: true,
    accuracyText: score => (warn ? `Accuracy: ${score.accuracy}%` : silent ? 'No Tests' : 'Displayed at end'),
    countText: score =>
      options.hands === 'roundRobin' ? `Hands: ${score.tests}, Rounds: ${rounds}` : `Hands: ${score.tests}`,
    onStart: start,
    onStop: stop,
    onRestart: () => {
      finished = false;
    },
    onPause: pause,
    onResume: resume,
  });
  const changed = () => shell.changed();

  /** Rounds and Infinite can time each hand; Count Down & Halt times the whole drill. */
  const timedHands =
    options.timePerHand && (options.timerMode === TIMER_MODE.auto || options.timerMode === TIMER_MODE.infinite);
  /** Seconds per hand; with Progressive Speed, 10% less on each Restart. */
  const speed = () => progressiveSpeed(options.seconds, run, options.progressive);

  function start() {
    run += 1;
    rounds = 0;
    held = null;
    finished = false;
    nextInterval = null;
    dealOnResume = false;
    autoPause =
      options.timerMode === TIMER_MODE.infinite && options.autoPause ? startAutoPause(options.autoPauseSeconds) : null;
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
    advanceTimer.cancel();
    advanceOnResume = false;
    answered = false;
    pending = false;
    hand = null;
    changed();
  }

  /** Deals the next hand, or resumes `again`, a hand a pause interrupted. */
  function nextHand(again: HeldHand | null = null) {
    for (let attempt = 0; attempt < MAX_REDEALS; attempt++) {
      hand = again?.hand ?? dealHand(robin ? robinPick(robin) : list, options, Math.random);
      if (!hand) {
        shell.setMessage('There are no situations selected. Try changing the Situations or Hands option.');
        finish();
        return;
      }
      index = ownIndex(strategy, hand, situations);
      // The index test can only ask about a hand that has an index of its own.
      if (!indexTest || index !== null) break;
      hand = null;
    }
    if (!hand) {
      shell.setMessage('You have no tests configured in the options.');
      finish();
      return;
    }
    count = again
      ? again.count
      : indexTest
        ? 0
        : countForHand({ ...options, index, centre: countCentre(strategy) }, Math.random);
    play = correctPlay(strategy, hand, { count, situations, doubleAnyCards: options.doubleAnyCards });
    // A resumed hand is the same test, so it keeps its place in the count.
    answered = again ? again.answered : false;
    pending = !answered;
    if (!again) shell.score.beginTest();
    shell.clearMessage();
    if (indexTest && index !== null) {
      gridWindow = countWindow(index, gridWindow);
      answerGrid = countGrid(gridWindow);
    }
    correct = null;
    shell.updateStats(shell.clock);
    // A hand only times out when the drill gives each hand a time limit.
    if (timedHands) shell.clock?.after('hand', speed(), timeout);
  }

  /** The next Round Robin hand, as a one-hand list. */
  function robinPick(order: RoundRobin): Entry[] {
    const picked = order.next();
    return picked ? [picked] : [];
  }

  function timeout() {
    if (silent) {
      advance();
      return;
    }
    recordError(null);
    if (indexTest) {
      if (answerGrid && index !== null) answerGrid.mark(answerGrid.cellFor(index), 'correct');
      changed();
    } else if (nonBlocking) {
      toast('Out of time', { position: 'top', tone: 'error' });
    } else if (warn) {
      correct = play?.action ?? null;
      changed();
    } else {
      advance();
    }
  }

  /** Grades a tapped answer button or a swipe. */
  function answer(action: Action | null) {
    if (!hand || !play || finished || action === null) return;
    if (!visibleActions()[action]) {
      shell.setMessage(`${ACTION_LABELS[action]} situations were not selected on the Options page.`);
      return;
    }
    const illegal = illegalPress(hand, action);
    if (illegal) {
      shell.setMessage(illegal);
      return;
    }
    shell.clock?.cancel('hand');
    if (action === play.action) {
      if (warn) app.sound.play('correct');
      advance();
      return;
    }
    if (!answered) recordError(action);
    if (nonBlocking) {
      toast(`${ACTION_LABELS[action]} is incorrect`, { position: 'top', tone: 'error' });
    } else if (warn) {
      correct = play.action;
      changed();
      explain(action, play, hand);
    } else {
      advance();
    }
  }

  /** Grades a tap on the index-test grid. */
  function gridTap(event: GridTap) {
    // Once the answer is in, further taps are ignored until the next hand.
    if (!hand || finished || !answerGrid || advanceTimer.pending) return;
    const cell = cellAtEvent(answerGrid, event);
    if (!cell) return;
    shell.clock?.cancel('hand');
    if (silent) {
      advance();
      return;
    }
    if (cell.value === index) {
      answerGrid.mark(cell, 'correct');
      changed();
      app.sound.play('correct');
      advanceTimer.start(advance);
      return;
    }
    if (!answered) recordError(null);
    answerGrid.mark(cell, 'wrong');
    if (warn && index !== null) answerGrid.mark(answerGrid.cellFor(index), 'correct');
    changed();
  }

  function illegalPress(hand: FlashHand, action: Action): string | null {
    if (action === ACTION.split && (hand.cardCount > 2 || hand.cards[0] !== hand.cards[1])) return 'Cannot split.';
    if (action === ACTION.double && hand.cardCount > 2 && !options.doubleAnyCards)
      return 'Cannot double with more than two cards.';
    if (action === ACTION.surrender && hand.cardCount > 2) return 'Cannot surrender with more than two cards.';
    return null;
  }

  /** Counts the error once per hand and files it in the strategy tables. */
  function recordError(action: Action | null) {
    answered = true;
    pending = false;
    shell.score.recordError();
    if (warn) app.sound.play('error');
    if (!hand || !play) return;
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
    pending = false;
    if (robin?.endsRound) {
      rounds += 1;
      toast(`Round ${rounds} done`, { position: 'top', tone: 'good' });
    }
    if (options.timerMode === TIMER_MODE.auto && shell.score.tests >= options.handsPerDrill) finish();
    else if (autoPause && shell.clock && autoPauseDue(autoPause, shell.clock.elapsed)) pauseForInterval();
    else nextHand();
  }

  /** The interval is up (and its last hand answered): pause, saying how the interval went. */
  function pauseForInterval() {
    if (!autoPause || !shell.clock) return;
    const { message, next } = takeAutoPause(autoPause, shell.clock.elapsed, shell.score);
    // Time stays at 0 (overdue) until Continue starts the next interval.
    nextInterval = next;
    dealOnResume = true;
    hand = null;
    shell.togglePause();
    shell.setMessage(message);
    app.sound.play('alarm');
  }

  function finish() {
    finished = true;
    // A hand nobody answered is no test, so it must not count as a right one.
    if (pending) shell.score.discardTest();
    shell.finish();
    shell.updateStats(shell.clock);
  }

  const resultText = () => (silent ? 'Done' : `Accuracy: ${shell.score.accuracy}%`);

  /** Offers the strategy explanation for a wrong answer, with the clock frozen. */
  async function explain(action: Action, play: PlayAdvice, hand: FlashHand) {
    const cell = errorCell(play, action, hand);
    shell.clock?.pause();
    const lines = [
      `Action: ${ACTION_LABELS[action] ?? 'Timeout'}; Correct: ${ACTION_LABELS[play.action]}`,
      `Dealer: ${valueName(hand.upcard)}; Player: ${describeHand(hand)}`,
      cell ? `Table: ${SITUATION_LABELS[cell.table]}` : null,
    ].filter(Boolean);
    const show = await confirm(`${lines.join('\n')}\n\nShow the strategy table?`, { yes: 'Table', no: 'OK' });
    // Resumed before the table opens, so the screen change can suspend the drill
    // itself; a clock that is already paused would be left running behind it.
    shell.clock?.resume();
    if (!show) return;
    openTable({
      decks: options.decks,
      title: cell ? SITUATION_LABELS[cell.table] : 'Tables',
      view: cell?.table,
      highlight: cell ? { row: cell.row, column: cell.column } : null,
    });
  }

  function pause() {
    if (finished) return;
    shell.clock?.pause();
    // A hand already answered is done with; the next one comes on resume.
    if (advanceTimer.pending) {
      advanceTimer.cancel();
      advanceOnResume = true;
    }
    // Kept for the resume, so the hand is neither skipped nor counted twice.
    held = hand && !advanceOnResume ? { hand, count, answered } : null;
    hand = null;
    changed();
  }

  function resume() {
    if (finished) return;
    shell.clock?.resume();
    if (dealOnResume) {
      dealOnResume = false;
      nextHand();
    } else if (advanceOnResume) {
      advanceOnResume = false;
      advance();
    } else nextHand(held);
    held = null;
  }

  /** Which answers the chosen situations allow. */
  function visibleActions(): Record<Action, boolean> {
    const all = options.hands === 'illustrious18' || options.hands === 'drillErrors';
    return {
      [ACTION.hit]: true,
      [ACTION.stand]: true,
      [ACTION.double]: all || options.situations.hardDouble || options.situations.softDouble,
      [ACTION.split]: all || situations.split,
      [ACTION.surrender]: all || options.situations.surrender,
    };
  }

  /** Redraws the cards and (in the index test) the grid. */
  function draw() {
    if (!els) return;
    const { display, canvas, grid } = els;
    const width = display.clientWidth;
    const height = display.clientHeight;
    if (width < 2 || height < 2) return;
    const ctx = setupCanvas(canvas, width, height);
    ctx.fillStyle = cssVar('--felt', '#008000');
    ctx.fillRect(0, 0, width, height);
    if (hand) drawCards(ctx, hand, width, height);
    if (finished) {
      ctx.fillStyle = cssVar('--felt-text', '#ffffff');
      ctx.font = `40px ${cssVar('--font', 'Helvetica, Arial, sans-serif')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(resultText(), width / 2, height / 2);
    }
    if (indexTest && answerGrid && grid) {
      fitGrid(grid.wrap);
      drawGridIn(answerGrid, grid.canvas, grid.wrap);
    }
  }

  /** Trims the 2:1 grid when its shape would push the cards off the bottom. */
  function fitGrid(gridWrap: HTMLElement) {
    const body = gridWrap.parentElement;
    if (!body) return;
    gridWrap.style.maxHeight = '';
    const over = body.scrollHeight - body.clientHeight;
    if (over > 0) gridWrap.style.maxHeight = `${Math.max(0, gridWrap.clientHeight - over)}px`;
  }

  /** Dealer card top left, the player's hand fanned from the bottom left. */
  function drawCards(ctx: CanvasRenderingContext2D, hand: FlashHand, width: number, height: number) {
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
    hand.cardIds.forEach((id, i) =>
      drawCard(ctx, id, left + i * stepX, bottom - i * stepY, cardWidth, cardHeight, { spanish }),
    );
  }

  let swipeFrom: { x: number; y: number } | null = null;
  const doubleTap = doubleTapDetector();

  function pointerDown(event: CardsPointer) {
    swipeFrom = { x: event.clientX, y: event.clientY };
  }

  /** A swipe or a double tap is an answer: the play the player's mapping (Settings → Gestures) gives it. */
  function pointerUp(event: CardsPointer) {
    if (!swipeFrom || indexTest || silent) return;
    const dx = event.clientX - swipeFrom.x;
    const dy = event.clientY - swipeFrom.y;
    swipeFrom = null;
    const tap = Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_PIXELS;
    const gesture = tap
      ? doubleTap({ x: event.clientX, y: event.clientY, t: event.timeStamp })
        ? 'doubleTap'
        : null
      : swipeOf({ dx, dy, minDistance: MIN_SWIPE_PIXELS });
    if (!gesture) return;
    answer(ACTION[gestureMapFor(k => s.get(k), window.innerHeight > window.innerWidth)[gesture]]);
  }

  loadCardImages().then(changed);

  return {
    shell,
    subscribe: shell.subscribe,
    getSnapshot: snapshotOf(shell, (): FlashView => ({
      shell: shell.getSnapshot(),
      indexTest,
      buttonsShown: !silent && !indexTest,
      visible: visibleActions(),
      correct,
      countPanel: hand ? (indexTest ? SITUATION_LABELS[hand.kind] : `Count: ${count}`) : null,
    })),
    /** The elements to draw in, from the screen; returns the detach. */
    attach(elements: FlashElements) {
      els = elements;
      return () => {
        els = null;
      };
    },
    draw,
    answer,
    gridTap,
    pointerDown,
    pointerUp,
  };
}

export type FlashDrill = ReturnType<typeof createFlashDrill>;
