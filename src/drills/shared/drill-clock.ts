// Timing for a drill run: elapsed seconds, the timer-mode display, the alarm,
// per-test timeouts and repeating intervals — all pausable and cancellable.
//
// Time comes from an injectable clock (seconds), so tests can drive it.

export const TIMER_MODE = {
  auto: 'auto',
  countDown: 'countDown',
  countUp: 'countUp',
  countDownHalt: 'countDownHalt',
  infinite: 'infinite',
} as const;
export type TimerMode = (typeof TIMER_MODE)[keyof typeof TIMER_MODE];

/** Whatever `setTimer` returns, handed back to `clearTimer`. */
type TimerId = ReturnType<typeof setTimeout>;

export interface DrillClockOptions {
  mode: TimerMode;
  /** Count-down/up limit in seconds (the drill's alarm time). */
  limit: number;
  /** Clock in seconds. */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerId;
  clearTimer?: (id: TimerId) => void;
  /** Called once a second while running. */
  onTick?: () => void;
  /** Called once when the limit is reached. */
  onAlarm?: () => void;
  /** Called when a count-down-and-halt run ends. */
  onHalt?: () => void;
}

export class DrillClock {
  mode: TimerMode;
  limit: number;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => TimerId;
  clearTimer: (id: TimerId) => void;
  onTick?: () => void;
  onAlarm?: () => void;
  onHalt?: () => void;
  startedAt: number | null = null;
  pausedAt = 0;
  stoppedElapsed: number | null = null;
  paused = false;
  alarmed = false;
  timers = new Map<string, TimerId>();

  constructor({
    mode,
    limit,
    now = () => Date.now() / 1000,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = id => clearTimeout(id),
    onTick,
    onAlarm,
    onHalt,
  }: DrillClockOptions) {
    this.mode = mode;
    this.limit = limit;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onTick = onTick;
    this.onAlarm = onAlarm;
    this.onHalt = onHalt;
  }

  start(): void {
    this.stoppedElapsed = null;
    this.startedAt = this.now();
    this.alarmed = false;
    this.paused = false;
    this.scheduleTick();
  }

  /** Whether time is passing: started, not paused and not stopped. */
  get running(): boolean {
    return this.startedAt !== null && !this.paused;
  }

  /** Seconds since the run started (0 before it starts; frozen once it stops). */
  get elapsed(): number {
    if (this.startedAt === null) return this.stoppedElapsed ?? 0;
    return Math.max(0, (this.paused ? this.pausedAt : this.now()) - this.startedAt);
  }

  /**
   * Whole seconds for the Time cell, and whether time is up. A count-down never
   * goes below zero: it rounds up (so it reads the full limit at the start and
   * 0 exactly when time runs out) and stays at 0, marked overdue, from then on.
   */
  display(): { seconds: number; overdue: boolean } {
    if (this.mode === TIMER_MODE.countDown || this.mode === TIMER_MODE.countDownHalt) {
      const left = this.limit - this.elapsed;
      return { seconds: Math.max(0, Math.ceil(left)), overdue: left <= 0 };
    }
    return { seconds: Math.floor(this.elapsed), overdue: false };
  }

  /** Hands (or tests) per minute, to one decimal place. */
  rate(count: number): number {
    const elapsed = this.elapsed;
    // Under a second the figure is meaningless, and absurdly large.
    if (elapsed < 1) return 0;
    return Math.floor((count / (elapsed / 60)) * 10) / 10;
  }

  scheduleTick(): void {
    this.cancel('tick');
    this.timers.set(
      'tick',
      this.setTimer(() => {
        if (this.paused) return;
        this.scheduleTick();
        this.onTick?.();
        this.checkAlarm();
      }, 1000),
    );
  }

  checkAlarm(): void {
    if (this.alarmed) return;
    const elapsed = this.elapsed;
    const reached = this.mode === TIMER_MODE.countUp ? elapsed >= this.limit : this.limit - elapsed < 0;
    // Auto and Infinite count up with no limit to reach.
    if (this.mode === TIMER_MODE.auto || this.mode === TIMER_MODE.infinite || !reached) return;
    this.alarmed = true;
    this.onAlarm?.();
    if (this.mode === TIMER_MODE.countDownHalt) this.onHalt?.();
  }

  /** Runs `fn` after `seconds`, replacing any previous timer with the same name. */
  after(name: string, seconds: number, fn: () => void): void {
    this.cancel(name);
    // A stopped clock's run is over; a late call must not start it again.
    if (this.startedAt === null) return;
    this.timers.set(
      name,
      this.setTimer(() => {
        this.timers.delete(name);
        fn();
      }, seconds * 1000),
    );
  }

  /** Runs `fn` every `seconds` until cancelled. */
  every(name: string, seconds: number, fn: () => void): void {
    const tick = () => {
      this.timers.set(
        name,
        this.setTimer(() => {
          tick();
          fn();
        }, seconds * 1000),
      );
    };
    this.cancel(name);
    if (this.startedAt === null) return;
    tick();
  }

  cancel(name: string): void {
    const id = this.timers.get(name);
    if (id === undefined) return;
    this.clearTimer(id);
    this.timers.delete(name);
  }

  /** Stops the clock, keeping the elapsed time so it can resume. */
  pause(): void {
    if (this.paused || this.startedAt === null) return;
    this.paused = true;
    this.pausedAt = this.now();
    [...this.timers.keys()].forEach(name => this.cancel(name));
  }

  /** Resumes, excluding the paused time from the elapsed total. */
  resume(): void {
    if (!this.paused) return;
    this.startedAt = (this.startedAt ?? 0) + this.now() - this.pausedAt;
    this.paused = false;
    this.scheduleTick();
  }

  /** Stops the clock; the time it reached stays on display. */
  stop(): void {
    [...this.timers.keys()].forEach(name => this.cancel(name));
    if (this.startedAt !== null) this.stoppedElapsed = this.elapsed;
    this.startedAt = null;
  }
}

/**
 * Progressive speed: each automatic restart of a run makes it 10% faster.
 * Returns the speed to use for run number `run` (0-based), never below 1.
 */
export function progressiveSpeed(baseSpeed: number, run: number, enabled: boolean): number {
  if (!enabled || run <= 0) return baseSpeed;
  const speed = baseSpeed * 0.9 ** run;
  return speed < 1 ? 1 : speed;
}
