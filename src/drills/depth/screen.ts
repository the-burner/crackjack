// @ts-nocheck
// Depth drills: a photo of a discard tray, and a grid of depths to pick from.

import { h } from '../../ui/dom.ts';
import { setupCanvas } from '../../ui/card-sprites.ts';
import { cssVar } from '../../ui/theme.ts';
import { drillShell, drillClockFor } from '../shared/drill-screen.ts';
import { progressiveSpeed, TIMER_MODE } from '../shared/drill-clock.ts';
import { drillStrategy } from '../shared/drill-settings.ts';
import { drawGridIn } from '../shared/answer-grid.ts';
import { gradeAnswer } from '../shared/scoring.ts';
import { loadTrayImage, drawTray } from '../shared/discard-tray.ts';
import { depthGrid, generateDepthTest } from './logic.ts';

/** How many draws to try before giving up on finding a usable test. */
const MAX_DRAWS = 200;
const PAUSE_AFTER_ANSWER_MS = 100;

export function depthScreen(app) {
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

  const tray = h('canvas', { class: 'drill__tray' });
  const panel = h('div', { class: 'drill__panel' });
  const gridCanvas = h('canvas', { class: 'drill__answers' });
  const gridWrap = h('div', { class: 'drill__answers-wrap' }, gridCanvas);

  let run = -1;
  let grid = null;
  let test = null;
  let image = null;
  let previousAnswer = null;
  let started = false;
  /** The wait between a right answer and the next test, so it can be called off. */
  let advanceTimer = null;

  const shell = drillShell(app, {
    title: 'Depth Drills',
    help: 'drills.depth',
    countLabel: 'Tests',
    className: 'drill--depth drill--grid',
    pausable: true,
    onStart: start,
    onStop: stop,
    onLayout: draw,
    onPause: pause,
    onResume: resume,
  });
  shell.setDisplay(tray, panel);
  shell.body.append(gridWrap);

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
    cancelAdvance();
    test = null;
    image = null;
    grid?.clearMarks();
    draw();
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
    if (!image.complete) image.addEventListener('load', draw, { once: true });
    grid.clearMarks();
    shell.score.beginTest();
    shell.clearMessage();
    draw();
    shell.updateStats(shell.clock);
    // Only Rounds mode times each test; Count Down & Halt times the whole drill.
    if (rounds) shell.clock.after('test', speed(), timeout);
  }

  /** A timeout shows the answer and counts as an error; the player taps it to go on. */
  function timeout() {
    shell.score.recordError();
    app.sound.play('error');
    grid.mark(grid.cellFor(test.answer), 'correct');
    draw();
    shell.updateStats(shell.clock);
  }

  function tap(event) {
    // Once the answer is in, further taps are ignored until the next test.
    if (!test || !grid || advanceTimer) return;
    const box = gridCanvas.getBoundingClientRect();
    const cell = grid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    if (!cell) return;
    shell.clock.cancel('test');
    const verdict = gradeAnswer(cell.value, test.answer, options.accuracy);
    if (verdict === 'correct') {
      grid.mark(cell, 'correct');
      draw();
      app.sound.play('correct');
      advanceTimer = setTimeout(advance, PAUSE_AFTER_ANSWER_MS);
      return;
    }
    grid.mark(cell, verdict === 'close' ? 'close' : 'wrong');
    grid.mark(grid.cellFor(test.answer), 'correct');
    if (verdict === 'wrong') {
      shell.score.recordError();
      app.sound.play('error');
    }
    draw();
    shell.updateStats(shell.clock);
  }

  function advance() {
    advanceTimer = null;
    if (rounds && shell.score.tests >= options.testsPerDrill) finish();
    else nextTest();
  }

  /** Calls off a test that has not been built yet (on Pause, Back or Restart). */
  function cancelAdvance() {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  function finish() {
    shell.finish(`Accuracy: ${shell.score.accuracy}%`);
  }

  function pause() {
    shell.clock.pause();
    cancelAdvance();
    shell.score.discardTest();
    test = null;
    image = null;
    draw();
  }

  function resume() {
    shell.clock.resume();
    nextTest();
  }

  function draw() {
    const width = shell.display.clientWidth;
    const height = shell.display.clientHeight;
    if (width > 2 && height > 2) {
      const ctx = setupCanvas(tray, width, height);
      ctx.fillStyle = cssVar('--felt', '#008000');
      ctx.fillRect(0, 0, width, height);
      if (test && image?.complete) {
        const top = panel.clientHeight;
        drawTray(ctx, image, { x: 0, y: top, width, height: height - top }, test.tray.crop, options.thickness);
      }
    }
    panel.textContent = test?.panel ?? '';
    if (grid) drawGridIn(grid, gridCanvas, gridWrap);
  }

  gridCanvas.addEventListener('click', tap);

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
