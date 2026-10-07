import { describe, it, expect, vi } from 'vitest';
import { DrillClock, TIMER_MODE, progressiveSpeed } from '@/drills/shared/drill-clock';
import type { DrillClockOptions } from '@/drills/shared/drill-clock';
import { DrillScore, gradeAnswer, ACCURACY } from '@/drills/shared/scoring';
import { trayImage, maxDecksInTray } from '@/drills/shared/discard-tray';
import { AnswerGrid, numberGrid, windowContaining } from '@/drills/shared/answer-grid';
import { clockTime, mixedNumber, signedCount } from '@/drills/shared/format';
import { DrillShoe } from '@/drills/shared/shoe';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { seededRandom } from '@/core/random';
import type { CounterSettings, TcRounding } from '@/core/counting';

type TimerId = ReturnType<typeof setTimeout>;
interface FakeTimer {
  fn: () => void;
  at: number;
  cancelled?: boolean;
  done?: boolean;
}
type FakeClock = DrillClock & { alarms?: number; halts?: number; advance: (seconds: number) => void };

function fakeClock(options: Partial<DrillClockOptions> = {}): FakeClock {
  let now = 1000;
  const timers: FakeTimer[] = [];
  const clock = new DrillClock({
    mode: TIMER_MODE.countDown,
    limit: 10,
    now: () => now,
    setTimer: (fn, ms) => {
      timers.push({ fn, at: now + ms / 1000 });
      // The fake hands out array indices as timer ids.
      return (timers.length - 1) as unknown as TimerId;
    },
    clearTimer: id => {
      const timer = timers[id as unknown as number];
      if (timer) timer.cancelled = true;
    },
    onAlarm: () => {
      clock.alarms = (clock.alarms ?? 0) + 1;
    },
    onHalt: () => {
      clock.halts = (clock.halts ?? 0) + 1;
    },
    ...options,
  }) as FakeClock;
  clock.advance = seconds => {
    const target = now + seconds;
    for (;;) {
      const next = timers.filter(t => !t.cancelled && !t.done && t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      now = next.at;
      next.done = true;
      next.fn();
    }
    now = target;
  };
  return clock;
}

describe('DrillClock', () => {
  it('schedules nothing once stopped, so a late callback cannot restart a run', () => {
    const clock = fakeClock();
    clock.start();
    clock.stop();
    const fired: unknown[] = [];
    clock.after('advance', 1, () => fired.push('after'));
    clock.every('deal', 1, () => fired.push('every'));
    clock.advance(5);
    expect(fired).toEqual([]);
  });

  it('counts down, fires the alarm once and marks the display overdue', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(4);
    expect(clock.display()).toEqual({ seconds: 6, overdue: false });
    clock.advance(7);
    // Past the limit the count-down stays at zero rather than going negative.
    expect(clock.display()).toEqual({ seconds: 0, overdue: true });
    expect(clock.alarms).toBe(1);
    clock.advance(5);
    expect(clock.alarms).toBe(1);
  });

  it('reads the full limit at the start, rounds up, and is red at exactly zero', () => {
    const clock = fakeClock();
    clock.start();
    expect(clock.display()).toEqual({ seconds: 10, overdue: false });
    clock.advance(9.4);
    expect(clock.display()).toEqual({ seconds: 1, overdue: false });
    clock.advance(0.6);
    expect(clock.display()).toEqual({ seconds: 0, overdue: true });
  });

  it('keeps showing the time it stopped at', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(10.003);
    clock.stop();
    clock.advance(5);
    expect(clock.display()).toEqual({ seconds: 0, overdue: true });
  });

  it('counts up with no limit in Infinite mode', () => {
    const clock = fakeClock();
    clock.mode = TIMER_MODE.infinite;
    clock.start();
    clock.advance(25);
    expect(clock.display()).toEqual({ seconds: 25, overdue: false });
    expect(clock.alarms ?? 0).toBe(0);
  });

  it('excludes paused time from the elapsed total', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(3);
    clock.pause();
    clock.advance(10);
    expect(clock.elapsed).toBe(3);
    clock.resume();
    expect(Math.round(clock.elapsed)).toBe(3);
  });

  it('reports the rate per minute to one decimal', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(30);
    expect(clock.rate(10)).toBe(20);
    expect(clock.rate(7)).toBe(14);
  });

  it('shows no rate until a whole second has passed', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(0.005);
    expect(clock.rate(1)).toBe(0);
    clock.advance(0.995);
    expect(clock.rate(1)).toBe(60);
  });

  it('is only running between a start and a pause or a stop', () => {
    const clock = fakeClock();
    expect(clock.running).toBe(false);
    clock.start();
    expect(clock.running).toBe(true);
    clock.pause();
    expect(clock.running).toBe(false);
    clock.resume();
    expect(clock.running).toBe(true);
    clock.stop();
    expect(clock.running).toBe(false);
  });

  it('reads no time and no rate before it starts', () => {
    const clock = fakeClock();
    expect(clock.elapsed).toBe(0);
    expect(clock.rate(10)).toBe(0);
  });

  it('keeps the elapsed time it reached once it stops', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(12);
    clock.stop();
    clock.advance(30);
    expect(clock.elapsed).toBe(12);
    expect(clock.rate(6)).toBe(30);
  });

  it('ignores a pause before the start, a second pause and a pointless resume', () => {
    const clock = fakeClock();
    clock.pause();
    clock.resume();
    clock.stop();
    expect([clock.paused, clock.elapsed]).toEqual([false, 0]);
    clock.start();
    clock.advance(2);
    clock.pause();
    const pausedAt = clock.pausedAt;
    clock.advance(5);
    clock.pause();
    expect(clock.pausedAt).toBe(pausedAt);
    clock.resume();
    clock.resume();
    expect(Math.round(clock.elapsed)).toBe(2);
  });

  it('counts up to the limit in Count Up mode', () => {
    const clock = fakeClock({ mode: TIMER_MODE.countUp, limit: 5 });
    clock.start();
    clock.advance(4);
    expect(clock.display()).toEqual({ seconds: 4, overdue: false });
    expect(clock.alarms ?? 0).toBe(0);
    clock.advance(2);
    expect(clock.alarms).toBe(1);
  });

  it('halts the run when a count-down-and-halt runs out', () => {
    const clock = fakeClock({ mode: TIMER_MODE.countDownHalt, limit: 3 });
    clock.start();
    clock.advance(4);
    expect([clock.alarms, clock.halts]).toEqual([1, 1]);
  });

  it('ignores a tick that fires after a pause', () => {
    let tick: (() => void) | null = null;
    let ticks = 0;
    const clock = new DrillClock({
      mode: TIMER_MODE.countUp,
      limit: 10,
      now: () => 0,
      setTimer: fn => {
        tick = fn;
        return 1 as unknown as TimerId;
      },
      clearTimer: () => {},
      onTick: () => {
        ticks += 1;
      },
    });
    clock.start();
    clock.pause();
    tick!();
    expect(ticks).toBe(0);
  });

  it('runs a named timer once, after the seconds given', () => {
    const clock = fakeClock();
    const fired: unknown[] = [];
    clock.start();
    clock.after('reveal', 2, () => fired.push(clock.elapsed));
    clock.advance(1);
    expect(fired).toEqual([]);
    clock.advance(2);
    expect(fired).toEqual([2]);
  });

  it('replaces a named timer instead of running both', () => {
    const clock = fakeClock();
    const fired: unknown[] = [];
    clock.start();
    clock.after('reveal', 2, () => fired.push('first'));
    clock.after('reveal', 3, () => fired.push('second'));
    clock.advance(5);
    expect(fired).toEqual(['second']);
  });

  it('repeats a named timer until it is cancelled', () => {
    const clock = fakeClock();
    let beeps = 0;
    clock.start();
    clock.every('beep', 1, () => {
      beeps += 1;
    });
    clock.advance(3.5);
    expect(beeps).toBe(3);
    clock.cancel('beep');
    clock.advance(5);
    expect(beeps).toBe(3);
  });

  it('cancels its named timers when it is paused', () => {
    const clock = fakeClock();
    let beeps = 0;
    clock.start();
    clock.every('beep', 1, () => {
      beeps += 1;
    });
    clock.pause();
    clock.advance(5);
    expect(beeps).toBe(0);
  });

  it('ticks off the wall clock with real timers by default', () => {
    vi.useFakeTimers();
    try {
      const seconds: number[] = [];
      const clock = new DrillClock({
        mode: TIMER_MODE.countUp,
        limit: 60,
        onTick: () => seconds.push(clock.display().seconds),
      });
      clock.start();
      vi.advanceTimersByTime(3000);
      clock.stop();
      expect(seconds).toEqual([1, 2, 3]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AnswerGrid with an offset row', () => {
  /** Two columns: a fraction row, and a whole row shifted half a column left. */
  const grid = () =>
    new AnswerGrid({
      rows: 2,
      columns: 2,
      cells: [
        { row: 0, column: 0, value: 1, label: '½' },
        { row: 0, column: 1, value: 3, label: '1½' },
        { row: 1, column: 1, value: 2, offset: -0.5, label: '1' },
      ],
    });

  it('finds the offset cell under the point it is drawn at', () => {
    // The offset key spans the middle of a 200px-wide grid: 50px to 150px.
    expect(grid().cellAt(100, 30, 200, 40)?.label).toBe('1');
    expect(grid().cellAt(55, 30, 200, 40)?.label).toBe('1');
    expect(grid().cellAt(145, 30, 200, 40)?.label).toBe('1');
  });

  it('leaves the half key at each end of an offset row empty', () => {
    expect(grid().cellAt(20, 30, 200, 40)).toBe(null);
    expect(grid().cellAt(180, 30, 200, 40)).toBe(null);
  });

  it('still finds cells in rows that are not offset', () => {
    expect(grid().cellAt(40, 10, 200, 40)?.label).toBe('½');
    expect(grid().cellAt(160, 10, 200, 40)?.label).toBe('1½');
  });
});

describe('progressiveSpeed', () => {
  it('speeds up 10% per run and never goes below 1', () => {
    expect(progressiveSpeed(10, 0, true)).toBe(10);
    expect(progressiveSpeed(10, 1, true)).toBeCloseTo(9);
    expect(progressiveSpeed(10, 2, true)).toBeCloseTo(8.1);
    expect(progressiveSpeed(10, 1, false)).toBe(10);
    expect(progressiveSpeed(1, 50, true)).toBe(1);
  });
});

describe('DrillScore', () => {
  it('counts one error per test and computes accuracy', () => {
    const score = new DrillScore();
    score.beginTest();
    expect(score.recordError()).toBe(true);
    expect(score.recordError()).toBe(false);
    score.beginTest();
    expect(score.accuracy).toBe(50);
  });

  it('discards a test in progress', () => {
    const score = new DrillScore();
    score.beginTest();
    score.recordError();
    score.discardTest();
    expect([score.tests, score.errors]).toEqual([0, 0]);
  });

  it('scores nothing before the first test, and has nothing to discard', () => {
    const score = new DrillScore();
    expect(score.accuracy).toBe(0);
    score.discardTest();
    expect([score.tests, score.errors]).toEqual([0, 0]);
  });

  it('keeps the errors of earlier tests when a clean test is discarded', () => {
    const score = new DrillScore();
    score.beginTest();
    score.recordError();
    score.beginTest();
    score.discardTest();
    expect([score.tests, score.errors, score.accuracy]).toEqual([1, 1, 0]);
  });
});

describe('gradeAnswer', () => {
  it('accepts near answers only within the chosen tolerance', () => {
    expect(gradeAnswer(5, 5, ACCURACY.exact)).toBe('correct');
    expect(gradeAnswer(6, 5, ACCURACY.exact)).toBe('wrong');
    expect(gradeAnswer(6, 5, ACCURACY.withinOne)).toBe('close');
    expect(gradeAnswer(7, 5, ACCURACY.withinOne)).toBe('wrong');
    expect(gradeAnswer(7, 5, ACCURACY.withinTwo)).toBe('close');
    expect(gradeAnswer(8, 5, ACCURACY.withinTwo)).toBe('wrong');
  });
});

describe('discard tray photos', () => {
  it('steps through the series every quarter deck', () => {
    expect(trayImage(0, 'eightDeckFront')!.src).toContain('/303.jpg');
    expect(trayImage(1, 'eightDeckFront')!.src).toContain('/295.jpg');
    expect(trayImage(2, 'eightDeckFront')!.src).toContain('/287.jpg');
  });

  it('falls back to the eight-deck tray when a style cannot hold the depth', () => {
    expect(trayImage(7, 'doubleDeckFront')!.src).toContain('/247.jpg');
    expect(trayImage(1, 'doubleDeckFront')!.src).toContain('/374.jpg');
  });

  it('has no photo for a nearly full eight-deck tray', () => {
    expect(trayImage(7.75, 'eightDeckFront')).toBeNull();
    expect(maxDecksInTray('eightDeckFront')).toBe(7.5);
  });
});

describe('answer grids', () => {
  it('lays numbers out left to right and bottom to top', () => {
    const grid = numberGrid({ rows: 3, columns: 6, lowest: -8 });
    expect(grid.cellFor(-8)).toMatchObject({ row: 2, column: 0 });
    expect(grid.cellFor(-3)).toMatchObject({ row: 2, column: 5 });
    expect(grid.cellFor(-2)).toMatchObject({ row: 1, column: 0 });
    expect(grid.cellFor(9)).toMatchObject({ row: 0, column: 5 });
  });

  it('finds the cell under a tap', () => {
    const grid = numberGrid({ rows: 3, columns: 6, lowest: 0 });
    expect(grid.cellAt(5, 5, 600, 300)!.value).toBe(12);
    expect(grid.cellAt(595, 295, 600, 300)!.value).toBe(5);
  });

  it('shifts the value window until it contains the answer', () => {
    expect(windowContaining(5, 0, 18)).toBe(0);
    expect(windowContaining(20, 0, 18)).toBe(9);
    expect(windowContaining(-1, 0, 18)).toBe(-9);
    expect(windowContaining(-20, 0, 18)).toBe(-27);
  });
});

describe('clockTime', () => {
  it('writes seconds as hours, minutes and seconds', () => {
    expect([0, 5, 65, 3599, 3600, 3725, 36000].map(clockTime)).toEqual([
      '00:00:00',
      '00:00:05',
      '00:01:05',
      '00:59:59',
      '01:00:00',
      '01:02:05',
      '10:00:00',
    ]);
  });

  it('never shows a negative time', () => {
    expect(clockTime(-5)).toBe('00:00:00');
  });
});

describe('mixedNumber', () => {
  it('writes quarters as fractions', () => {
    expect([0, 0.25, 0.5, 1, 1.25, 1.75, 6].map(mixedNumber)).toEqual(['0', '¼', '½', '1', '1¼', '1¾', '6']);
    expect(mixedNumber(-1.5)).toBe('-1½');
  });
});

describe('signedCount', () => {
  it('signs a positive count and leaves the others alone', () => {
    expect([3, 0, -2].map(signedCount)).toEqual(['+3', '0', '-2']);
  });
});

describe('DrillShoe', () => {
  const strategy = buildStrategy(STRATEGY_FILES[30], {
    decks: 6,
    hitSoft17: false,
    doubleAfterSplit: false,
    noHoleCard: false,
    indexSet: 'all',
  });
  // A string where TC_ROUNDING's number belongs, so the counter floors (kept as recorded).
  const settings: CounterSettings = { division: 0, lastDeck: 1, rounding: 'round' as unknown as TcRounding };

  it('deals every card once and counts as it goes', () => {
    const shoe = new DrillShoe({ decks: 2, strategy, trueCountSettings: settings, random: seededRandom(5) });
    const seen = new Set();
    let count = 0;
    while (shoe.remaining) {
      seen.add(shoe.deal());
      count++;
    }
    expect(count).toBe(104);
    expect(seen.size).toBe(52);
    expect(shoe.deal()).toBeNull();
  });

  it('leaves out tens for Spanish decks', () => {
    const shoe = new DrillShoe({
      decks: 1,
      strategy,
      trueCountSettings: settings,
      random: seededRandom(5),
      cardsPerDeck: 48,
    });
    expect(shoe.cards.length).toBe(48);
    expect(shoe.cards.some(id => id % 13 === 10)).toBe(false);
  });

  it('reports what each card did to the running count', () => {
    const shoe = new DrillShoe({ decks: 1, strategy, trueCountSettings: settings, random: seededRandom(7) });
    const values: number[] = [];
    for (let i = 0; i < 52; i++) {
      const dealt = shoe.dealWithCountValue()!;
      expect(dealt.card).toBe(shoe.cards[i]);
      values.push(dealt.countValue);
    }
    expect(new Set(values)).toEqual(new Set([-1, 0, 1]));
    // A whole High-Low deck nets zero.
    expect(values.reduce((a, b) => a + b, 0)).toBe(0);
    expect(shoe.dealWithCountValue()).toBeNull();
  });

  it('measures the decks left and the decks in the tray', () => {
    const shoe = new DrillShoe({ decks: 2, strategy, trueCountSettings: settings, random: seededRandom(3) });
    expect(shoe.decksInTray()).toBe(0);
    for (let i = 0; i < 26; i++) shoe.deal();
    expect(shoe.decksInTray()).toBe(0.5);
    // Full-deck resolution rounds the 1½ decks left down to one.
    expect(shoe.decksRemaining()).toBe(1);
    expect(shoe.decksRemaining()).toBe(shoe.counter.decksRemaining(26));
  });

  it('leaves the order alone when nothing is biased', () => {
    const shoe = new DrillShoe({ decks: 1, strategy, trueCountSettings: settings, random: seededRandom(2) });
    const before = shoe.cards.slice();
    shoe.applyBias('none');
    expect(shoe.cards).toEqual(before);
  });

  it('biases the next card toward the wanted count direction', () => {
    const shoe = new DrillShoe({ decks: 2, strategy, trueCountSettings: settings, random: seededRandom(9) });
    shoe.applyBias('positive');
    const before = shoe.counter.running;
    shoe.deal();
    expect(shoe.counter.running).toBeGreaterThan(before);
  });
});
