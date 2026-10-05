// Full table drills: a whole table of hands at once, then a count to give.

import { h } from '../../ui/dom.js';
import { seededRandom } from '../../core/random.js';
import { setupCanvas, drawCard, loadCardImages } from '../../ui/card-sprites.js';
import { cssVar } from '../../ui/theme.js';
import { drillShell, drillClockFor } from '../shared/drill-screen.js';
import { progressiveSpeed, TIMER_MODE } from '../shared/drill-clock.js';
import { drillStrategy } from '../shared/drill-settings.js';
import { DrillShoe } from '../shared/shoe.js';
import { drillCounts } from '../shared/count-answers.js';
import { countGrid, countWindow, halfStepLabel, INITIAL_WINDOW } from '../shared/count-grid.js';
import { drawGridIn } from '../shared/answer-grid.js';
import { gradeAnswer } from '../shared/scoring.js';
import { halfSteps, answerIndex } from '../count/logic.js';
import {
  dealRound, tableSlots, scatterSlots, fullAnswer, isAceCountDrill, partialView,
  TWO_TABLE_PHASES, TWO_TABLE_MINIMUM_CARDS, SCATTER_CARDS,
} from './logic.js';

const PAUSE_AFTER_ANSWER_MS = 100;
const END_WARNING_SECONDS = 3;
const WARNING_TEXT = { oneCardLeft: 'One card left', twoCardsLeft: 'Two cards left' };
const WARNING_REMAINING = { oneCardLeft: 1, twoCardsLeft: 2 };
/** The cards are taken away just before the test time runs out. */
const TABLE_COLORS = [['--felt', '#008000'], ['--felt-alt', '#000080']];

const ROTATE_MESSAGE = 'The Full Table Drills need a wide screen. Turn the device sideways, or hit Back.';

export function fullScreen(app) {
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
  const inHalfSteps = halfSteps(options.drill === 'twoTables' ? 'runningCount' : options.drill, options.strategy);

  const canvas = h('canvas', { class: 'drill__cards' });
  const gridCanvas = h('canvas', { class: 'drill__answers' });
  const gridWrap = h('div', { class: 'drill__answers-wrap' }, gridCanvas);
  const cover = h('div', { class: 'drill__cover', hidden: true }, ROTATE_MESSAGE);

  let run = -1;
  /** One shoe normally, two for the Two Tables drill. */
  let shoes = [];
  /** Running counts of the cards revealed so far, per table. */
  let revealedCounts = [];
  let tables = [];
  let phase = 0;
  let fullyShownUpTo = 0;
  let grid = null;
  let gridWindow = INITIAL_WINDOW;
  let correctIndex = null;
  let askingRunningCount = false;
  let notice = '';
  let cardsHidden = false;
  let done = false;
  let started = false;
  let pausedByCover = false;
  /** An answer was finished while paused: move on when play resumes. */
  let advancePending = false;

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

  /** How long the cards stay up; with Progressive Speed, 10% less on each Restart. */
  const flashSeconds = () => progressiveSpeed(options.flashSpeed, run, options.progressive);

  function start() {
    run += 1;
    advancePending = false;
    done = false;
    notice = '';
    cardsHidden = false;
    gridWindow = INITIAL_WINDOW;
    grid = null;
    phase = 0;
    const shoeCount = twoTables ? 2 : 1;
    shoes = Array.from({ length: shoeCount }, () => new DrillShoe({
      decks: options.decks, strategy: options.strategy, trueCountSettings: options.trueCountSettings,
    }));
    revealedCounts = shoes.map(shoe => shoe.counter.running);
    tables = shoes.map(() => null);
    drillClockFor(shell, { mode: options.timerMode, limit: options.alarmSeconds, onHalt: finishShoe }).start();
    nextRound();
  }

  function stop() {
    shell.clock?.stop();
    grid = null;
    tables = tables.map(() => null);
    render();
  }

  /**
   * A card source for one round: biases and deals the next card, and remembers
   * what it did to the running count (which Two Tables needs).
   */
  function drawer(shoe) {
    const values = [];
    const draw = () => {
      if (shoe.remaining === 0) return null;
      shoe.biasNext(options.bias);
      const { card, countValue } = shoe.dealWithCountValue();
      values.push(countValue);
      return card;
    };
    draw.countValues = values;
    return draw;
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
    const draw = drawer(shoe);
    const { hands, stopped } = dealRound({
      players: options.players,
      handStyle: options.handStyle,
      draw: () => {
        if (warned) return null;
        const card = draw();
        if (card !== null && shoe.remaining === stopAt) warned = true;
        return card;
      },
    });
    tables = [{
      hands,
      scatter: options.handStyle === 'scattered' ? drawScatter(shoe) : null,
      scatterSeed: Math.floor(Math.random() * 1e9),
      visible: hands.map(hand => hand.cards.map(() => true)),
      color: TABLE_COLORS[0],
    }];
    if (warned) {
      // A partial round is not worth a test; show the warning and deal again.
      notice = WARNING_TEXT[options.endWarning];
      render();
      shell.clock.after('deal', END_WARNING_SECONDS, nextRound);
      return;
    }
    if (stopped || !testsPossible()) {
      finishShoe();
      return;
    }
    render();
    startTest();
  }

  /** The scattered layout deals loose cards instead of hands. */
  function drawScatter(shoe) {
    const draw = drawer(shoe);
    const ids = [];
    for (let i = 0; i < SCATTER_CARDS; i++) {
      const card = draw();
      if (card === null) break;
      ids.push(card);
    }
    return ids;
  }

  const testsPossible = () => !(isAceCountDrill(options.drill) && shoes[0].counter.aces === 4 * options.decks);

  /** Deals a fresh pair of tables, then starts the four-question cycle. */
  function dealTwoTables() {
    if (shoes.some(shoe => shoe.remaining <= TWO_TABLE_MINIMUM_CARDS)) {
      finishShoe();
      return;
    }
    fullyShownUpTo = Math.floor(Math.random() * 2);
    tables = shoes.map((shoe, i) => {
      const draw = drawer(shoe);
      const { hands } = dealRound({
        players: options.players,
        handStyle: 'twoToFourCards',
        dealerStopsAt16: true,
        draw,
      });
      // Cards are counted as they are revealed, so each one counts exactly once.
      let next = 0;
      const countValues = hands.map(hand => hand.cards.map(() => draw.countValues[next++]));
      return { hands, countValues, scatter: null, visible: hands.map(hand => hand.cards.map(() => false)), color: TABLE_COLORS[i] };
    });
    phase = 0;
    revealPhase();
  }

  /** Reveals this phase's cards, counting the newly shown ones. */
  function revealPhase() {
    cardsHidden = false;
    const { table, partial } = TWO_TABLE_PHASES[phase];
    const current = tables[table];
    const wanted = partial ? partialView(current.hands, fullyShownUpTo) : current.visible.map(row => row.map(() => true));
    current.hands.forEach((hand, h) => hand.cards.forEach((_, c) => {
      if (!wanted[h][c] || current.visible[h][c]) return;
      current.visible[h][c] = true;
      revealedCounts[table] += current.countValues[h][c];
    }));
    correctIndex = answerIndex(revealedCounts[table], inHalfSteps);
    render();
    startTest();
  }

  function startTest() {
    askingRunningCount = options.twoCounts && !twoTables;
    showTest();
  }

  function showTest() {
    if (!twoTables) {
      const counts = drillCounts(shoes[0]);
      const value = askingRunningCount ? counts.runningCount : fullAnswer(options.drill, counts);
      correctIndex = answerIndex(value, inHalfSteps);
    }
    gridWindow = countWindow(correctIndex, gridWindow);
    grid = countGrid(gridWindow, inHalfSteps ? halfStepLabel : String);
    shell.score.beginTest();
    render();
    shell.updateStats(shell.clock);
    shell.clock.after('hide', flashSeconds(), () => { cardsHidden = true; render(); });
    if (timedTests) shell.clock.after('test', options.testSeconds, timeout);
  }

  function timeout() {
    shell.score.recordError();
    app.sound.play('error');
    grid.mark(grid.cellFor(correctIndex), 'correct');
    render();
    shell.updateStats(shell.clock);
  }

  function tap(event) {
    if (!grid || done || shell.paused) return;
    const box = gridCanvas.getBoundingClientRect();
    const cell = grid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    if (!cell) return;
    shell.clock.cancel('test');
    shell.clock.cancel('hide');
    const verdict = gradeAnswer(cell.value, correctIndex, options.accuracy);
    if (verdict === 'correct') {
      grid.mark(cell, 'correct');
      render();
      app.sound.play('correct');
      if (askingRunningCount) {
        askingRunningCount = false;
        showTest();
        return;
      }
      setTimeout(advance, PAUSE_AFTER_ANSWER_MS);
      return;
    }
    grid.mark(cell, verdict === 'close' ? 'close' : 'wrong');
    grid.mark(grid.cellFor(correctIndex), 'correct');
    if (verdict === 'wrong') {
      shell.score.recordError();
      app.sound.play('error');
    }
    render();
    shell.updateStats(shell.clock);
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
    phase += 1;
    if (phase < TWO_TABLE_PHASES.length) revealPhase();
    else nextRound();
  }

  function finishShoe() {
    done = true;
    notice = 'Done.';
    grid = null;
    shell.finish();
    render();
  }

  function layout() {
    const portrait = shell.el.clientHeight > shell.el.clientWidth;
    cover.hidden = !portrait;
    if (portrait && shell.clock && !shell.clock.paused) {
      shell.clock.pause();
      pausedByCover = true;
    } else if (!portrait && pausedByCover) {
      pausedByCover = false;
      if (!shell.paused) {
        shell.clock.resume();
        rearm();
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
      if (!cardsHidden) shell.clock.after('hide', flashSeconds(), () => { cardsHidden = true; render(); });
      if (timedTests && !shell.score.currentTestFailed) shell.clock.after('test', options.testSeconds, timeout);
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
        ctx.font = 'bold 32px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(notice, width / 2, height / 2);
      }
    }
    gridWrap.hidden = !grid || shell.paused;
    if (grid && !shell.paused) drawGridIn(grid, gridCanvas, gridWrap);
  }

  function drawTable(ctx, table, width, height) {
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

  return {
    el: shell.el,
    onShow() {
      if (started) {
        shell.resumeIfSuspended();
        layout();
        return;
      }
      started = true;
      layout();
      shell.begin();
    },
    onHide: shell.suspend,
    destroy: shell.destroy,
  };
}
