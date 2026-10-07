// The run controls every drill play screen shares: the score, the clock, the
// stats panel's figures, Pause / Restart and the opening "2, 1" countdown.
//
// DOM-free: a drill drives it through callbacks, and the <DrillScreen>
// component renders its snapshot (subscribe / getSnapshot).

import type { App } from '@/app/app';
import { DrillScore } from './scoring';
import { DrillClock } from './drill-clock';
import type { TimerMode } from './drill-clock';
import { clockTime } from './format';

export interface DrillShellOptions {
  /** "Hands" or "Tests". */
  countLabel: string;
  pausable?: boolean;
  /** Begins a fresh run. */
  onStart: (shell: DrillShell) => void;
  onStop?: (shell: DrillShell) => void;
  onPause?: (shell: DrillShell) => void;
  onResume?: (shell: DrillShell) => void;
  /** Called on every show: before the first run begins, and after a suspended run resumes. */
  onShow?: (shell: DrillShell) => void;
  /** Text of the accuracy cell (the Flash drill hides the accuracy until the end in some test modes). */
  accuracyText?: (score: DrillScore) => string;
  /** Text of the count cell. */
  countText?: (score: DrillScore) => string;
}

export interface DrillStats {
  count: string;
  accuracy: string;
  time: string;
  /** Time is up on a count-down. */
  overdue: boolean;
  rate: string;
}

/** What the shell shows. */
export interface DrillShellView {
  /** The countdown's number, or null when none is running. */
  countdown: number | null;
  message: string;
  stats: DrillStats;
  pausable: boolean;
  pauseLabel: 'Pause' | 'Continue';
  pauseDisabled: boolean;
}

export class DrillShell {
  readonly app: App;
  readonly score = new DrillScore();
  paused = false;
  /** The current run number; used for progressive speed. */
  run = 0;
  /** The current run's clock (see `drillClockFor`); null before the first run. */
  clock: DrillClock | null = null;
  /** Bumped on every change; drills cache their snapshots on it. */
  version = 0;

  private readonly options: DrillShellOptions;
  private readonly accuracyText: (score: DrillScore) => string;
  private readonly countText: (score: DrillScore) => string;
  private readonly listeners = new Set<() => void>();
  private message = '';
  private countdownValue: number | null = null;
  private stats: DrillStats;
  private pauseLabel: DrillShellView['pauseLabel'] = 'Pause';
  private pauseDisabled = false;
  private started = false;
  /** Paused because another screen covered the drill, rather than by the player. */
  private suspended = false;
  /** What the running countdown will do when it finishes, so it can be restarted. */
  private pendingThen: (() => void) | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | undefined;
  private view: DrillShellView | null = null;
  private viewVersion = -1;

  constructor(app: App, options: DrillShellOptions) {
    this.app = app;
    this.options = options;
    this.accuracyText = options.accuracyText ?? (score => `Accuracy: ${score.accuracy}%`);
    this.countText = options.countText ?? (score => `${options.countLabel}: ${score.tests}`);
    this.stats = {
      count: this.countText(this.score),
      accuracy: 'Accuracy: 0%',
      time: `Time: ${clockTime(0)}`,
      overdue: false,
      rate: `${options.countLabel}/Min: 0`,
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): DrillShellView => {
    if (!this.view || this.viewVersion !== this.version) {
      this.viewVersion = this.version;
      this.view = {
        countdown: this.countdownValue,
        message: this.message,
        stats: this.stats,
        pausable: this.options.pausable ?? false,
        pauseLabel: this.pauseLabel,
        pauseDisabled: this.pauseDisabled,
      };
    }
    return this.view;
  };

  /** Something on screen changed: re-renders and redraws. */
  changed(): void {
    this.version += 1;
    this.listeners.forEach(listener => listener());
  }

  /** Shows a message under the display area (cleared by `clearMessage`). */
  setMessage(text: string): void {
    this.message = text;
    this.changed();
  }

  clearMessage(): void {
    this.setMessage('');
  }

  /** Refreshes the stats panel. */
  updateStats(clock: DrillClock | null): void {
    const stats = { ...this.stats, count: this.countText(this.score), accuracy: this.accuracyText(this.score) };
    if (clock) {
      const { seconds, overdue } = clock.display();
      stats.time = `Time: ${clockTime(seconds)}`;
      stats.overdue = overdue;
      stats.rate = `${this.options.countLabel}/Min: ${clock.rate(this.score.tests)}`;
    }
    this.stats = stats;
    this.changed();
  }

  private setPause(label: DrillShellView['pauseLabel'], disabled = this.pauseDisabled): void {
    this.pauseLabel = label;
    this.pauseDisabled = disabled;
  }

  /** Shows a "2, 1" countdown, then calls `then`. */
  countdown(then: () => void): void {
    clearTimeout(this.countdownTimer);
    this.pendingThen = then;
    this.countdownValue = 2;
    const tick = () => {
      const remaining = (this.countdownValue ?? 1) - 1;
      if (remaining > 0) {
        this.countdownValue = remaining;
        this.changed();
        this.countdownTimer = setTimeout(tick, 1000);
        return;
      }
      this.countdownValue = null;
      this.pendingThen = null;
      this.changed();
      then();
    };
    this.countdownTimer = setTimeout(tick, 1000);
    this.changed();
  }

  /** Runs the opening countdown, then starts the drill. Pause waits for the start, as on Restart. */
  begin(): void {
    this.pauseDisabled = true;
    this.countdown(() => this.start());
  }

  start(): void {
    clearTimeout(this.countdownTimer);
    this.countdownValue = null;
    this.score.reset();
    this.paused = false;
    this.setPause('Pause', false);
    this.clearMessage();
    this.options.onStart(this);
    this.updateStats(this.clock);
  }

  /** Ends the current run and starts a new one after the same countdown as Launch. */
  restart(): void {
    this.options.onStop?.(this);
    this.run = 0;
    this.paused = false;
    this.setPause('Pause', true);
    this.countdown(() => this.start());
  }

  /** Ends the run and shows a closing message. */
  finish(text = ''): void {
    this.options.onStop?.(this);
    this.pauseDisabled = true;
    if (text) this.setMessage(text);
    else this.changed();
  }

  /** Pauses, or resumes after a countdown (the drill stays paused until it ends). */
  togglePause(): void {
    if (this.paused) {
      this.pauseDisabled = true;
      this.countdown(() => {
        this.paused = false;
        this.setPause('Pause', false);
        this.options.onResume?.(this);
        this.updateStats(this.clock);
      });
      return;
    }
    this.paused = true;
    this.setPause('Continue');
    this.options.onPause?.(this);
    this.updateStats(this.clock);
  }

  /**
   * Another screen covered the drill (Help, say), so time must stop: the drill
   * pauses as if the player had, and `resumeIfSuspended` picks it back up.
   */
  suspend(): void {
    if (this.suspended) return;
    if (this.pendingThen) {
      clearTimeout(this.countdownTimer);
      this.countdownValue = null;
      this.suspended = true;
      this.changed();
      return;
    }
    // A drill the player paused, or one that has finished, stays as it is.
    if (!this.clock?.running || this.paused) return;
    this.suspended = true;
    this.paused = true;
    this.setPause('Continue');
    this.options.onPause?.(this);
    this.updateStats(this.clock);
  }

  /** Picks the drill back up after `suspend`, counting down first; returns whether it had been suspended. */
  resumeIfSuspended(): boolean {
    if (!this.suspended) return false;
    this.suspended = false;
    if (this.pendingThen) this.countdown(this.pendingThen);
    else this.togglePause();
    return true;
  }

  /** The screen came to the top: the first show begins the drill, later ones resume a suspended run. */
  show(): void {
    if (this.started) {
      this.resumeIfSuspended();
      this.options.onShow?.(this);
      this.changed();
      return;
    }
    this.started = true;
    this.options.onShow?.(this);
    this.begin();
  }

  /** Another screen covered the drill, or it is closing. */
  hide(): void {
    this.suspend();
  }

  destroy(): void {
    clearTimeout(this.countdownTimer);
    this.options.onStop?.(this);
  }
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

/** A snapshot built by `build`, rebuilt only after the shell changed. */
export function snapshotOf<T>(shell: DrillShell, build: () => T): () => T {
  let version = -1;
  let value: T | undefined;
  return () => {
    if (value === undefined || version !== shell.version) {
      version = shell.version;
      value = build();
    }
    return value;
  };
}
