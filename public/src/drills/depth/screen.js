// Depth drills: a photo of a discard tray, and a grid of depths to pick from.

import { h } from '../../ui/dom.js';
import { setupCanvas } from '../../ui/card-sprites.js';
import { cssVar } from '../../ui/theme.js';
import { drillShell, drillClockFor } from '../shared/drill-screen.js';
import { progressiveSpeed } from '../shared/drill-clock.js';
import { drillStrategy } from '../shared/drill-settings.js';
import { drawGridIn } from '../shared/answer-grid.js';
import { gradeAnswer } from '../shared/scoring.js';
import { loadTrayImage, drawTray } from '../shared/discard-tray.js';
import { depthGrid, generateDepthTest } from './logic.js';

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

  const speed = () => progressiveSpeed(options.seconds, run, options.progressive);

  function start() {
    run += 1;
    previousAnswer = null;
    grid = depthGrid(options);
    drillClockFor(shell, { mode: options.timerMode, limit: speed(), onHalt: finish }).start();
    nextTest();
  }

  function stop() {
    shell.clock?.stop();
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
      shell.setMessage('No tests can be shown with these options.');
      finish();
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
    shell.clock.after('test', speed(), timeout);
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
    if (!test || !grid) return;
    const box = gridCanvas.getBoundingClientRect();
    const cell = grid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
    if (!cell) return;
    shell.clock.cancel('test');
    const verdict = gradeAnswer(cell.value, test.answer, options.accuracy);
    if (verdict === 'correct') {
      grid.mark(cell, 'correct');
      draw();
      app.sound.play('correct');
      setTimeout(advance, PAUSE_AFTER_ANSWER_MS);
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
    if (shell.score.tests >= options.testsPerDrill) finish();
    else nextTest();
  }

  function finish() {
    shell.finish(`Accuracy: ${shell.score.accuracy}%`);
  }

  function pause() {
    shell.clock.pause();
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
        draw();
        return;
      }
      started = true;
      shell.begin();
    },
    destroy: shell.destroy,
  };
}
