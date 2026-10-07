import { describe, it, expect } from 'vitest';
import {
  dealRound,
  partialView,
  fullAnswer,
  fullyShownLimit,
  fullQuestionDrill,
  asksTwoCounts,
  nextTwoTablePhase,
  spotsFor,
  DEALER_SPOT,
  TWO_TABLE_PHASES,
} from '@/drills/full/logic';
import { halfSteps, answerIndex } from '@/drills/count/logic';
import { countGrid, countWindow, halfStepLabel, INITIAL_WINDOW } from '@/drills/shared/count-grid';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { cardId } from '@/core/cards';
import { seededRandom } from '@/core/random';
import type { Players } from '@/drills/full/logic';
import type { TableOptions } from '@/core/strategy/strategy-tables';
import type { DrillCounts } from '@/drills/shared/count-answers';

const card = (value: number) => cardId(value, 0);
const cards = (values: number[]) => values.map(card);
const rules: TableOptions = { decks: 6, hitSoft17: false, doubleAfterSplit: false, noHoleCard: false, indexSet: 'all' };
const halves = buildStrategy(STRATEGY_FILES[32], rules);
const highLow = buildStrategy(STRATEGY_FILES[30], rules);

describe('the Two Tables phase cycle', () => {
  it('comes back to the first question after the last, so the phase stays a real one', () => {
    expect(nextTwoTablePhase(0)).toBe(1);
    expect(nextTwoTablePhase(TWO_TABLE_PHASES.length - 1)).toBe(0);
    for (let phase = 0; phase < TWO_TABLE_PHASES.length; phase++) {
      expect(TWO_TABLE_PHASES[nextTwoTablePhase(phase)]).toBeDefined();
    }
  });
});

describe('which count a question asks for', () => {
  it('asks the running count for Two Tables and for the first of two counts', () => {
    expect(fullQuestionDrill('twoTables', false)).toBe('runningCount');
    expect(fullQuestionDrill('acesLeft', true)).toBe('runningCount');
    expect(fullQuestionDrill('acesLeft', false)).toBe('acesLeft');
    expect(fullQuestionDrill('runningCount', false)).toBe('runningCount');
  });

  it('counts the running count in half steps when the system counts in halves', () => {
    expect(halfSteps(fullQuestionDrill('acesDealt', true), halves)).toBe(true);
    expect(halfSteps(fullQuestionDrill('acesDealt', false), halves)).toBe(false);
    expect(halfSteps(fullQuestionDrill('twoTables', false), halves)).toBe(true);
    expect(halfSteps(fullQuestionDrill('acesDealt', true), highLow)).toBe(false);
  });

  it('gives a half-point running count a button to hit', () => {
    // Only the counts the drill reads.
    const counts = { runningCount: 5.5, aces: 3 } as DrillCounts;
    const drill = fullQuestionDrill('acesDealt', true);
    const index = answerIndex(fullAnswer(drill, counts), halfSteps(drill, halves));
    const grid = countGrid(countWindow(index, INITIAL_WINDOW), halfStepLabel);
    expect(grid.cellFor(index)).toBeTruthy();
    expect(grid.cellFor(index)!.label).toBe('5½');
  });
});

describe('Two Counts', () => {
  it('is ignored by the Running Count drill, which has no second count', () => {
    expect(asksTwoCounts('runningCount', true)).toBe(false);
    expect(asksTwoCounts('twoTables', true)).toBe(false);
    expect(asksTwoCounts('acesLeft', true)).toBe(true);
    expect(asksTwoCounts('acesLeft', false)).toBe(false);
  });
});

describe('the scattered layout', () => {
  it('deals loose cards only, so no hidden hands are counted', () => {
    let drawn = 0;
    const { hands, stopped } = dealRound({
      players: 6,
      handStyle: 'scattered',
      draw: () => {
        drawn += 1;
        return card(5);
      },
    });
    expect(hands).toEqual([]);
    expect(stopped).toBe(false);
    expect(drawn).toBe(0);
  });
});

describe('fullyShownLimit', () => {
  const handsFor = (players: Players) => spotsFor(players).map(spot => ({ spot, cards: cards([5, 5, 5, 5]) }));

  it('fully shows the first seat in play, or none of them', () => {
    const random = seededRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(fullyShownLimit(handsFor(2), random));
    expect([...seen].sort((a, b) => a - b)).toEqual([-1, 2]);
  });

  it('varies how much of a two-player table a partial view shows', () => {
    const random = seededRandom(3);
    const sizes = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const hands = handsFor(2);
      const shown = partialView(hands, fullyShownLimit(hands, random));
      sizes.add(shown.flat().filter(Boolean).length);
    }
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('never fully shows the dealer', () => {
    const random = () => 0.99;
    const hands = handsFor(6);
    const shown = partialView(hands, fullyShownLimit(hands, random));
    const dealer = hands.findIndex(hand => hand.spot === DEALER_SPOT);
    expect(shown[dealer]).toEqual([true, false, false, false]);
  });
});
