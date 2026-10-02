// Playing engine events back at the user's chosen speeds.
//
// The engine runs to completion and reports what happened; this turns that list
// into a timeline of steps with a pause and a sound each, and plays it one step
// at a time. Input is blocked while a timeline is playing (the original let a
// tap land in the middle of an animation and corrupt the queue).

/** Speeds are 1..100; the original turned one into a pause of (101-s)/120 s. */
export const pauseForSpeed = speed => Math.round(((101 - clampSpeed(speed)) / 120) * 1000);

const clampSpeed = speed => Math.min(100, Math.max(1, Number(speed) || 1));

/** Sounds played for a settled hand, by result. */
const RESULT_SOUNDS = { Win: 'win', '21': 'win', Bonus: 'win', Lose: 'lose', Bust: 'lose', Surrender: 'lose', Push: 'push' };

/** Events that only change what is on screen, with no pause of their own. */
const INSTANT = new Set(['roundStart', 'dealt', 'offerInsurance', 'insuranceTaken', 'insuranceDeclined', 'turn', 'action', 'dealerTurn', 'clear']);

/**
 * Turns engine events into timeline steps.
 * @param {object[]} events
 * @param {object} o
 * @param {{dealer: number, player: number, payoff: number}} o.pauses  In milliseconds.
 * @param {(handKey: string) => boolean} [o.isComputer]  Seats that play themselves are dealt at their own speed.
 * @returns {{event: object, pause: number, sound: string|null}[]}
 */
export function planSteps(events, { pauses, isComputer = () => false }) {
  return events.map(event => ({ event, pause: pauseFor(event, pauses, isComputer), sound: soundFor(event) }));
}

function pauseFor(event, pauses, isComputer) {
  if (INSTANT.has(event.type)) return 0;
  switch (event.type) {
    case 'card':
    case 'reveal':
      return isComputer(event.hand) ? pauses.player : pauses.dealer;
    case 'shuffle':
    case 'burn':
    case 'split':
    case 'double':
      return pauses.dealer;
    default:
      return pauses.payoff;
  }
}

function soundFor(event) {
  switch (event.type) {
    case 'card':
    case 'reveal':
    case 'burn':
    case 'split':
      return 'card';
    case 'shuffle':
      return 'shuffle';
    case 'settled':
      return RESULT_SOUNDS[event.result] ?? null;
    default:
      return null;
  }
}

/**
 * Plays timelines one step at a time.
 *
 * `onStep` applies a step to the screen; `onIdle` runs when the queue empties,
 * which is when the screen may accept input again.
 * @param {object} o
 * @param {(step: object) => void} o.onStep
 * @param {() => void} [o.onIdle]
 * @param {(fn: () => void, ms: number) => *} [o.schedule]  Injected for tests.
 * @param {(handle: *) => void} [o.unschedule]
 */
export function createAnimator({ onStep, onIdle, schedule = setTimeout, unschedule = clearTimeout }) {
  let queue = [];
  let timer = null;
  let playing = false;

  const runNext = () => {
    timer = null;
    if (queue.length === 0) {
      playing = false;
      onIdle?.();
      return;
    }
    const step = queue.shift();
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
    play(steps) {
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
      while (queue.length > 0) onStep(queue.shift());
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
