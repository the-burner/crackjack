// Timing for a drill run: elapsed seconds, the timer-mode display, the alarm,
// per-test timeouts and repeating intervals — all pausable and cancellable.
//
// Time comes from an injectable clock (seconds), so tests can drive it.

export const TIMER_MODE = { auto: 'auto', countDown: 'countDown', countUp: 'countUp', countDownHalt: 'countDownHalt' };

export class DrillClock {
  /**
   * @param {object} o
   * @param {string} o.mode             A TIMER_MODE.
   * @param {number} o.limit            Count-down/up limit in seconds (the drill's alarm time).
   * @param {() => number} [o.now]      Clock in seconds.
   * @param {(fn: Function, ms: number) => *} [o.setTimer]
   * @param {(id: *) => void} [o.clearTimer]
   * @param {() => void} [o.onTick]     Called once a second while running.
   * @param {() => void} [o.onAlarm]    Called once when the limit is reached.
   * @param {() => void} [o.onHalt]     Called when a count-down-and-halt run ends.
   */
  constructor({ mode, limit, now = () => Date.now() / 1000, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), onTick, onAlarm, onHalt }) {
    this.mode = mode;
    this.limit = limit;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onTick = onTick;
    this.onAlarm = onAlarm;
    this.onHalt = onHalt;
    this.startedAt = null;
    this.paused = false;
    this.alarmed = false;
    this.timers = new Map();
  }

  start() {
    this.stoppedElapsed = null;
    this.startedAt = this.now();
    this.alarmed = false;
    this.paused = false;
    this.scheduleTick();
  }

  /** Seconds since the run started (0 before it starts; frozen once it stops). */
  get elapsed() {
    if (this.startedAt === null) return this.stoppedElapsed ?? 0;
    return Math.max(0, (this.paused ? this.pausedAt : this.now()) - this.startedAt);
  }

  /**
   * Whole seconds for the Time cell, and whether time is up. A count-down never
   * goes below zero: it rounds up (so it reads the full limit at the start and
   * 0 exactly when time runs out) and stays at 0, marked overdue, from then on.
   */
  display() {
    if (this.mode === TIMER_MODE.countDown || this.mode === TIMER_MODE.countDownHalt) {
      const left = this.limit - this.elapsed;
      return { seconds: Math.max(0, Math.ceil(left)), overdue: left <= 0 };
    }
    return { seconds: Math.floor(this.elapsed), overdue: false };
  }

  /** Hands (or tests) per minute, to one decimal place. */
  rate(count) {
    const elapsed = this.elapsed;
    if (elapsed <= 0) return 0;
    return Math.floor((count / (elapsed / 60)) * 10) / 10;
  }

  scheduleTick() {
    this.cancel('tick');
    this.timers.set('tick', this.setTimer(() => {
      if (this.paused) return;
      this.scheduleTick();
      this.onTick?.();
      this.checkAlarm();
    }, 1000));
  }

  checkAlarm() {
    if (this.alarmed) return;
    const elapsed = this.elapsed;
    const reached = this.mode === TIMER_MODE.countUp ? elapsed >= this.limit : this.limit - elapsed < 0;
    if (this.mode === TIMER_MODE.auto || !reached) return;
    this.alarmed = true;
    this.onAlarm?.();
    if (this.mode === TIMER_MODE.countDownHalt) this.onHalt?.();
  }

  /** Runs `fn` after `seconds`, replacing any previous timer with the same name. */
  after(name, seconds, fn) {
    this.cancel(name);
    this.timers.set(name, this.setTimer(() => { this.timers.delete(name); fn(); }, seconds * 1000));
  }

  /** Runs `fn` every `seconds` until cancelled. */
  every(name, seconds, fn) {
    const tick = () => {
      this.timers.set(name, this.setTimer(() => { tick(); fn(); }, seconds * 1000));
    };
    this.cancel(name);
    tick();
  }

  cancel(name) {
    if (this.timers.has(name)) {
      this.clearTimer(this.timers.get(name));
      this.timers.delete(name);
    }
  }

  /** Stops the clock, keeping the elapsed time so it can resume. */
  pause() {
    if (this.paused || this.startedAt === null) return;
    this.paused = true;
    this.pausedAt = this.now();
    [...this.timers.keys()].forEach(name => this.cancel(name));
  }

  /** Resumes, excluding the paused time from the elapsed total. */
  resume() {
    if (!this.paused) return;
    this.startedAt += this.now() - this.pausedAt;
    this.paused = false;
    this.scheduleTick();
  }

  /** Stops the clock; the time it reached stays on display. */
  stop() {
    [...this.timers.keys()].forEach(name => this.cancel(name));
    if (this.startedAt !== null) this.stoppedElapsed = this.elapsed;
    this.startedAt = null;
  }
}

/**
 * Progressive speed: each automatic restart of a run makes it 10% faster.
 * Returns the speed to use for run number `run` (0-based), never below 1.
 */
export function progressiveSpeed(baseSpeed, run, enabled) {
  if (!enabled || run <= 0) return baseSpeed;
  const speed = baseSpeed * 0.9 ** run;
  return speed < 1 ? 1 : speed;
}
