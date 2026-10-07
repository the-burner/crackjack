// The common shell of a drill play screen: green felt, a display area, the
// stats panel, the Pause / Restart buttons and the opening countdown.
//
// A drill supplies callbacks; the shell owns the layout and the counters.

import { h, replaceChildren } from '../../ui/dom.ts';
import type { Children } from '../../ui/dom.ts';
import { button } from '../../ui/components.ts';
import type { App, Screen } from '../../app/app.ts';
import { DrillScore } from './scoring.ts';
import { DrillClock } from './drill-clock.ts';
import type { TimerMode } from './drill-clock.ts';
import { clockTime } from './format.ts';

export interface DrillShellOptions {
  title: string;
  /** Help topic. */
  help: string;
  /** "Hands" or "Tests". */
  countLabel: string;
  /** Extra class on the screen element. */
  className?: string;
  pausable?: boolean;
  /** Begins a fresh run. */
  onStart: (shell: DrillShell) => void;
  onStop?: (shell: DrillShell) => void;
  /** Called when the size changes. */
  onLayout?: (shell: DrillShell) => void;
  onPause?: (shell: DrillShell) => void;
  onResume?: (shell: DrillShell) => void;
  /** Text of the accuracy cell (the Flash drill hides the accuracy until the end in some test modes). */
  accuracyText?: (score: DrillScore) => string;
  /** Text of the count cell. */
  countText?: (score: DrillScore) => string;
}

/** What `drillShell` builds: the screen element and the run controls a drill drives. */
export interface DrillShell {
  readonly el: HTMLElement;
  readonly app: App;
  readonly score: DrillScore;
  /** The drill's own area, between the title bar and the stats panel. */
  readonly display: HTMLDivElement;
  /** The column holding display, stats and controls; drills append their answer area to it. */
  readonly body: HTMLDivElement;
  /** The Pause / Restart row; drills may add buttons of their own. */
  readonly controls: HTMLDivElement;
  readonly message: HTMLDivElement;
  paused: boolean;
  /** The current run number; used for progressive speed. */
  run: number;
  /** The current run's clock (see `drillClockFor`); null before the first run. */
  clock: DrillClock | null;
  /** Replaces the display area's contents. */
  setDisplay(...children: Children[]): void;
  /** Shows a message under the display area (cleared by `clearMessage`). */
  setMessage(text: string): void;
  clearMessage(): void;
  /** Refreshes the stats panel. */
  updateStats(clock: DrillClock | null): void;
  /** Shows a "2, 1" countdown, then calls `then`. */
  countdown(then: () => void): void;
  /** Runs the opening countdown, then starts the drill. Pause waits for the start, as on Restart. */
  begin(): void;
  start(): void;
  /** Ends the current run and starts a new one after the same countdown as Launch. */
  restart(): void;
  /** Ends the run and shows a closing message. */
  finish(text?: string): void;
  /** Pauses, or resumes after a countdown (the drill stays paused until it ends). */
  togglePause(): void;
  /**
   * Another screen covered the drill (Help, say), so time must stop: the drill
   * pauses as if the player had, and `resumeIfSuspended` picks it back up.
   */
  suspend(): void;
  /** Picks the drill back up after `suspend`, counting down first; returns whether it had been suspended. */
  resumeIfSuspended(): boolean;
  destroy(): void;
  /**
   * The drill's Screen: the first show runs `onFirstShow` and begins the
   * drill; later shows resume a suspended run and call `redraw`.
   */
  screen(o: { redraw: () => void; onFirstShow?: () => void }): Screen;
}

export function drillShell(
  app: App,
  {
    title,
    help,
    countLabel,
    className = '',
    pausable = false,
    onStart,
    onStop,
    onLayout,
    onPause,
    onResume,
    accuracyText = score => `Accuracy: ${score.accuracy}%`,
    countText = score => `${countLabel}: ${score.tests}`,
  }: DrillShellOptions,
): DrillShell {
  const score = new DrillScore();
  /** Paused because another screen covered the drill, rather than by the player. */
  let suspended = false;
  /** What the running countdown will do when it finishes, so it can be restarted. */
  let pendingThen: (() => void) | null = null;
  let countdownTimer: ReturnType<typeof setTimeout> | undefined;
  const display = h('div', { class: 'drill__display' });
  const message = h('div', { class: 'drill__message' });
  const statsCells = {
    count: h('td', {}, countText(score)),
    accuracy: h('td', {}, 'Accuracy: 0%'),
    seconds: h('td', {}, `Time: ${clockTime(0)}`),
    rate: h('td', {}, `${countLabel}/Min: 0`),
  };
  const stats = h(
    'table',
    { class: 'drill__stats' },
    h(
      'tbody',
      {},
      h('tr', {}, statsCells.count, statsCells.accuracy),
      h('tr', {}, statsCells.seconds, statsCells.rate),
    ),
  );
  const controls = h('div', { class: 'drill__controls' });
  // Shown over the drill's own area, not the whole screen.
  const countdown = h('div', { class: 'drill__countdown', hidden: true });

  const pauseButton = pausable ? button('Pause', { icon: 'star', onClick: () => shell.togglePause() }) : null;
  const restartButton = button('Restart', { icon: 'refresh', onClick: () => shell.restart() });
  replaceChildren(controls, pauseButton, restartButton);

  const body = h('div', { class: 'drill__body' }, display, message, stats, controls);
  const el = h(
    'section',
    { class: `screen--felt drill${className ? ` ${className}` : ''}` },
    h(
      'header',
      { class: 'drill__bar' },
      button('Back', { variant: 'nav', onClick: () => app.back(), 'data-action': 'back' }),
      button('Help', { variant: 'nav', onClick: () => app.help(help, title) }),
    ),
    body,
  );
  display.append(countdown);

  let started = false;

  const shell: DrillShell = {
    el,
    app,
    score,
    display,
    body,
    controls,
    message,
    paused: false,
    run: 0,
    clock: null,

    setDisplay(...children) {
      replaceChildren(display, ...children, countdown);
    },

    setMessage(text) {
      message.textContent = text;
    },

    clearMessage() {
      message.textContent = '';
    },

    updateStats(clock) {
      statsCells.count.textContent = countText(score);
      statsCells.accuracy.textContent = accuracyText(score);
      if (clock) {
        const { seconds, overdue } = clock.display();
        statsCells.seconds.textContent = `Time: ${clockTime(seconds)}`;
        statsCells.seconds.classList.toggle('is-overdue', overdue);
        statsCells.rate.textContent = `${countLabel}/Min: ${clock.rate(score.tests)}`;
      }
    },

    countdown(then) {
      clearTimeout(countdownTimer);
      pendingThen = then;
      let remaining = 2;
      countdown.textContent = String(remaining);
      countdown.hidden = false;
      const tick = () => {
        remaining -= 1;
        if (remaining > 0) {
          countdown.textContent = String(remaining);
          countdownTimer = setTimeout(tick, 1000);
          return;
        }
        countdown.hidden = true;
        pendingThen = null;
        then();
      };
      countdownTimer = setTimeout(tick, 1000);
    },

    begin() {
      if (pauseButton) pauseButton.disabled = true;
      shell.countdown(() => shell.start());
    },

    start() {
      clearTimeout(countdownTimer);
      countdown.hidden = true;
      if (pauseButton) pauseButton.disabled = false;
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
      shell.paused = false;
      if (pauseButton) {
        pauseButton.textContent = 'Pause';
        pauseButton.disabled = true;
      }
      shell.countdown(() => shell.start());
    },

    finish(text = '') {
      onStop?.(shell);
      if (pauseButton) pauseButton.disabled = true;
      if (text) shell.setMessage(text);
    },

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

    suspend() {
      if (suspended) return;
      if (pendingThen) {
        clearTimeout(countdownTimer);
        countdown.hidden = true;
        suspended = true;
        return;
      }
      // A drill the player paused, or one that has finished, stays as it is.
      if (!shell.clock?.running || shell.paused) return;
      suspended = true;
      shell.paused = true;
      if (pauseButton) pauseButton.textContent = 'Continue';
      onPause?.(shell);
      shell.updateStats(shell.clock);
    },

    resumeIfSuspended() {
      if (!suspended) return false;
      suspended = false;
      if (pendingThen) shell.countdown(pendingThen);
      else shell.togglePause();
      return true;
    },

    destroy() {
      clearTimeout(countdownTimer);
      onStop?.(shell);
      observer.disconnect();
    },

    screen({ redraw, onFirstShow }) {
      let releaseWakeLock: (() => void) | null = null;
      return {
        el,
        onShow() {
          releaseWakeLock ??= app.wakeLock.hold();
          if (started) {
            shell.resumeIfSuspended();
            redraw();
            return;
          }
          started = true;
          onFirstShow?.();
          shell.begin();
        },
        onHide() {
          releaseWakeLock?.();
          releaseWakeLock = null;
          shell.suspend();
        },
        destroy: () => shell.destroy(),
      };
    },
  };

  const observer = new ResizeObserver(() => onLayout?.(shell));
  observer.observe(display);

  return shell;
}

/**
 * The clock for one run of a drill: ticks the stats panel once a second, beeps
 * at the alarm time and, in "count down and halt" mode, ends the run.
 */
export function drillClockFor(
  shell: DrillShell,
  { mode, limit, onHalt }: { mode: TimerMode; limit: number; onHalt?: () => void },
): DrillClock {
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
