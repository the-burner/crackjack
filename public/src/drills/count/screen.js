// Count drills: cards are flashed, then a discard tray and a grid of counts.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
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
import { loadTrayImage, drawTray, trayImage } from '../shared/discard-tray.js';
import {
  flashSize, maxFlashSize, cardsUntilTest, flashRotated, flashLayout, flashPositions,
  countAnswer, halfSteps, answerIndex, isAceCountDrill,
} from './logic.js';

const PAUSE_AFTER_ANSWER_MS = 100;
/** How long the deal waits after the "one card left" warning. */
const END_WARNING_SECONDS = 3;
const WARNING_TEXT = { oneCardLeft: 'One card left', twoCardsLeft: 'Two cards left' };
const WARNING_REMAINING = { oneCardLeft: 1, twoCardsLeft: 2 };

export function countScreen(app) {
  const s = app.settings;
  const options = {
    drill: s.get('drills.count.drill'),
    testEvery: s.get('drills.count.testEvery'),
    accuracy: s.get('drills.count.accuracy'),
    orientation: s.get('drills.count.orientation'),
    positions: s.get('drills.count.positions'),
    cardsPerFlash: s.get('drills.count.cardsPerFlash'),
    bias: s.get('drills.count.bias'),
    endWarning: s.get('drills.count.endWarning'),
    decks: s.get('drills.count.decks'),
    trayStyle: s.get('drills.count.trayStyle'),
    timerMode: s.get('drills.count.timerMode'),
    dealByHand: s.get('drills.count.dealByHand'),
    dealSeconds: s.get('drills.count.dealTenths') / 10,
    testSeconds: s.get('drills.count.testSeconds'),
    alarmSeconds: s.get('drills.count.alarmSeconds'),
    thickness: s.get('drills.count.cardThickness'),
    progressive: s.get('drills.count.progressiveSpeed'),
    twoCounts: s.get('drills.count.twoCounts'),
    ...drillStrategy(app, s.get('drills.count.decks')),
  };
  /** Cards come at the deal speed unless the player deals them with Next. */
  const auto = !options.dealByHand;
  /** Auto mode times each test; Count Down & Halt times the whole drill. */
  const timedTests = options.timerMode === TIMER_MODE.auto;
  const maxCards = maxFlashSize(options.cardsPerFlash);
  const inHalfSteps = halfSteps(options.drill, options.strategy);

  const canvas = h('canvas', { class: 'drill__cards' });
  const gridCanvas = h('canvas', { class: 'drill__answers' });
  const gridWrap = h('div', { class: 'drill__answers-wrap' }, gridCanvas);
  const nextButton = button('Next', { icon: 'forward', hidden: true, onClick: () => { if (!shell.paused) dealFlash(); } });

  let run = -1;
  let shoe = null;
  /** Cards still to deal before the next test. */
  let cardsToDeal = 0;
  let flash = null;
  let tray = null;
  let trayPicture = null;
  let grid = null;
  let gridWindow = INITIAL_WINDOW;
  let correctIndex = null;
  /** With "Two Counts" the true count is asked first, then the drill's own value. */
  let askingTrueCount = false;
  let notice = '';
  let done = false;
  let started = false;
  /** A correct answer came in while paused: deal again on resume. */
  let resumePending = false;

  const shell = drillShell(app, {
    title: 'Count Drills',
    help: 'drills.count',
    countLabel: 'Tests',
    className: 'drill--count drill--grid',
    pausable: true,
    onStart: start,
    onStop: stop,
    onLayout: draw,
    onPause: pause,
    onResume: resume,
  });
  shell.setDisplay(canvas);
  shell.controls.append(nextButton);
  shell.body.append(gridWrap);

  const dealSpeed = () => progressiveSpeed(options.dealSeconds, run, options.progressive);

  function start() {
    run += 1;
    resumePending = false;
    done = false;
    notice = '';
    gridWindow = INITIAL_WINDOW;
    grid = null;
    tray = null;
    flash = null;
    shoe = new DrillShoe({ decks: options.decks, strategy: options.strategy, trueCountSettings: options.trueCountSettings });
    cardsToDeal = cardsUntilTest(options.testEvery, Math.random);
    nextButton.hidden = auto;
    drillClockFor(shell, { mode: options.timerMode, limit: options.alarmSeconds, onHalt: () => finishShoe() }).start();
    if (auto) {
      dealFlash();
      shell.clock.every('deal', dealSpeed(), dealFlash);
    } else {
      draw();
    }
  }

  function stop() {
    shell.clock?.stop();
    nextButton.hidden = true;
    grid = null;
    tray = null;
    flash = null;
    draw();
  }

  /** Tests stop once the aces the drill is about have all been dealt. */
  const testsPossible = () => !(isAceCountDrill(options.drill) && shoe.counter.aces === 4 * options.decks);

  function dealFlash() {
    if (done || !shoe) return;
    notice = '';
    if (cardsToDeal < 1 && testsPossible()) {
      startTest();
      return;
    }
    let cards = flashSize(options.cardsPerFlash, Math.random);
    // The last card is shown on its own, so the warning is not missed.
    if (options.endWarning === 'oneCardLeft' && shoe.remaining === 2) cards = 1;
    cardsToDeal -= cards;
    const ids = [];
    for (let i = 0; i < cards; i++) {
      if (shoe.remaining === 0) {
        finishShoe();
        return;
      }
      shoe.biasNext(options.bias);
      ids.push(shoe.deal());
      if (auto && shoe.remaining === WARNING_REMAINING[options.endWarning]) {
        notice = WARNING_TEXT[options.endWarning];
        shell.clock.every('deal', END_WARNING_SECONDS, dealFlash);
        break;
      }
    }
    tray = null;
    flash = {
      ids,
      rotated: flashRotated(options.orientation, Math.random),
      layout: flashLayout(options.positions, Math.random),
    };
    draw();
  }

  function startTest() {
    shell.clock.cancel('deal');
    askingTrueCount = options.twoCounts;
    showTest();
  }

  /** Shows the tray and the grid, and asks for one count. */
  function showTest() {
    const counts = drillCounts(shoe);
    const value = askingTrueCount ? counts.trueCount : countAnswer(options.drill, counts);
    correctIndex = answerIndex(value, inHalfSteps);
    gridWindow = countWindow(correctIndex, gridWindow);
    grid = countGrid(gridWindow, inHalfSteps ? halfStepLabel : String);
    // One dealt card is not worth a tray photo; keep the card on screen.
    tray = shoe.dealt > 1 ? trayImage(shoe.decksInTray(), options.trayStyle) : null;
    if (tray) {
      trayPicture = loadTrayImage(tray.src);
      if (!trayPicture.complete) trayPicture.addEventListener('load', draw, { once: true });
    }
    shell.score.beginTest();
    nextButton.hidden = true;
    draw();
    shell.updateStats(shell.clock);
    if (timedTests) shell.clock.after('test', options.testSeconds, timeout);
  }

  function timeout() {
    shell.score.recordError();
    app.sound.play('error');
    grid.mark(grid.cellFor(correctIndex), 'correct');
    draw();
    shell.updateStats(shell.clock);
  }

  function tap(event) {
    if (!grid || done || shell.paused) return;
    const box = gridCanvas.getBoundingClientRect();
    const cell = grid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    if (!cell) return;
    shell.clock.cancel('test');
    const verdict = gradeAnswer(cell.value, correctIndex, options.accuracy);
    if (verdict === 'correct') {
      grid.mark(cell, 'correct');
      draw();
      app.sound.play('correct');
      if (askingTrueCount) {
        askingTrueCount = false;
        showTest();
        return;
      }
      setTimeout(resumeDealing, PAUSE_AFTER_ANSWER_MS);
      return;
    }
    grid.mark(cell, verdict === 'close' ? 'close' : 'wrong');
    grid.mark(grid.cellFor(correctIndex), 'correct');
    if (verdict === 'wrong') {
      shell.score.recordError();
      app.sound.play('error');
    }
    draw();
    shell.updateStats(shell.clock);
  }

  function resumeDealing() {
    if (shell.paused) {
      resumePending = true;
      return;
    }
    grid = null;
    tray = null;
    cardsToDeal = cardsUntilTest(options.testEvery, Math.random);
    nextButton.hidden = auto;
    dealFlash();
    if (auto && !done) shell.clock.every('deal', dealSpeed(), dealFlash);
  }

  /** Stops dealing and the test clock, and covers the cards. */
  function pause() {
    shell.clock?.pause();
    draw();
  }

  function resume() {
    shell.clock?.resume();
    if (done) return;
    if (resumePending) {
      resumePending = false;
      resumeDealing();
    } else if (grid) {
      // A test still waiting for its answer gets its full time again.
      if (timedTests && !shell.score.currentTestFailed) shell.clock.after('test', options.testSeconds, timeout);
    } else if (auto) {
      shell.clock.every('deal', dealSpeed(), dealFlash);
    }
    draw();
  }

  function finishShoe() {
    done = true;
    notice = 'Done.';
    grid = null;
    tray = null;
    flash = null;
    shell.finish();
    draw();
  }

  function draw() {
    const width = shell.display.clientWidth;
    const height = shell.display.clientHeight;
    if (width > 2 && height > 2) {
      const ctx = setupCanvas(canvas, width, height);
      ctx.fillStyle = cssVar('--felt', '#008000');
      ctx.fillRect(0, 0, width, height);
      // While paused the felt stays empty, so nothing can be studied.
      if (!shell.paused) {
        if (tray && trayPicture?.complete) drawTray(ctx, trayPicture, { x: 0, y: 0, width, height }, tray.crop, options.thickness);
        else if (flash) drawFlash(ctx, width, height);
      }
      if (notice && !shell.paused) {
        ctx.fillStyle = cssVar('--felt-text', '#ffffff');
        ctx.font = `bold ${notice === 'Done.' ? 32 : 20}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(notice, width / 2, height / 2);
      }
    }
    gridWrap.hidden = !grid || shell.paused;
    if (grid && !shell.paused) drawGridIn(grid, gridCanvas, gridWrap);
  }

  function drawFlash(ctx, width, height) {
    const { cards, cardWidth, cardHeight } = flashPositions({
      layout: flash.layout, rotated: flash.rotated, cards: flash.ids.length, maxCards, width, height,
    });
    ctx.save();
    // A rotated flash is drawn in a space turned a quarter turn clockwise.
    if (flash.rotated) {
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
    }
    cards.forEach((place, i) => drawCard(ctx, flash.ids[i], place.x, place.y, cardWidth, cardHeight));
    ctx.restore();
  }

  gridCanvas.addEventListener('click', tap);
  // In the count-down modes the player deals by tapping the cards as well.
  canvas.addEventListener('click', () => { if (!auto && !grid) dealFlash(); });

  loadCardImages().then(draw);

  return {
    el: shell.el,
    onShow() {
      if (started) {
        draw();
        return;
      }
      started = true;
      shell.begin();
    },
    destroy: shell.destroy,
  };
}
