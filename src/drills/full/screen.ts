// Full table drills: a whole table of hands at once, then a count to give.

import { h } from '../../ui/dom.ts';
import { seededRandom } from '../../core/random.ts';
import { setupCanvas, drawCard, loadCardImages } from '../../ui/card-sprites.ts';
import { cssVar } from '../../ui/theme.ts';
import type { App, Screen } from '../../app/app.ts';
import type { CardId } from '../../core/cards.ts';
import { drillShell, drillClockFor } from '../shared/drill-screen.ts';
import { progressiveSpeed, TIMER_MODE } from '../shared/drill-clock.ts';
import { drillStrategy } from '../shared/drill-settings.ts';
import { DrillShoe } from '../shared/shoe.ts';
import { drillCounts, testsPossible } from '../shared/count-answers.ts';
import { countGrid, countWindow, halfStepLabel, INITIAL_WINDOW } from '../shared/count-grid.ts';
import { drawGridIn } from '../shared/answer-grid.ts';
import type { AnswerGrid } from '../shared/answer-grid.ts';
import { AnswerPause, gridAnswers } from '../shared/grid-answers.ts';
import { END_WARNING_SECONDS, WARNING_REMAINING, WARNING_TEXT } from '../shared/end-warning.ts';
import { halfSteps, answerIndex } from '../count/logic.ts';
import {
  dealRound,
  tableSlots,
  scatterSlots,
  fullAnswer,
  partialView,
  fullyShownLimit,
  fullQuestionDrill,
  asksTwoCounts,
  nextTwoTablePhase,
  TWO_TABLE_PHASES,
  TWO_TABLE_MINIMUM_CARDS,
  SCATTER_CARDS,
} from './logic.ts';
import type { TableHand } from './logic.ts';

type TableColor = readonly [name: string, fallback: string];

/** The cards are taken away just before the test time runs out. */
const TABLE_COLORS: readonly TableColor[] = [
  ['--felt', '#008000'],
  ['--felt-alt', '#000080'],
];

/** One table of hands (or of loose cards) on screen. */
interface Table {
  hands: TableHand[];
  /** The loose cards of the scattered layout, or null. */
  scatter: CardId[] | null;
  /** Seeds the scattered layout, so the cards stay put between redraws. */
  scatterSeed: number;
  /** Two Tables: how much each card moved the running count. */
  countValues: number[][];
  /** Which cards are face up, per hand. */
  visible: boolean[][];
  color: TableColor;
}

const ROTATE_MESSAGE = 'The Full Table Drills need a wide screen. Turn the device sideways, or hit Back.';

export function fullScreen(app: App): Screen {
  const s = app.settings;
  const options = {
    drill: s.get('drills.full.drill'),
    accuracy: s.get('drills.full.accuracy'),
    players: s.get('drills.full.players'),
    handStyle: s.get('drills.full.handStyle'),
    bias: s.get('drills.full.bias'),
    endWarning: s.get('drills.full.endWarning'),
    decks: s.get('drills.full.decks'),
    timerMode: s.get('drills.full.timerMode'),
    flashSpeed: s.get('drills.full.flashSpeed'),
    testSeconds: s.get('drills.full.testSeconds'),
    alarmSeconds: s.get('drills.full.alarmSeconds'),
    progressive: s.get('drills.full.progressiveSpeed'),
    twoCounts: s.get('drills.full.twoCounts'),
    ...drillStrategy(app, s.get('drills.full.decks')),
  };
  /** Auto times each test (and warns near the end of the shoe); Count Down & Halt times the whole drill. */
  const timedTests = options.timerMode === TIMER_MODE.auto;
  const twoTables = options.drill === 'twoTables';
  /** The count this question asks for, and whether that count moves by halves. */
  const questionDrill = () => fullQuestionDrill(options.drill, askingRunningCount);
  const inHalfSteps = () => halfSteps(questionDrill(), options.strategy);

  const canvas = h('canvas', { class: 'drill__cards' });
  const gridCanvas = h('canvas', { class: 'drill__answers' });
  const gridWrap = h('div', { class: 'drill__answers-wrap' }, gridCanvas);
  const cover = h('div', { class: 'drill__cover', hidden: true }, ROTATE_MESSAGE);

  let run = -1;
  /** One shoe normally, two for the Two Tables drill. */
  let shoes: DrillShoe[] = [];
  /** Running counts of the cards revealed so far, per table. */
  let revealedCounts: number[] = [];
  let tables: (Table | null)[] = [];
  let phase = 0;
  let fullyShownUpTo = 0;
  let grid: AnswerGrid | null = null;
  let gridWindow = INITIAL_WINDOW;
  let correctIndex = 0;
  let askingRunningCount = false;
  let notice = '';
  let cardsHidden = false;
  let done = false;
  let pausedByCover = false;
  /** An answer was finished while paused: move on when play resumes. */
  let advancePending = false;
  /** The right answer has been given, so further taps are not graded again. */
  let answered = false;
  /** The wait between a right answer and the next round, so it can be called off. */
  const advanceTimer = new AnswerPause();
  /** The run began behind the cover: deal once the device is turned. */
  let dealPending = false;
  /** Clock times (in elapsed seconds) at which the cards go away and the test ends. */
  let hideAt = 0;
  let testEndsAt = 0;

  const shell = drillShell(app, {
    title: 'Full Table Drills',
    help: 'drills.full',
    countLabel: 'Tests',
    className: 'drill--full',
    pausable: true,
    onStart: start,
    onStop: stop,
    onLayout: layout,
    onPause: pause,
    onResume: resume,
  });
  shell.setDisplay(canvas);
  shell.body.append(gridWrap);
  shell.el.append(cover);
  const answers = gridAnswers({ shell, canvas: gridCanvas, redraw: render, timers: ['test', 'hide'] });

  /** How long the cards stay up; with Progressive Speed, 10% less on each Restart. */
  const flashSeconds = () => progressiveSpeed(options.flashSpeed, run, options.progressive);

  function start() {
    run += 1;
    advancePending = false;
    answered = false;
    done = false;
    notice = '';
    cardsHidden = false;
    gridWindow = INITIAL_WINDOW;
    grid = null;
    phase = 0;
    const shoeCount = twoTables ? 2 : 1;
    shoes = Array.from(
      { length: shoeCount },
      () =>
        new DrillShoe({
          decks: options.decks,
          strategy: options.strategy,
          trueCountSettings: options.trueCountSettings,
        }),
    );
    revealedCounts = shoes.map(shoe => shoe.counter.running);
    tables = shoes.map(() => null);
    const clock = drillClockFor(shell, { mode: options.timerMode, limit: options.alarmSeconds, onHalt: finishShoe });
    clock.start();
    // Nothing is dealt or timed while the turn-sideways cover is up.
    dealPending = pausedByCover;
    if (dealPending) {
      clock.pause();
      return;
    }
    nextRound();
  }

  function stop() {
    shell.clock?.stop();
    advanceTimer.cancel();
    grid = null;
    tables = tables.map(() => null);
    render();
  }

  /**
   * A card source for one round: biases and deals the next card, and remembers
   * what it did to the running count (which Two Tables needs).
   */
  function drawer(shoe: DrillShoe): { draw: () => CardId | null; countValues: number[] } {
    const countValues: number[] = [];
    const draw = () => {
      if (shoe.remaining === 0) return null;
      shoe.biasNext(options.bias);
      const dealt = shoe.dealWithCountValue();
      if (!dealt) return null;
      countValues.push(dealt.countValue);
      return dealt.card;
    };
    return { draw, countValues };
  }

  function nextRound() {
    if (done) return;
    notice = '';
    cardsHidden = false;
    if (twoTables) {
      dealTwoTables();
      return;
    }
    const shoe = shoes[0];
    const stopAt = timedTests ? WARNING_REMAINING[options.endWarning] : undefined;
    let warned = false;
    const { draw: deal } = drawer(shoe);
    const draw = () => {
      if (warned) return null;
      const card = deal();
      if (card !== null && shoe.remaining === stopAt) warned = true;
      return card;
    };
    const { hands, stopped } = dealRound({ players: options.players, handStyle: options.handStyle, draw });
    // The scattered layout has no hands behind the loose cards.
    const scatter = options.handStyle === 'scattered' ? drawScatter(draw) : null;
    tables = [
      {
        hands,
        scatter,
        scatterSeed: Math.floor(Math.random() * 1e9),
        countValues: [],
        visible: hands.map(hand => hand.cards.map(() => true)),
        color: TABLE_COLORS[0],
      },
    ];
    if (warned) {
      // A partial round is not worth a test; show the warning and deal again.
      notice = WARNING_TEXT[options.endWarning] ?? '';
      render();
      shell.clock?.after('deal', END_WARNING_SECONDS, nextRound);
      return;
    }
    if (stopped || (scatter !== null && scatter.length < SCATTER_CARDS) || !testsPossible(options.drill, shoe)) {
      finishShoe();
      return;
    }
    render();
    startTest();
  }

  /** The scattered layout deals loose cards instead of hands. */
  function drawScatter(draw: () => CardId | null): CardId[] {
    const ids: CardId[] = [];
    for (let i = 0; i < SCATTER_CARDS; i++) {
      const card = draw();
      if (card === null) break;
      ids.push(card);
    }
    return ids;
  }

  /** Deals a fresh pair of tables, then starts the four-question cycle. */
  function dealTwoTables() {
    if (shoes.some(shoe => shoe.remaining <= TWO_TABLE_MINIMUM_CARDS)) {
      finishShoe();
      return;
    }
    const pair = shoes.map((shoe, i): Table => {
      const { draw, countValues: dealtValues } = drawer(shoe);
      const { hands } = dealRound({
        players: options.players,
        handStyle: 'twoToFourCards',
        dealerStopsAt16: true,
        draw,
      });
      // Cards are counted as they are revealed, so each one counts exactly once.
      let next = 0;
      const countValues = hands.map(hand => hand.cards.map(() => dealtValues[next++]));
      return {
        hands,
        countValues,
        scatter: null,
        scatterSeed: 0,
        visible: hands.map(hand => hand.cards.map(() => false)),
        color: TABLE_COLORS[i],
      };
    });
    tables = pair;
    fullyShownUpTo = fullyShownLimit(pair[0].hands, Math.random);
    phase = 0;
    revealPhase();
  }

  /** Reveals this phase's cards, counting the newly shown ones. */
  function revealPhase() {
    cardsHidden = false;
    const { table, partial } = TWO_TABLE_PHASES[phase];
    const current = tables[table];
    if (!current) return;
    const wanted = partial
      ? partialView(current.hands, fullyShownUpTo)
      : current.visible.map(row => row.map(() => true));
    current.hands.forEach((hand, h) =>
      hand.cards.forEach((_, c) => {
        if (!wanted[h][c] || current.visible[h][c]) return;
        current.visible[h][c] = true;
        revealedCounts[table] += current.countValues[h][c];
      }),
    );
    correctIndex = answerIndex(revealedCounts[table], inHalfSteps());
    render();
    startTest();
  }

  function startTest() {
    askingRunningCount = asksTwoCounts(options.drill, options.twoCounts);
    showTest();
  }

  /** `sameTest` is the second answer of a Two Counts test: one test, flashed once. */
  function showTest({ sameTest = false }: { sameTest?: boolean } = {}) {
    if (!twoTables) {
      correctIndex = answerIndex(fullAnswer(questionDrill(), drillCounts(shoes[0])), inHalfSteps());
    }
    gridWindow = countWindow(correctIndex, gridWindow);
    grid = countGrid(gridWindow, inHalfSteps() ? halfStepLabel : String);
    answered = false;
    if (!sameTest) shell.score.beginTest();
    render();
    shell.updateStats(shell.clock);
    if (!cardsHidden) armHide(sameTest ? secondsLeft(hideAt) : flashSeconds());
    if (timedTests) armTest(options.testSeconds);
  }

  /** The cards go away when the flash time is up, the test ends when its own time does. */
  function armHide(seconds: number) {
    if (!shell.clock) return;
    hideAt = shell.clock.elapsed + seconds;
    shell.clock.after('hide', seconds, () => {
      cardsHidden = true;
      render();
    });
  }

  function armTest(seconds: number) {
    if (!shell.clock) return;
    testEndsAt = shell.clock.elapsed + seconds;
    shell.clock.after('test', seconds, timeout);
  }

  const secondsLeft = (deadline: number) => Math.max(0, deadline - (shell.clock?.elapsed ?? 0));

  function timeout() {
    if (grid) answers.timeout(grid, correctIndex);
  }

  function tap(event: MouseEvent) {
    if (!grid || done || answered || shell.paused) return;
    if (answers.tap(event, grid, correctIndex, options.accuracy) !== 'correct') return;
    if (askingRunningCount) {
      askingRunningCount = false;
      showTest({ sameTest: true });
      return;
    }
    // One answer, one advance: a second tap within the pause is not graded.
    answered = true;
    advanceTimer.start(advance);
  }

  function advance() {
    if (shell.paused || pausedByCover) {
      advancePending = true;
      return;
    }
    grid = null;
    if (!twoTables) {
      nextRound();
      return;
    }
    phase = nextTwoTablePhase(phase);
    if (phase === 0) nextRound();
    else revealPhase();
  }

  function finishShoe() {
    done = true;
    notice = 'Done.';
    // A test still on screen was never answered, so it does not count.
    if (grid && !answered) shell.score.discardTest();
    grid = null;
    shell.finish();
    render();
    shell.updateStats(shell.clock);
  }

  function layout() {
    const portrait = shell.el.clientHeight > shell.el.clientWidth;
    cover.hidden = !portrait;
    // The clock may not exist yet: the cover can go up before the run begins.
    if (portrait && !pausedByCover) {
      pausedByCover = true;
      shell.clock?.pause();
    } else if (!portrait && pausedByCover) {
      pausedByCover = false;
      if (!shell.paused) {
        shell.clock?.resume();
        if (dealPending) {
          dealPending = false;
          nextRound();
        } else {
          rearm();
        }
      }
    }
    render();
  }

  /** Stops the clock and covers the table. */
  function pause() {
    shell.clock?.pause();
    render();
  }

  function resume() {
    if (pausedByCover) return;
    shell.clock?.resume();
    rearm();
    render();
  }

  /** Pausing cancels the drill's timers; restarts the ones the current state needs. */
  function rearm() {
    if (done || !shell.clock) return;
    if (advancePending) {
      advancePending = false;
      advance();
    } else if (grid) {
      // Only the time that was left, so a pause buys no second look at the cards.
      if (!cardsHidden) armHide(secondsLeft(hideAt));
      if (timedTests && !shell.score.currentTestFailed) armTest(secondsLeft(testEndsAt));
    } else if (notice) {
      shell.clock.after('deal', END_WARNING_SECONDS, nextRound);
    }
  }

  /** Redraws the table and the answer grid. */
  function render() {
    const width = shell.display.clientWidth;
    const height = shell.display.clientHeight;
    if (width > 2 && height > 2) {
      const table = tables.find(t => t) ?? null;
      const shown = twoTables ? tables[TWO_TABLE_PHASES[phase].table] : table;
      const ctx = setupCanvas(canvas, width, height);
      ctx.fillStyle = cssVar(...(shown?.color ?? TABLE_COLORS[0]));
      ctx.fillRect(0, 0, width, height);
      // While paused the table stays empty, so nothing can be studied.
      if (shown && !cardsHidden && !shell.paused) drawTable(ctx, shown, width, height);
      if (notice && !shell.paused) {
        ctx.fillStyle = cssVar('--felt-text', '#ffffff');
        ctx.font = `600 32px ${cssVar('--font', 'Helvetica, Arial, sans-serif')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(notice, width / 2, height / 2);
      }
    }
    gridWrap.hidden = !grid || shell.paused;
    if (grid && !shell.paused) drawGridIn(grid, gridCanvas, gridWrap);
  }

  function drawTable(ctx: CanvasRenderingContext2D, table: Table, width: number, height: number) {
    if (table.scatter) {
      // The same seed every redraw, so the cards do not jump about.
      const { places, cardWidth, cardHeight } = scatterSlots(width, height, seededRandom(table.scatterSeed));
      table.scatter.forEach((id, i) => drawCard(ctx, id, places[i].x, places[i].y, cardWidth, cardHeight));
      return;
    }
    const { spots, cardWidth, cardHeight } = tableSlots(width, height);
    for (const [handIndex, hand] of table.hands.entries()) {
      hand.cards.forEach((id, i) => {
        if (!table.visible[handIndex][i]) return;
        const slot = spots[hand.spot][Math.min(i, spots[hand.spot].length - 1)];
        drawCard(ctx, id, slot.x, slot.y, cardWidth, cardHeight);
      });
    }
  }

  gridCanvas.addEventListener('click', tap);
  loadCardImages().then(render);

  return shell.screen({ redraw: layout, onFirstShow: layout });
}
