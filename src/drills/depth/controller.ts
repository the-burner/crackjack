// Depth drills: a photo of a discard tray, and a grid of depths to pick from.
// The run and the drawing; the screen component renders around it.

import { setupCanvas } from '@/ui/card-sprites';
import { cssVar } from '@/ui/theme';
import { DrillShell, drillClockFor, snapshotOf } from '@/drills/shared/drill-shell';
import type { DrillShellView } from '@/drills/shared/drill-shell';
import { progressiveSpeed, TIMER_MODE } from '@/drills/shared/drill-clock';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { drawGridIn } from '@/drills/shared/answer-grid';
import type { AnswerGrid } from '@/drills/shared/answer-grid';
import { AnswerPause, gridAnswers } from '@/drills/shared/grid-answers';
import type { GridTap } from '@/drills/shared/grid-answers';
import { loadTrayImage, drawTray } from '@/drills/shared/discard-tray';
import type { App } from '@/app/app';
import { depthGrid, generateDepthTest } from './logic';
import type { DepthTest } from './logic';

/** How many draws to try before giving up on finding a usable test. */
const MAX_DRAWS = 200;

export interface DepthElements {
  display: HTMLElement;
  tray: HTMLCanvasElement;
  panel: HTMLElement;
  gridCanvas: HTMLCanvasElement;
  gridWrap: HTMLElement;
}

export interface DepthView {
  shell: DrillShellView;
  /** The line above the tray. */
  panel: string;
}

export function createDepthDrill(app: App) {
  const s = app.settings;
  const options = {
    drill: s.get('drills.depth.drill'),
    accuracy: s.get('drills.depth.accuracy'),
    resolution: s.get('drills.depth.resolution'),
    decks: s.get('drills.depth.decks'),
    trayStyle: s.get('drills.depth.trayStyle'),
    timerMode: s.get('drills.depth.timerMode'),
    testsPerDrill: s.get('drills.depth.testsPerDrill'),
    seconds: s.get('drills.depth.seconds'),
    drillSeconds: s.get('drills.depth.drillSeconds'),
    thickness: s.get('drills.depth.cardThickness'),
    countRange: { min: s.get('drills.depth.countRangeMin'), max: s.get('drills.depth.countRangeMax') },
    askInTray: s.get('drills.depth.askCardsInTray'),
    progressive: s.get('drills.depth.progressiveSpeed'),
    ...drillStrategy(app, s.get('drills.depth.decks')),
  };

  let els: DepthElements | null = null;
  let run = -1;
  let grid: AnswerGrid | null = null;
  let test: DepthTest | null = null;
  let image: HTMLImageElement | null = null;
  let previousAnswer: number | null = null;
  /** The wait between a right answer and the next test, so it can be called off. */
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

  const rounds = options.timerMode === TIMER_MODE.auto;
  /** Seconds per test (Rounds mode); with Progressive Speed, 10% less on each Restart. */
  const speed = () => progressiveSpeed(options.seconds, run, options.progressive);

  function start() {
    run += 1;
    previousAnswer = null;
    grid = depthGrid(options);
    drillClockFor(shell, { mode: options.timerMode, limit: options.drillSeconds, onHalt: finish }).start();
    nextTest();
  }

  function stop() {
    shell.clock?.stop();
    // Calls off a test that has not been built yet.
    advanceTimer.cancel();
    test = null;
    image = null;
    grid?.clearMarks();
    changed();
  }

  function nextTest() {
    test = null;
    for (let attempt = 0; attempt < MAX_DRAWS; attempt++) {
      test = generateDepthTest({ ...options, previousAnswer, random: Math.random });
      if (test) break;
    }
    if (!test) {
      // Said in place of the accuracy, which finish() would otherwise show.
      shell.finish('No tests can be shown with these options.');
      return;
    }
    previousAnswer = test.answer;
    image = loadTrayImage(test.tray.src);
    if (!image.complete) image.addEventListener('load', changed, { once: true });
    grid?.clearMarks();
    shell.score.beginTest();
    shell.clearMessage();
    shell.updateStats(shell.clock);
    // Only Rounds mode times each test; Count Down & Halt times the whole drill.
    if (rounds) shell.clock?.after('test', speed(), timeout);
  }

  /** A timeout shows the answer and counts as an error; the player taps it to go on. */
  function timeout() {
    if (grid && test) answers.timeout(grid, test.answer);
  }

  function tap(event: GridTap) {
    // Once the answer is in, further taps are ignored until the next test.
    if (!test || !grid || advanceTimer.pending) return;
    if (answers.tap(event, grid, test.answer, options.accuracy) === 'correct') advanceTimer.start(advance);
  }

  function advance() {
    if (rounds && shell.score.tests >= options.testsPerDrill) finish();
    else nextTest();
  }

  function finish() {
    shell.finish(`Accuracy: ${shell.score.accuracy}%`);
  }

  function pause() {
    shell.clock?.pause();
    advanceTimer.cancel();
    shell.score.discardTest();
    test = null;
    image = null;
    changed();
  }

  function resume() {
    shell.clock?.resume();
    nextTest();
  }

  function draw() {
    if (!els) return;
    const { display, tray, panel, gridCanvas, gridWrap } = els;
    const width = display.clientWidth;
    const height = display.clientHeight;
    if (width > 2 && height > 2) {
      const ctx = setupCanvas(tray, width, height);
      ctx.fillStyle = cssVar('--felt', '#008000');
      ctx.fillRect(0, 0, width, height);
      if (test && image?.complete) {
        const top = panel.clientHeight;
        drawTray(ctx, image, { x: 0, y: top, width, height: height - top }, test.tray.crop, options.thickness);
      }
    }
    if (grid) drawGridIn(grid, gridCanvas, gridWrap);
  }

  return {
    shell,
    subscribe: shell.subscribe,
    getSnapshot: snapshotOf(shell, (): DepthView => ({ shell: shell.getSnapshot(), panel: test?.panel ?? '' })),
    /** The elements to draw in, from the screen; returns the detach. */
    attach(elements: DepthElements) {
      els = elements;
      return () => {
        els = null;
      };
    },
    draw,
    tap,
  };
}

export type DepthDrill = ReturnType<typeof createDepthDrill>;
