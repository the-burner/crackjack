// The common shell of a drill play screen: green felt, a display area, the
// stats panel, the Pause / Restart buttons and the opening countdown.
//
// A drill supplies callbacks; the shell owns the layout and the counters.

import { h, replaceChildren } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { DrillScore } from './scoring.js';
import { DrillClock } from './drill-clock.js';
import { clockTime } from './format.js';

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.help                 Help topic.
 * @param {string} o.countLabel           "Hands" or "Tests".
 * @param {string} [o.className]          Extra class on the screen element.
 * @param {boolean} [o.pausable]
 * @param {(shell: DrillShell) => void} o.onStart    Begins a fresh run.
 * @param {(shell: DrillShell) => void} [o.onStop]
 * @param {(shell: DrillShell) => void} [o.onLayout] Called when the size changes.
 * @param {(shell: DrillShell) => void} [o.onPause]
 * @param {(shell: DrillShell) => void} [o.onResume]
 * @param {(score: DrillScore) => string} [o.accuracyText]  Text of the accuracy cell
 *   (the Flash drill hides the accuracy until the end in some test modes).
 */
export function drillShell(app, { title, help, countLabel, className = '', pausable = false, onStart, onStop, onLayout, onPause, onResume, accuracyText = score => `Accuracy: ${score.accuracy}%` }) {
  const score = new DrillScore();
  const display = h('div', { class: 'drill__display' });
  const message = h('div', { class: 'drill__message' });
  const statsCells = {
    count: h('td', {}, `${countLabel}: 0`),
    accuracy: h('td', {}, 'Accuracy: 0%'),
    seconds: h('td', {}, `Time: ${clockTime(0)}`),
    rate: h('td', {}, `${countLabel}/Min: 0`),
  };
  const stats = h('table', { class: 'drill__stats' },
    h('tbody', {}, h('tr', {}, statsCells.count, statsCells.accuracy), h('tr', {}, statsCells.seconds, statsCells.rate)));
  const controls = h('div', { class: 'drill__controls' });
  // Shown over the drill's own area, not the whole screen.
  const countdown = h('div', { class: 'drill__countdown', hidden: true });

  const pauseButton = pausable ? button('Pause', { icon: 'star', onClick: () => shell.togglePause() }) : null;
  const restartButton = button('Restart', { icon: 'refresh', onClick: () => shell.restart() });
  replaceChildren(controls, pauseButton, restartButton);

  const body = h('div', { class: 'drill__body' }, display, message, stats, controls);
  const el = h('section', { class: `screen--felt drill${className ? ` ${className}` : ''}` },
    h('header', { class: 'drill__bar' },
      button('Back', { variant: 'nav', onClick: () => app.back(), 'data-action': 'back' }),
      button('Help', { variant: 'nav', onClick: () => app.help(help, title) })),
    body);
  display.append(countdown);

  /** @typedef {object} DrillShell */
  const shell = {
    el,
    app,
    score,
    /** The drill's own area, between the title bar and the stats panel. */
    display,
    /** The column holding display, stats and controls; drills append their answer area to it. */
    body,
    /** The Pause / Restart row; drills may add buttons of their own. */
    controls,
    message,
    paused: false,
    /** The current run number; used for progressive speed. */
    run: 0,

    /** Replaces the display area's contents. */
    setDisplay(...children) {
      replaceChildren(display, ...children, countdown);
    },

    /** Shows a message under the display area (cleared by `clearMessage`). */
    setMessage(text) {
      message.textContent = text;
    },

    clearMessage() {
      message.textContent = '';
    },

    /** Refreshes the stats panel. `clock` is a DrillClock. */
    updateStats(clock) {
      statsCells.count.textContent = `${countLabel}: ${score.tests}`;
      statsCells.accuracy.textContent = accuracyText(score);
      if (clock) {
        const { seconds, overdue } = clock.display();
        statsCells.seconds.textContent = `Time: ${clockTime(seconds)}`;
        statsCells.seconds.classList.toggle('is-overdue', overdue);
        statsCells.rate.textContent = `${countLabel}/Min: ${clock.rate(score.tests)}`;
      }
    },

    /** Shows a "2, 1" countdown, then calls `then`. */
    countdown(then) {
      clearTimeout(shell.countdownTimer);
      let remaining = 2;
      countdown.textContent = String(remaining);
      countdown.hidden = false;
      const tick = () => {
        remaining -= 1;
        if (remaining > 0) {
          countdown.textContent = String(remaining);
          shell.countdownTimer = setTimeout(tick, 1000);
          return;
        }
        countdown.hidden = true;
        then();
      };
      shell.countdownTimer = setTimeout(tick, 1000);
    },

    /** Runs the opening countdown, then starts the drill. Pause waits for the start, as on Restart. */
    begin() {
      if (pauseButton) pauseButton.disabled = true;
      shell.countdown(() => shell.start());
    },

    start() {
      clearTimeout(shell.countdownTimer);
      countdown.hidden = true;
      if (pauseButton) pauseButton.disabled = false;
      score.reset();
      shell.paused = false;
      if (pauseButton) pauseButton.textContent = 'Pause';
      shell.clearMessage();
      onStart(shell);
      shell.updateStats(shell.clock);
    },

    /** Ends the current run and starts a new one after the same countdown as Launch. */
    restart() {
      onStop?.(shell);
      shell.run = 0;
      shell.paused = false;
      if (pauseButton) {
        pauseButton.textContent = 'Pause';
        pauseButton.disabled = true;
      }
      shell.countdown(() => shell.start());
    },

    /** Ends the run and shows a closing message. */
    finish(text = '') {
      onStop?.(shell);
      if (text) shell.setMessage(text);
    },

    /** Pauses, or resumes after a countdown (the drill stays paused until it ends). */
    togglePause() {
      if (shell.paused) {
        if (pauseButton) pauseButton.disabled = true;
        shell.countdown(() => {
          shell.paused = false;
          if (pauseButton) {
            pauseButton.textContent = 'Pause';
            pauseButton.disabled = false;
          }
          onResume?.(shell);
          shell.updateStats(shell.clock);
        });
        return;
      }
      shell.paused = true;
      if (pauseButton) pauseButton.textContent = 'Continue';
      onPause?.(shell);
      shell.updateStats(shell.clock);
    },

    destroy() {
      clearTimeout(shell.countdownTimer);
      onStop?.(shell);
      observer.disconnect();
    },
  };

  const observer = new ResizeObserver(() => onLayout?.(shell));
  observer.observe(display);

  return shell;
}

/**
 * The clock for one run of a drill: ticks the stats panel once a second, beeps
 * at the alarm time and, in "count down and halt" mode, ends the run.
 * @param {DrillShell} shell
 * @param {{mode: string, limit: number, onHalt?: () => void}} o
 */
export function drillClockFor(shell, { mode, limit, onHalt }) {
  const clock = new DrillClock({
    mode,
    limit,
    onTick: () => shell.updateStats(clock),
    onAlarm: () => shell.app.sound.play('alarm'),
    onHalt: () => onHalt?.(),
  });
  shell.clock = clock;
  return clock;
}
