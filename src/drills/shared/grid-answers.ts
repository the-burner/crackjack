// Answering on an answer grid: finding the tapped cell, grading it, marking
// the grid, and the short pause before the next test.

import type { AnswerGrid, GridCell } from './answer-grid';
import type { DrillShell } from './drill-shell';
import { gradeAnswer } from './scoring';
import type { Verdict } from './scoring';

/** How long a right answer stays marked before the drill moves on. */
export const PAUSE_AFTER_ANSWER_MS = 100;

/** The wait between a right answer and the next test, so it can be called off. */
export class AnswerPause {
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Whether a right answer is waiting to move on. */
  get pending(): boolean {
    return this.timer !== null;
  }

  start(then: () => void): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      then();
    }, PAUSE_AFTER_ANSWER_MS);
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** A click on a grid's canvas (`currentTarget`). */
export interface GridTap {
  clientX: number;
  clientY: number;
  currentTarget: Element;
}

/** The grid cell under a click on the grid's canvas, or null. */
export function cellAtEvent(grid: AnswerGrid, event: GridTap): GridCell | null {
  const box = event.currentTarget.getBoundingClientRect();
  return grid.cellAt(event.clientX - box.left, event.clientY - box.top, box.width, box.height);
}

export interface GridAnswersOptions {
  shell: DrillShell;
  redraw: () => void;
  /** Clock timers a tap on a cell calls off. */
  timers: readonly string[];
}

/** Grading for a drill whose answers are given on an answer grid (Depth, Count, Full). */
export function gridAnswers({ shell, redraw, timers }: GridAnswersOptions) {
  const wrong = () => {
    shell.score.recordError();
    shell.app.sound.play('error');
  };
  return {
    /**
     * Grades a tap: a right answer is marked and chimes; a close or wrong one
     * is marked with the right one beside it, and a wrong one is an error.
     * @returns the verdict, or null when the tap was on no cell.
     */
    tap(event: GridTap, grid: AnswerGrid, correct: number, tolerance: number): Verdict | null {
      const cell = cellAtEvent(grid, event);
      if (!cell) return null;
      for (const name of timers) shell.clock?.cancel(name);
      const verdict = gradeAnswer(cell.value, correct, tolerance);
      if (verdict === 'correct') {
        grid.mark(cell, 'correct');
        redraw();
        shell.app.sound.play('correct');
        return verdict;
      }
      grid.mark(cell, verdict);
      grid.mark(grid.cellFor(correct), 'correct');
      if (verdict === 'wrong') wrong();
      redraw();
      shell.updateStats(shell.clock);
      return verdict;
    },

    /** The test ran out of time: an error, with the right answer shown. */
    timeout(grid: AnswerGrid, correct: number): void {
      wrong();
      grid.mark(grid.cellFor(correct), 'correct');
      redraw();
      shell.updateStats(shell.clock);
    },
  };
}
