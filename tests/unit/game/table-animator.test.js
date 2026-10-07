import { describe, it, expect, vi } from 'vitest';
import { planSteps, pauseForSpeed, createAnimator } from '../../../src/game/table/animator.js';
import { swipeAction, MIN_SWIPE } from '../../../src/game/table/gestures.js';

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
  it('deals the whole round at the dealer speed, every seat alike', () => {
    const steps = plan([
      { type: 'card', hand: '1-0', card: 5, cardIndex: 0 },
      { type: 'card', hand: '3-0', card: 6, cardIndex: 0 },
      { type: 'card', hand: '0-0', card: 7, faceUp: true, cardIndex: 0 },
      { type: 'dealt', upcard: 7 },
    ], { isComputer: key => key === '3-0' });
    expect(steps.filter(s => s.event.type === 'card').map(s => s.pause)).toEqual([PAUSES.dealer, PAUSES.dealer, PAUSES.dealer]);
  });

  it('draws a card in play at the other-player speed, whoever holds the hand', () => {
    expect(plan([{ type: 'card', hand: '1-0', card: 5 }])[0]).toMatchObject({ pause: PAUSES.player, sound: 'card' });
    expect(plan([{ type: 'card', hand: '3-0', card: 5 }], { isComputer: key => key === '3-0' })[0].pause).toBe(PAUSES.player);
  });

  it('plays the dealer out at the dealer speed', () => {
    const steps = plan([{ type: 'dealerTurn' }, { type: 'reveal', hand: '0-0', cardIndex: 1 }, { type: 'card', hand: '0-0', card: 5 }]);
    expect(steps.slice(1).map(s => s.pause)).toEqual([PAUSES.dealer, PAUSES.dealer]);
  });

  it('pauses on a split or a double at the other-player speed', () => {
    expect(plan([{ type: 'split', hand: '1-0' }])[0].pause).toBe(PAUSES.player);
    expect(plan([{ type: 'double', hand: '1-0' }])[0].pause).toBe(PAUSES.player);
  });

  it('pays a hand as the original did: the result, what it paid, then the sweep', () => {
    const steps = plan([{ type: 'settled', hand: '1-0', result: 'Win', payout: 20 }]);
    expect(steps.map(s => [s.event.type, s.pause, s.sound])).toEqual([
      ['settled', PAUSES.payoff, null],
      ['payout', Math.round(PAUSES.payoff * 0.15), null],
      ['sweep', PAUSES.payoff, 'win'],
    ]);
    expect(steps[1].event).toMatchObject({ hand: '1-0', amount: 20 });
  });

  it('shows no amount for a computer seat', () => {
    const steps = plan([{ type: 'settled', hand: '3-0', result: 'Lose', payout: 0 }], { isComputer: () => true });
    expect(steps.map(s => s.event.type)).toEqual(['settled', 'sweep']);
  });

  it('sweeps a bust or surrender at once, and pays it later with no pause', () => {
    const swept = new Set();
    const now = plan([{ type: 'message', text: 'Bust', hand: '1-0' }, { type: 'message', text: 'Surrender', hand: '2-0' }], { swept });
    expect(now.map(s => [s.event.type, s.event.result ?? null])).toEqual([['result', 'Bust'], ['sweep', null], ['result', 'Surrender'], ['sweep', null]]);
    const later = plan([{ type: 'settled', hand: '1-0', result: 'Bust', payout: 0 }], { swept });
    expect(later).toEqual([{ event: expect.objectContaining({ type: 'settled' }), pause: 0, sound: null }]);
  });

  it('sweeps a blackjack at once only once the dealer has checked for one', () => {
    const blackjack = [{ type: 'message', text: 'Blackjack', hand: '1-0' }];
    expect(plan(blackjack).map(s => s.event.type)).toEqual(['result', 'sweep']);
    expect(plan(blackjack)[0].event.result).toBe('21');
    expect(plan(blackjack, { sweepNaturals: false }).map(s => s.event.type)).toEqual(['message']);
  });

  it('leaves table-wide messages alone', () => {
    expect(plan([{ type: 'message', text: 'Dealer busts' }]).map(s => s.event.type)).toEqual(['message']);
  });

  it('does not pause on bookkeeping events', () => {
    const steps = plan([{ type: 'roundStart' }, { type: 'turn', hand: '1-0' }, { type: 'clear' }]);
    expect(steps.map(s => s.pause)).toEqual([0, 0, 0]);
  });

  it('plays a sound per event where the original did', () => {
    const sounds = plan([
      { type: 'shuffle' }, { type: 'burn', card: 1 }, { type: 'reveal', hand: '0-0' },
      { type: 'split', hand: '1-0' }, { type: 'settled', hand: '1-0', result: 'Push' },
      { type: 'settled', hand: '2-0', result: 'Lose' }, { type: 'message', text: 'Dealer busts' },
    ]).map(s => s.sound);
    // Only a card off the shoe clicks: turning one over and moving one on a split are silent.
    // The burn is followed by a silent step that gathers it into the tray.
    expect(sounds).toEqual(['shuffle', 'card', null, null, null, null, null, 'push', null, null, 'lose', null]);
  });

  it('deals the dealer up card face down and turns it once every card is out', () => {
    const steps = plan([
      { type: 'card', hand: '1-0', card: 5, faceUp: true, cardIndex: 0 },
      { type: 'card', hand: '0-0', card: 9, faceUp: true, cardIndex: 0 },
      { type: 'card', hand: '1-0', card: 6, faceUp: true, cardIndex: 1 },
      { type: 'card', hand: '0-0', card: 3, faceUp: false, cardIndex: 1 },
      { type: 'dealt', upcard: 9 },
    ]).map(s => s.event);
    expect(steps[1]).toMatchObject({ hand: '0-0', faceUp: false });
    expect(steps[4]).toEqual({ type: 'reveal', hand: '0-0', cardIndex: 0, card: 9 });
    expect(steps[5].type).toBe('dealt');
    // Draws later in the round are left alone.
    const later = plan([{ type: 'card', hand: '0-0', card: 4, faceUp: true, cardIndex: 2 }]);
    expect(later[0].event.faceUp).toBe(true);
  });

  it('flashes the hole card for a fixed half second, whatever the speed', () => {
    const peek = [{ type: 'peek', hand: '0-0', cardIndex: 1 }];
    expect(plan(peek)[0]).toMatchObject({ pause: 500, sound: null });
    expect(planSteps(peek, { pauses: { dealer: 10, player: 10, payoff: 10 } })[0].pause).toBe(500);
  });

  it('hides the hole card again without a pause of its own', () => {
    expect(plan([{ type: 'conceal', hand: '0-0', cardIndex: 1 }])[0].pause).toBe(0);
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
    vi.advanceTimersByTime(PAUSES.player);
    expect(steps).toEqual(['card', 'card']);
    expect(animator.busy).toBe(true);
    vi.advanceTimersByTime(PAUSES.player);
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
    expect(steps).toEqual(['card', 'card', 'settled', 'payout', 'sweep']);
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

  it('stays quiet when handed nothing while it is already playing', () => {
    const { idle, animator } = harness();
    animator.play(plan([{ type: 'card', hand: '1-0' }]));
    animator.play([]);
    // The timeline is still running, so this is not the moment to let input back in.
    expect(idle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PAUSES.player * 2);
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
    const steps = [];
    const animator = createAnimator({ onStep: step => steps.push(step.event.type) });
    animator.play([]);
    animator.play(plan([{ type: 'roundStart' }]));
    animator.finish();
    expect(steps).toEqual(['roundStart']);
    expect(animator.busy).toBe(false);
  });
});

describe('swipe gestures', () => {
  it('reads the four straight swipes', () => {
    expect(swipeAction({ dx: 0, dy: 60 })).toBe('hit');
    expect(swipeAction({ dx: -60, dy: 0 })).toBe('stand');
    expect(swipeAction({ dx: 0, dy: -60 })).toBe('double');
    expect(swipeAction({ dx: 60, dy: 0 })).toBe('split');
  });

  it('ignores diagonal swipes (Surrender is a double tap)', () => {
    expect(swipeAction({ dx: 50, dy: 50 })).toBe(null);
    expect(swipeAction({ dx: -50, dy: 60 })).toBe(null);
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

describe('the turn pointer', () => {
  const isComputer = key => key.startsWith('3');

  it('rests on a computer hand for one beat at the other-player speed', () => {
    const [step] = plan([{ type: 'turn', hand: '3-0' }], { isComputer });
    expect(step.pause).toBe(PAUSES.player);
  });

  it('does not pause on the player’s own turn, which waits for the player', () => {
    const [step] = plan([{ type: 'turn', hand: '1-0' }], { isComputer });
    expect(step.pause).toBe(0);
  });
});

describe('the burn cards', () => {
  it('are shown, then gathered into the tray, as a step of their own', () => {
    const steps = plan([{ type: 'shuffle' }, { type: 'burn', card: 4, faceUp: true }, { type: 'burn', card: 9, faceUp: true }]);
    expect(steps.map(s => s.event.type)).toEqual(['shuffle', 'burn', 'burn', 'burnsToTray']);
    // Long enough to see them go.
    expect(steps.at(-1).pause).toBe(PAUSES.dealer);
  });

  it('are gathered once, after the last of them', () => {
    const steps = plan([{ type: 'burn', card: 4 }, { type: 'clear' }, { type: 'burn', card: 9 }]);
    expect(steps.filter(s => s.event.type === 'burnsToTray')).toHaveLength(1);
    expect(steps.at(-1).event.type).toBe('burnsToTray');
  });

  it('leave a timeline with no burn alone', () => {
    expect(plan([{ type: 'card', hand: '1-0' }]).some(s => s.event.type === 'burnsToTray')).toBe(false);
  });
});

describe('the insurance stake', () => {
  it('stays on the seat long enough to be seen before it is taken', () => {
    const steps = plan([{ type: 'insuranceTaken' }, { type: 'reveal', hand: '0-0', cardIndex: 1 }, { type: 'insuranceLost' }]);
    expect(steps[0]).toMatchObject({ event: { type: 'insuranceTaken' }, pause: PAUSES.dealer });
    // The chips are taken at the payoff speed, like any other payment.
    expect(steps.at(-1)).toMatchObject({ event: { type: 'insuranceLost' }, pause: PAUSES.payoff });
  });
});
