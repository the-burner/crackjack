// Pausing an endless drill every so often: when the next pause is due (in drill
// time, so time spent paused does not count), and what the interval just ended
// came to.

/** The interval in progress: when it ends, and the totals it started from. */
export interface AutoPause {
  /** Seconds between pauses. */
  interval: number;
  /** Drill time (seconds) at which the next pause is due. */
  dueAt: number;
  /** The run's tests and errors when the interval began. */
  tests: number;
  errors: number;
}

export const startAutoPause = (interval: number): AutoPause => ({ interval, dueAt: interval, tests: 0, errors: 0 });

export const autoPauseDue = (pause: AutoPause, elapsed: number): boolean => elapsed >= pause.dueAt;

/**
 * The time left in the interval, as the Time cell counts it down: rounded up,
 * so it reads the full interval as it starts, and 0 (overdue) from when it is up.
 */
export function intervalLeft(pause: AutoPause, elapsed: number): { seconds: number; overdue: boolean } {
  const left = pause.dueAt - elapsed;
  return { seconds: Math.max(0, Math.ceil(left)), overdue: left <= 0 };
}

/** "3:00", or "1:05:00" for an hour or more. */
export function intervalTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Takes the pause that is due: the message summing up the interval just ended
 * ("3:00 done: 54 hands, 96%") and the interval that begins on Continue.
 * @param score  The run's totals now.
 */
export function takeAutoPause(
  pause: AutoPause,
  elapsed: number,
  score: { tests: number; errors: number },
): { message: string; next: AutoPause } {
  const tests = score.tests - pause.tests;
  const errors = score.errors - pause.errors;
  const accuracy = tests === 0 ? 0 : Math.floor(100 * (1 - errors / tests));
  const hands = `${tests} hand${tests === 1 ? '' : 's'}`;
  return {
    message: `${intervalTime(pause.interval)} done: ${hands}, ${accuracy}%`,
    next: { ...pause, dueAt: elapsed + pause.interval, tests: score.tests, errors: score.errors },
  };
}
