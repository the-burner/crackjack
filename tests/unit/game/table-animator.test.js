import { describe, it, expect, vi } from 'vitest';
import { planSteps, pauseForSpeed, createAnimator } from '../../../public/src/game/table/animator.js';
import { swipeAction, MIN_SWIPE } from '../../../public/src/game/table/gestures.js';

const PAUSES = { dealer: 500, player: 200, payoff: 700 };
const plan = (events, over = {}) => planSteps(events, { pauses: PAUSES, ...over });

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

describe('planning a timeline', () => {
  it('pauses after each card at the dealer speed', () => {
    const [step] = plan([{ type: 'card', hand: '1-0', card: 5 }]);
    expect(step).toMatchObject({ pause: PAUSES.dealer, sound: 'card' });
  });

  it('deals a computer seat at the other-player speed', () => {
    const [step] = plan([{ type: 'card', hand: '3-0', card: 5 }], { isComputer: key => key === '3-0' });
    expect(step.pause).toBe(PAUSES.player);
  });

  it('pauses on payouts at the payoff speed', () => {
    const [step] = plan([{ type: 'settled', hand: '1-0', result: 'Win' }]);
    expect(step).toMatchObject({ pause: PAUSES.payoff, sound: 'win' });
  });

  it('does not pause on bookkeeping events', () => {
    const steps = plan([{ type: 'roundStart' }, { type: 'turn', hand: '1-0' }, { type: 'clear' }]);
    expect(steps.map(s => s.pause)).toEqual([0, 0, 0]);
  });

  it('plays a sound per event where the original did', () => {
    const sounds = plan([
      { type: 'shuffle' }, { type: 'burn', card: 1 }, { type: 'reveal', hand: '0-0' },
      { type: 'split', hand: '1-0' }, { type: 'settled', result: 'Push' },
      { type: 'settled', result: 'Bust' }, { type: 'message', text: 'Blackjack' },
    ]).map(s => s.sound);
    expect(sounds).toEqual(['shuffle', 'card', 'card', 'card', 'push', 'lose', null]);
  });

  it('keeps the events in order', () => {
    const events = [{ type: 'roundStart' }, { type: 'card', hand: '1-0' }, { type: 'dealt' }];
    expect(plan(events).map(s => s.event)).toEqual(events);
  });
});

describe('running a timeline', () => {
  const harness = () => {
    const steps = [];
    const idle = vi.fn();
    vi.useFakeTimers();
    const animator = createAnimator({ onStep: step => steps.push(step.event.type), onIdle: idle });
    return { steps, idle, animator };
  };

  it('is busy while steps are pending and blocks input until they are done', () => {
    const { steps, idle, animator } = harness();
    animator.play(plan([{ type: 'card', hand: '1-0' }, { type: 'card', hand: '1-0' }]));
    expect(animator.busy).toBe(true);
    expect(steps).toEqual(['card']);
    vi.advanceTimersByTime(PAUSES.dealer);
    expect(steps).toEqual(['card', 'card']);
    expect(animator.busy).toBe(true);
    vi.advanceTimersByTime(PAUSES.dealer);
    expect(animator.busy).toBe(false);
    expect(idle).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('runs steps with no pause back to back', () => {
    const { steps, animator } = harness();
    animator.play(plan([{ type: 'roundStart' }, { type: 'turn', hand: '1-0' }]));
    expect(steps).toEqual(['roundStart', 'turn']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('appends to a timeline that is still playing', () => {
    const { steps, animator } = harness();
    animator.play(plan([{ type: 'card', hand: '1-0' }]));
    animator.play(plan([{ type: 'reveal', hand: '1-0' }]));
    vi.advanceTimersByTime(PAUSES.dealer * 2);
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
    animator.play(plan([{ type: 'card', hand: '1-0' }, { type: 'card', hand: '1-0' }, { type: 'settled', result: 'Win' }]));
    animator.finish();
    expect(steps).toEqual(['card', 'card', 'settled']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });

  it('throws the queue away when cancelled', () => {
    const { steps, animator } = harness();
    animator.play(plan([{ type: 'card', hand: '1-0' }, { type: 'card', hand: '1-0' }]));
    animator.cancel();
    vi.advanceTimersByTime(10000);
    expect(steps).toEqual(['card']);
    expect(animator.busy).toBe(false);
    vi.useRealTimers();
  });
});

describe('swipe gestures', () => {
  it('reads the four straight swipes', () => {
    expect(swipeAction({ dx: 0, dy: 60 })).toBe('hit');
    expect(swipeAction({ dx: -60, dy: 0 })).toBe('stand');
    expect(swipeAction({ dx: 0, dy: -60 })).toBe('double');
    expect(swipeAction({ dx: 60, dy: 0 })).toBe('split');
  });

  it('reads any diagonal as surrender', () => {
    expect(swipeAction({ dx: 50, dy: 50 })).toBe('surrender');
    expect(swipeAction({ dx: -50, dy: 60 })).toBe('surrender');
  });

  it('answers the insurance offer instead', () => {
    expect(swipeAction({ dx: 0, dy: 60, insurance: true })).toBe('insure');
    expect(swipeAction({ dx: 0, dy: -60, insurance: true })).toBe('insure');
    expect(swipeAction({ dx: 60, dy: 0, insurance: true })).toBe('pass');
    expect(swipeAction({ dx: -60, dy: 0, insurance: true })).toBe('pass');
  });

  it('ignores a tap', () => {
    expect(swipeAction({ dx: 0, dy: 0 })).toBe(null);
    expect(swipeAction({ dx: 4, dy: 4 })).toBe(null);
  });

  it('measures the real distance, not x against y', () => {
    // The original compared |x - y| with 30, so these two were judged wrongly.
    expect(swipeAction({ dx: 0, dy: MIN_SWIPE + 1 })).toBe('hit');
    expect(swipeAction({ dx: 25, dy: 0 })).toBe(null);
  });
});
