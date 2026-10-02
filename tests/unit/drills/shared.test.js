import { describe, it, expect, vi } from 'vitest';
import { DrillClock, TIMER_MODE, progressiveSpeed } from '../../../src/drills/shared/drill-clock.js';
import { DrillScore, gradeAnswer, ACCURACY } from '../../../src/drills/shared/scoring.js';
import { trayImage, maxDecksInTray } from '../../../src/drills/shared/discard-tray.js';
import { numberGrid, windowContaining } from '../../../src/drills/shared/answer-grid.js';
import { mixedNumber } from '../../../src/drills/shared/format.js';
import { DrillShoe } from '../../../src/drills/shared/shoe.js';
import { buildStrategy } from '../../../src/core/strategy/strategy-tables.js';
import { STRATEGY_FILES } from '../../../src/data/strategy-files.js';
import { seededRandom } from '../../../src/core/random.js';

function fakeClock() {
  let now = 1000;
  const timers = [];
  const clock = new DrillClock({
    mode: TIMER_MODE.countDown, limit: 10,
    now: () => now,
    setTimer: (fn, ms) => { timers.push({ fn, at: now + ms / 1000 }); return timers.length - 1; },
    clearTimer: id => { if (timers[id]) timers[id].cancelled = true; },
    onAlarm: () => { clock.alarms = (clock.alarms ?? 0) + 1; },
  });
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
  it('counts down, fires the alarm once and marks the display overdue', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(4);
    expect(clock.display()).toEqual({ seconds: 6, overdue: false });
    clock.advance(7);
    expect(clock.display().overdue).toBe(true);
    expect(clock.alarms).toBe(1);
    clock.advance(5);
    expect(clock.alarms).toBe(1);
  });

  it('excludes paused time from the elapsed total', () => {
    const clock = fakeClock();
    clock.start();
    clock.advance(3);
    clock.pause();
    clock.advance(10);
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
    expect(trayImage(0, 'eightDeckFront').src).toContain('/301.jpg');
    expect(trayImage(1, 'eightDeckFront').src).toContain('/293.jpg');
    expect(trayImage(2, 'eightDeckFront').src).toContain('/285.jpg');
  });

  it('falls back to the eight-deck tray when a style cannot hold the depth', () => {
    expect(trayImage(7, 'doubleDeckFront').src).toContain('/245.jpg');
    expect(trayImage(1, 'doubleDeckFront').src).toContain('/372.jpg');
  });

  it('has no photo for a nearly full eight-deck tray', () => {
    expect(trayImage(7.75, 'eightDeckFront')).toBeNull();
    expect(maxDecksInTray('eightDeckFront')).toBe(7.25);
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
    expect(grid.cellAt(5, 5, 600, 300).value).toBe(12);
    expect(grid.cellAt(595, 295, 600, 300).value).toBe(5);
  });

  it('shifts the value window until it contains the answer', () => {
    expect(windowContaining(5, 0, 18)).toBe(0);
    expect(windowContaining(20, 0, 18)).toBe(9);
    expect(windowContaining(-1, 0, 18)).toBe(-9);
    expect(windowContaining(-20, 0, 18)).toBe(-27);
  });
});

describe('mixedNumber', () => {
  it('writes quarters as fractions', () => {
    expect([0, 0.25, 0.5, 1, 1.25, 1.75, 6].map(mixedNumber)).toEqual(['0', '¼', '½', '1', '1¼', '1¾', '6']);
    expect(mixedNumber(-1.5)).toBe('-1½');
  });
});

describe('DrillShoe', () => {
  const strategy = buildStrategy(STRATEGY_FILES[30], { decks: 6, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all' });
  const settings = { division: 0, lastDeck: 1, rounding: 'round' };

  it('deals every card once and counts as it goes', () => {
    const shoe = new DrillShoe({ decks: 2, strategy, trueCountSettings: settings, random: seededRandom(5) });
    const seen = new Set();
    let count = 0;
    while (shoe.remaining) { seen.add(shoe.deal()); count++; }
    expect(count).toBe(104);
    expect(seen.size).toBe(52);
    expect(shoe.deal()).toBeNull();
  });

  it('leaves out tens for Spanish decks', () => {
    const shoe = new DrillShoe({ decks: 1, strategy, trueCountSettings: settings, random: seededRandom(5), cardsPerDeck: 48 });
    expect(shoe.cards.length).toBe(48);
    expect(shoe.cards.some(id => id % 13 === 10)).toBe(false);
  });

  it('biases the next card toward the wanted count direction', () => {
    const shoe = new DrillShoe({ decks: 2, strategy, trueCountSettings: settings, random: seededRandom(9) });
    shoe.applyBias('positive');
    const before = shoe.counter.running;
    shoe.deal();
    expect(shoe.counter.running).toBeGreaterThan(before);
  });
});
