// Scoring shared by the drills: counters, accuracy, and how close an answer
// has to be to count as correct.

export const ACCURACY = { exact: 0, withinOne: 1, withinTwo: 2 } as const;

export type Verdict = 'correct' | 'close' | 'wrong';

/** Running totals for one drill run. */
export class DrillScore {
  tests = 0;
  errors = 0;
  /** True once the current test has been marked wrong, so it only counts once. */
  currentTestFailed = false;

  reset(): void {
    this.tests = 0;
    this.errors = 0;
    this.currentTestFailed = false;
  }

  /** Starts a new test. */
  beginTest(): void {
    this.tests += 1;
    this.currentTestFailed = false;
  }

  /** Records a wrong answer for the current test (at most one error per test). */
  recordError(): boolean {
    if (this.currentTestFailed) return false;
    this.currentTestFailed = true;
    this.errors += 1;
    return true;
  }

  /** Discards the test in progress (used when a paused test is thrown away). */
  discardTest(): void {
    if (this.tests > 0) this.tests -= 1;
    if (this.currentTestFailed) {
      this.errors -= 1;
      this.currentTestFailed = false;
    }
  }

  /** Percentage of tests answered without an error, rounded down. */
  get accuracy(): number {
    if (this.tests === 0) return 0;
    return Math.floor(100 * (1 - this.errors / this.tests));
  }
}

/**
 * How a tapped answer compares with the correct one.
 * `tolerance` is an ACCURACY value: answers within 1 (or 2) steps are accepted
 * as "close" — shown in yellow, not counted as an error, but the correct answer
 * still has to be given.
 */
export function gradeAnswer(answerIndex: number, correctIndex: number, tolerance: number): Verdict {
  if (answerIndex === correctIndex) return 'correct';
  const distance = Math.abs(answerIndex - correctIndex);
  if (tolerance === ACCURACY.withinOne && distance === 1) return 'close';
  if (tolerance === ACCURACY.withinTwo && distance <= 2) return 'close';
  return 'wrong';
}
