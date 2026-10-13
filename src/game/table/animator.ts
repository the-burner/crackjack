// Playing a timeline (see choreography.ts) one step at a time, at the user's chosen speeds.
// Input is blocked while a timeline is playing, so a tap cannot land in the middle of an
// animation and corrupt the queue.

import type { TableEvent } from './table-state';
import type { Result } from '@/game/engine/settlement';
import type { SoundName } from '@/services/sound';

/** Speeds are 1..100; speed s is a pause of (101-s)/120 s. */
export const pauseForSpeed = (speed: number): number => Math.round(((101 - clampSpeed(speed)) / 120) * 1000);

const clampSpeed = (speed: number) => Math.min(100, Math.max(1, Number(speed) || 1));

/**
 * The original's tone for a result: the colour on the chips and the sound
 * played as a settled hand is swept.
 */
export const RESULT_TONES: Partial<Record<Result, 'win' | 'lose' | 'push'>> = {
  Win: 'win',
  21: 'win',
  Bonus: 'win',
  Lose: 'lose',
  Bust: 'lose',
  Surrender: 'lose',
  Push: 'push',
};

/** Pauses in milliseconds. */
export interface Pauses {
  dealer: number;
  player: number;
  payoff: number;
}

/** One step of a timeline: an event, the pause after it and its sound. */
export interface Step {
  event: TableEvent;
  pause: number;
  sound: SoundName | null;
}

/**
 * Plays timelines one step at a time.
 *
 * `onStep` applies a step to the screen; `onIdle` runs when the queue empties,
 * which is when the screen may accept input again.
 * @param schedule  Injected for tests.
 */
export function createAnimator({
  onStep,
  onIdle,
  schedule = setTimeout,
  unschedule = clearTimeout,
}: {
  onStep: (step: Step) => void;
  onIdle?: () => void;
  schedule?: (fn: () => void, ms: number) => number;
  unschedule?: (handle: number) => void;
}) {
  let queue: Step[] = [];
  let timer: number | null = null;
  let playing = false;

  const runNext = () => {
    timer = null;
    const step = queue.shift();
    if (!step) {
      playing = false;
      onIdle?.();
      return;
    }
    onStep(step);
    if (step.pause > 0) {
      timer = schedule(runNext, step.pause);
      return;
    }
    runNext();
  };

  return {
    /** True while steps are still being played: the screen must ignore input. */
    get busy() {
      return playing;
    },

    /** Adds steps to the queue and starts playing if it was idle. */
    play(steps: Step[]) {
      if (steps.length === 0) {
        if (!playing) onIdle?.();
        return;
      }
      queue.push(...steps);
      if (playing) return;
      playing = true;
      runNext();
    },

    /** Plays every remaining step at once, without pauses. */
    finish() {
      if (timer !== null) unschedule(timer);
      timer = null;
      for (let step = queue.shift(); step; step = queue.shift()) onStep(step);
      playing = false;
      onIdle?.();
    },

    /** Throws the queue away (leaving the table). */
    cancel() {
      if (timer !== null) unschedule(timer);
      timer = null;
      queue = [];
      playing = false;
    },
  };
}
