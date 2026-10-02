// The common shell of a drill play screen: green felt, a display area, the
// stats panel, the Pause / Restart buttons and the opening countdown.
//
// A drill supplies callbacks; the shell owns the layout and the counters.

import { h, replaceChildren } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { DrillScore } from './scoring.js';

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.help                 Help topic.
 * @param {string} o.countLabel           "Hands" or "Tests".
 * @param {boolean} [o.pausable]
 * @param {(shell: DrillShell) => void} o.onStart    Begins a fresh run.
 * @param {(shell: DrillShell) => void} [o.onStop]
 * @param {(shell: DrillShell) => void} [o.onLayout] Called when the size changes.
 * @param {(shell: DrillShell) => void} [o.onPause]
 * @param {(shell: DrillShell) => void} [o.onResume]
 */
export function drillShell(app, { title, help, countLabel, pausable = false, onStart, onStop, onLayout, onPause, onResume }) {
  const score = new DrillScore();
  const display = h('div', { class: 'drill__display' });
  const message = h('div', { class: 'drill__message' });
  const statsCells = {
    count: h('td', {}, `${countLabel}: 0`),
    accuracy: h('td', {}, 'Accuracy: 0%'),
    seconds: h('td', {}, 'Seconds: 0'),
    rate: h('td', {}, `${countLabel}/Min: 0`),
  };
  const stats = h('table', { class: 'drill__stats' },
    h('tbody', {}, h('tr', {}, statsCells.count, statsCells.accuracy), h('tr', {}, statsCells.seconds, statsCells.rate)));
  const controls = h('div', { class: 'drill__controls' });
  const countdown = h('div', { class: 'drill__countdown' });

  const pauseButton = pausable ? button('Pause', { icon: 'star', onClick: () => shell.togglePause() }) : null;
  const restartButton = button('Restart', { icon: 'refresh', onClick: () => shell.restart() });
  replaceChildren(controls, pauseButton, restartButton);

  const body = h('div', { class: 'drill__body' }, display, message, stats, controls);
  const el = h('section', { class: 'screen--felt drill' },
    h('header', { class: 'drill__bar' },
      button('Back', { variant: 'nav', onClick: () => app.back() }),
      button('Help', { variant: 'nav', onClick: () => app.help(help) })),
    body, countdown);

  /** @typedef {object} DrillShell */
  const shell = {
    el,
    app,
    score,
    display,
    message,
    paused: false,
    /** The current run number; used for progressive speed. */
    run: 0,

    /** Replaces the display area's contents. */
    setDisplay(...children) {
      replaceChildren(display, ...children);
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
      statsCells.accuracy.textContent = `Accuracy: ${score.accuracy}%`;
      if (clock) {
        const { seconds, overdue } = clock.display();
        statsCells.seconds.textContent = `Seconds: ${seconds}`;
        statsCells.seconds.classList.toggle('is-overdue', overdue);
        statsCells.rate.textContent = `${countLabel}/Min: ${clock.rate(score.tests)}`;
      }
    },

    /** Runs the opening "2, 1" countdown, then starts the drill. */
    begin() {
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
        shell.start();
      };
      shell.countdownTimer = setTimeout(tick, 1000);
    },

    start() {
      score.reset();
      shell.paused = false;
      if (pauseButton) pauseButton.textContent = 'Pause';
      shell.clearMessage();
      onStart(shell);
      shell.updateStats(shell.clock);
    },

    restart() {
      onStop?.(shell);
      shell.run = 0;
      shell.start();
    },

    /** Ends the run and shows a closing message. */
    finish(text = '') {
      onStop?.(shell);
      if (text) shell.setMessage(text);
    },

    togglePause() {
      if (shell.paused) {
        shell.paused = false;
        if (pauseButton) pauseButton.textContent = 'Pause';
        onResume?.(shell);
      } else {
        shell.paused = true;
        if (pauseButton) pauseButton.textContent = 'Continue';
        onPause?.(shell);
      }
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
