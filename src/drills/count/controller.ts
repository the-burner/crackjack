// Count drills: cards are flashed, then a discard tray and a grid of counts.
// The run and the drawing; the screen component renders around it.

import { setupCanvas, drawCard, loadCardImages } from '@/ui/card-sprites';
import { cssVar } from '@/ui/theme';
import type { App } from '@/app/app';
import type { CardId } from '@/core/cards';
import { DrillShell, drillClockFor, snapshotOf } from '@/drills/shared/drill-shell';
import type { DrillShellView } from '@/drills/shared/drill-shell';
import { progressiveSpeed, TIMER_MODE } from '@/drills/shared/drill-clock';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { DrillShoe } from '@/drills/shared/shoe';
import { drillCounts, testsPossible } from '@/drills/shared/count-answers';
import { countGrid, countWindow, halfStepLabel, INITIAL_WINDOW } from '@/drills/shared/count-grid';
import { drawGridIn } from '@/drills/shared/answer-grid';
import type { AnswerGrid } from '@/drills/shared/answer-grid';
import { AnswerPause, gridAnswers } from '@/drills/shared/grid-answers';
import type { GridTap } from '@/drills/shared/grid-answers';
import { END_WARNING_SECONDS, WARNING_REMAINING, WARNING_TEXT } from '@/drills/shared/end-warning';
import { loadTrayImage, drawTray, trayImage } from '@/drills/shared/discard-tray';
import type { TrayPhoto } from '@/drills/shared/discard-tray';
import {
  flashSize,
  maxFlashSize,
  cardsUntilTest,
  flashRotated,
  flashLayout,
  flashPositions,
  countAnswer,
  halfSteps,
  answerIndex,
} from './logic';
import type { FlashLayout } from './logic';

/** One group of cards on the felt. */
interface Flash {
  ids: CardId[];
  rotated: boolean;
  layout: FlashLayout;
}

export interface CountElements {
  display: HTMLElement;
  canvas: HTMLCanvasElement;
  gridCanvas: HTMLCanvasElement;
  gridWrap: HTMLElement;
}

export interface CountView {
  shell: DrillShellView;
  /** The answer grid is up (a test, not paused). */
  gridShown: boolean;
  /** The player deals with Next. */
  nextShown: boolean;
}

export function createCountDrill(app: App) {
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

  let els: CountElements | null = null;
  let run = -1;
  let shoe: DrillShoe | null = null;
  /** Cards still to deal before the next test. */
  let cardsToDeal = 0;
  let flash: Flash | null = null;
  let tray: TrayPhoto | null = null;
  let trayPicture: HTMLImageElement | null = null;
  let grid: AnswerGrid | null = null;
  let gridWindow = INITIAL_WINDOW;
  let correctIndex = 0;
  /** With "Two Counts" the true count is asked first, then the drill's own value. */
  let askingTrueCount = false;
  let notice = '';
  let done = false;
  let nextShown = false;
  /** A correct answer came in while paused: deal again on resume. */
  let resumePending = false;
  /** The wait between a right answer and the next deal, so it can be called off. */
  const advanceTimer = new AnswerPause();

  const shell = new DrillShell(app, {
    countLabel: 'Tests',
    pausable: true,
    onStart: start,
    onStop: stop,
    onPause: pause,
    onResume: resume,
  });
  const changed = () => shell.changed();
  const answers = gridAnswers({ shell, redraw: changed, timers: ['test'] });

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
    shoe = new DrillShoe({
      decks: options.decks,
      strategy: options.strategy,
      trueCountSettings: options.trueCountSettings,
    });
    cardsToDeal = cardsUntilTest(options.testEvery, Math.random);
    nextShown = !auto;
    const clock = drillClockFor(shell, {
      mode: options.timerMode,
      limit: options.alarmSeconds,
      onHalt: () => finishShoe(),
    });
    clock.start();
    if (auto) {
      dealFlash();
      clock.every('deal', dealSpeed(), dealFlash);
    } else {
      changed();
    }
  }

  function stop() {
    shell.clock?.stop();
    advanceTimer.cancel();
    nextShown = false;
    grid = null;
    tray = null;
    flash = null;
    changed();
  }

  function dealFlash() {
    if (done || !shoe) return;
    notice = '';
    if (cardsToDeal < 1 && testsPossible(options.drill, shoe)) {
      startTest();
      return;
    }
    let cards = flashSize(options.cardsPerFlash, Math.random);
    // The last card is shown on its own, so the warning is not missed.
    if (options.endWarning === 'oneCardLeft' && shoe.remaining === 2) cards = 1;
    cardsToDeal -= cards;
    const ids: CardId[] = [];
    for (let i = 0; i < cards && shoe.remaining > 0; i++) {
      shoe.biasNext(options.bias);
      const card = shoe.deal();
      if (card !== null) ids.push(card);
      if (auto && shoe.remaining === WARNING_REMAINING[options.endWarning]) {
        notice = WARNING_TEXT[options.endWarning] ?? '';
        shell.clock?.every('deal', END_WARNING_SECONDS, dealFlash);
        break;
      }
    }
    // The shoe only ends once the cards it had left have been shown.
    if (!ids.length) {
      finishShoe();
      return;
    }
    tray = null;
    flash = {
      ids,
      rotated: flashRotated(options.orientation, Math.random),
      layout: flashLayout(options.positions, Math.random),
    };
    changed();
  }

  function startTest() {
    shell.clock?.cancel('deal');
    askingTrueCount = options.twoCounts;
    showTest();
  }

  /** Shows the tray and the grid, and asks for one count. */
  function showTest() {
    if (!shoe) return;
    const counts = drillCounts(shoe);
    const value = askingTrueCount ? counts.trueCount : countAnswer(options.drill, counts);
    correctIndex = answerIndex(value, inHalfSteps);
    gridWindow = countWindow(correctIndex, gridWindow);
    grid = countGrid(gridWindow, inHalfSteps ? halfStepLabel : String);
    // One dealt card is not worth a tray photo; keep the card on screen.
    tray = shoe.dealt > 1 ? trayImage(shoe.decksInTray(), options.trayStyle) : null;
    // Anything deeper than the last photo has none, but the cards must still be
    // covered, or the answer can be read off them.
    if (shoe.dealt > 1) flash = null;
    if (tray) {
      trayPicture = loadTrayImage(tray.src);
      if (!trayPicture.complete) trayPicture.addEventListener('load', changed, { once: true });
    }
    shell.score.beginTest();
    nextShown = false;
    shell.updateStats(shell.clock);
    if (timedTests) shell.clock?.after('test', options.testSeconds, timeout);
  }

  function timeout() {
    if (grid) answers.timeout(grid, correctIndex);
  }

  function tap(event: GridTap) {
    // Once the answer is in, further taps are ignored until the next deal.
    if (!grid || done || shell.paused || advanceTimer.pending) return;
    if (answers.tap(event, grid, correctIndex, options.accuracy) !== 'correct') return;
    if (askingTrueCount) {
      askingTrueCount = false;
      showTest();
      return;
    }
    advanceTimer.start(resumeDealing);
  }

  function resumeDealing() {
    if (shell.paused) {
      resumePending = true;
      return;
    }
    grid = null;
    tray = null;
    cardsToDeal = cardsUntilTest(options.testEvery, Math.random);
    nextShown = !auto;
    dealFlash();
    if (auto && !done) shell.clock?.every('deal', dealSpeed(), dealFlash);
    changed();
  }

  /** Stops dealing and the test clock, and covers the cards. */
  function pause() {
    shell.clock?.pause();
    changed();
  }

  function resume() {
    shell.clock?.resume();
    if (done) return;
    if (resumePending) {
      resumePending = false;
      resumeDealing();
    } else if (grid) {
      // A test still waiting for its answer gets its full time again.
      if (timedTests && !shell.score.currentTestFailed) shell.clock?.after('test', options.testSeconds, timeout);
    } else if (auto) {
      shell.clock?.every('deal', dealSpeed(), dealFlash);
    }
    changed();
  }

  function finishShoe() {
    done = true;
    notice = 'Done.';
    grid = null;
    tray = null;
    flash = null;
    shell.finish();
  }

  /** Next, or a tap on the cards in the deal-by-hand modes. */
  function next() {
    if (!shell.paused) dealFlash();
  }

  function tapCards() {
    // In the count-down modes the player deals by tapping the cards as well.
    if (!auto && !grid) dealFlash();
  }

  function draw() {
    if (!els) return;
    const { display, canvas, gridCanvas, gridWrap } = els;
    const width = display.clientWidth;
    const height = display.clientHeight;
    if (width > 2 && height > 2) {
      const ctx = setupCanvas(canvas, width, height);
      ctx.fillStyle = cssVar('--felt', '#008000');
      ctx.fillRect(0, 0, width, height);
      // While paused the felt stays empty, so nothing can be studied.
      if (!shell.paused) {
        if (tray && trayPicture?.complete)
          drawTray(ctx, trayPicture, { x: 0, y: 0, width, height }, tray.crop, options.thickness);
        else if (flash) drawFlash(ctx, width, height);
      }
      if (notice && !shell.paused) {
        const size = notice === 'Done.' ? 32 : 20;
        ctx.font = `600 ${size}px ${cssVar('--font', 'Helvetica, Arial, sans-serif')}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // On a plate of felt, so a warning over the cards can be read.
        const plate = { width: ctx.measureText(notice).width + size, height: size * 2 };
        ctx.fillStyle = cssVar('--felt', '#008000');
        ctx.fillRect((width - plate.width) / 2, (height - plate.height) / 2, plate.width, plate.height);
        ctx.fillStyle = cssVar('--felt-text', '#ffffff');
        ctx.fillText(notice, width / 2, height / 2);
      }
    }
    if (grid && !shell.paused) drawGridIn(grid, gridCanvas, gridWrap);
  }

  function drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!flash) return;
    const { ids } = flash;
    const { cards, cardWidth, cardHeight } = flashPositions({
      layout: flash.layout,
      rotated: flash.rotated,
      cards: flash.ids.length,
      maxCards,
      width,
      height,
    });
    ctx.save();
    // A rotated flash is drawn in a space turned a quarter turn clockwise.
    if (flash.rotated) {
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
    }
    cards.forEach((place, i) => drawCard(ctx, ids[i], place.x, place.y, cardWidth, cardHeight));
    ctx.restore();
  }

  loadCardImages().then(changed);

  return {
    shell,
    subscribe: shell.subscribe,
    getSnapshot: snapshotOf(shell, (): CountView => ({
      shell: shell.getSnapshot(),
      gridShown: !!grid && !shell.paused,
      nextShown,
    })),
    /** The elements to draw in, from the screen; returns the detach. */
    attach(elements: CountElements) {
      els = elements;
      return () => {
        els = null;
      };
    },
    draw,
    tap,
    next,
    tapCards,
  };
}

export type CountDrill = ReturnType<typeof createCountDrill>;
