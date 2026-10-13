import { describe, it, expect, vi } from 'vitest';
import { pauseForSpeed, createAnimator } from '@/game/table/animator';
import type { Step } from '@/game/table/animator';
import type { TableEvent } from '@/game/table/table-state';

// The player plays any timeline; what goes into one is choreography.test.ts's concern.
const PAUSE = 200;
/** A timeline of steps, each holding PAUSE (0 for the types listed in `instant`). */
const timeline = (types: string[], instant: string[] = []): Step[] =>
  types.map(type => ({ event: { type } as TableEvent, pause: instant.includes(type) ? 0 : PAUSE, sound: null }));

describe('pause for a speed', () => {
  it('follows the original formula', () => {
    expect(pauseForSpeed(30)).toBe(592);
    expect(pauseForSpeed(100)).toBe(8);
  });

  it('is slower at low speeds', () => {
    expect(pauseForSpeed(1)).toBeGreaterThan(pauseForSpeed(50));
  });

  it('clamps nonsense', () => {
    expect(pauseForSpeed(0)).toBe(pauseForSpeed(1));
    expect(pauseForSpeed(1000)).toBe(pauseForSpeed(100));
  });
});

describe('running a timeline', () => {
  const harness = () => {
    const steps: string[] = [];
    const idle = vi.fn();
    vi.useFakeTimers();
    const animator = createAnimator({ onStep: step => steps.push(step.event.type), onIdle: idle });
    return { steps, idle, animator };
  };

  it('is busy while steps are pending and blocks input until they are done', () => {
    const { steps, idle, animator } = harness();
    animator.play(timeline(['card', 'card']));
    expect(animator.busy).toBe(true);
    expect(steps).toEqual(['card']);
    vi.advanceTimersByTime(PAUSE);
    expect(steps).toEqual(['card', 'card']);
    expect(animator.busy).toBe(true);
    vi.advanceTimersByTime(PAUSE);
    expect(animator.busy).toBe(false);
    expect(idle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('runs steps with no pause back to back', () => {
    const { steps, animator } = harness();
    animator.play(timeline(['roundStart', 'turn'], ['roundStart', 'turn']));
    expect(steps).toEqual(['roundStart', 'turn']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('appends to a timeline that is still playing', () => {
    const { steps, animator } = harness();
    animator.play(timeline(['card']));
    animator.play(timeline(['reveal']));
    vi.advanceTimersByTime(PAUSE * 2);
    expect(steps).toEqual(['card', 'reveal']);
    vi.useRealTimers();
  });

  it('goes idle when given nothing to do', () => {
    const { idle, animator } = harness();
    animator.play([]);
    expect(idle).toHaveBeenCalledTimes(1);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('can finish the rest at once', () => {
    const { steps, animator } = harness();
    animator.play(timeline(['card', 'card', 'settled', 'payout', 'sweep']));
    animator.finish();
    expect(steps).toEqual(['card', 'card', 'settled', 'payout', 'sweep']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('throws the queue away when cancelled', () => {
    const { steps, animator } = harness();
    animator.play(timeline(['card', 'card']));
    animator.cancel();
    vi.advanceTimersByTime(10000);
    expect(steps).toEqual(['card']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('stays quiet when handed nothing while it is already playing', () => {
    const { idle, animator } = harness();
    animator.play(timeline(['card']));
    animator.play([]);
    // The timeline is still running, so this is not the moment to let input back in.
    expect(idle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PAUSE * 2);
    expect(idle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('goes idle when asked to finish with nothing left to play', () => {
    const { steps, idle, animator } = harness();
    animator.finish();
    expect(steps).toEqual([]);
    expect(idle).toHaveBeenCalledTimes(1);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('shrugs off being cancelled when it is doing nothing', () => {
    const { animator } = harness();
    animator.cancel();
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('works without anyone listening for idle', () => {
    const steps: string[] = [];
    const animator = createAnimator({ onStep: step => steps.push(step.event.type) });
    animator.play([]);
    animator.play(timeline(['roundStart'], ['roundStart']));
    animator.finish();
    expect(steps).toEqual(['roundStart']);
    expect(animator.busy).toBe(false);
  });
});
