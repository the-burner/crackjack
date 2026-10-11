import { describe, it, expect } from 'vitest';
import { correctPlay, checkPlay, correctInsurance, checkInsurance, checkBet, expectedBet } from '@/game/play-check';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import { SECTION } from '@/core/strategy/advisor';
import { STRATEGY_FILES } from '@/data/strategy-files';
import { rulesFrom } from '@/game/engine/rules';
import { ACTION } from '@/game/engine/game';
import { Hand } from '@/game/engine/hand';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';
import { cardId } from '@/core/cards';
import type { CardId } from '@/core/cards';
import type { PlayCounts } from '@/game/play-check';
import type { SettingValues } from '@/settings/schema';

const SPADES = 0,
  HEARTS = 2;
const card = (rank: number, suit = SPADES) => cardId(rank, suit);

/** The default High-Low strategy, whose insurance index is a whole true count. */
const DEFAULT_SYSTEM = SETTINGS_SCHEMA['strategy.system'].default;
/** Silver Fox, whose insurance index is fractional (+3.8). */
const FRACTIONAL_INSURANCE_SYSTEM = 70;

const strategyFor = (system: number) =>
  buildStrategy(STRATEGY_FILES[system], {
    decks: 6,
    hitSoft17: false,
    doubleAfterSplit: true,
    noHoleCard: false,
    indexSet: 'all',
  });

function makeRules(overrides: Partial<SettingValues> = {}) {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return rulesFrom(settings);
}

function hand(cards: CardId[], { bet = 10, ...rest }: Partial<Hand> = {}) {
  const h = new Hand({ seat: 1, bet });
  for (const c of cards) h.addCard(c);
  Object.assign(h, rest);
  return h;
}

const strategy = strategyFor(DEFAULT_SYSTEM);
const base = () => ({
  strategy,
  rules: makeRules(),
  counts: { trueCount: 0, runningCount: 0 },
  shoe: { decks: 6, dealt: 0 },
  handsInSeat: 1,
});

describe('the strategy-correct play', () => {
  it('surrenders a hard 16 against a ten at a neutral count', () => {
    const { action } = correctPlay({ ...base(), hand: hand([card(10), card(6)]), upcard: card(10) });
    expect(action).toBe(ACTION.surrender);
  });

  it('splits a pair of eights against an ace', () => {
    const { action } = correctPlay({ ...base(), hand: hand([card(8), card(8, HEARTS)]), upcard: card(1) });
    expect(action).toBe(ACTION.split);
  });

  it('reads the only card twice when a hand holds one card', () => {
    const { action } = correctPlay({ ...base(), hand: hand([card(10)]), upcard: card(10) });
    expect(action).toBe(ACTION.hit);
  });

  it('plays a soft hand of three cards as the ace and the rest, in any order', () => {
    // A,4,4 is a soft 19, played as A,8, not as A,4.
    for (const cards of [
      [1, 4, 4],
      [4, 1, 4],
      [4, 4, 1],
    ]) {
      const { action, advice } = correctPlay({ ...base(), hand: hand(cards.map(r => card(r))), upcard: card(10) });
      expect(action, cards.join(',')).toBe(ACTION.stand);
      expect(advice.section, cards.join(',')).toBe(SECTION.softStand);
    }
    // A,2,4 is a soft 17, which hits.
    expect(correctPlay({ ...base(), hand: hand([card(1), card(2), card(4)]), upcard: card(10) }).action).toBe(
      ACTION.hit,
    );
  });
});

describe('an extended strategy', () => {
  // Double Exposure plays against the dealer's total, not the upcard alone.
  const DOUBLE_EXPOSURE_SYSTEM = 92;
  const question = () => ({
    ...base(),
    strategy: strategyFor(DOUBLE_EXPOSURE_SYSTEM),
    hand: hand([card(10), card(2)]),
  });

  it('reads the dealer column from the dealer total, hole card included', () => {
    const dealer = hand([card(10, HEARTS), card(6, HEARTS)]);
    expect(correctPlay({ ...question(), upcard: card(10, HEARTS), dealer }).action).toBe(ACTION.stand);
    // A 12 against a dealer 10 alone hits.
    expect(correctPlay({ ...question(), upcard: card(10, HEARTS) }).action).toBe(ACTION.hit);
  });
});

describe('checking a play', () => {
  describe('a close call', () => {
    // 16 against a ten, no surrender: stand from a true count of 0, hit below.
    const sixteen = () => ({
      ...base(),
      rules: makeRules({ 'rules.surrender': 'none' }),
      hand: hand([card(10), card(6)]),
      upcard: card(10, HEARTS),
    });
    const counted = (trueCount: number) => ({ counts: { trueCount, runningCount: 0 }, shoe: { decks: 6, dealt: 100 } });

    it('is a play that a count a few cards either way would call for', () => {
      expect(correctPlay({ ...sixteen(), ...counted(-1) }).action).toBe(ACTION.hit);
      const check = checkPlay({ ...sixteen(), action: ACTION.hit, nearby: [counted(-1), counted(0)] });
      expect(check).toMatchObject({ correct: false, message: 'Close call. But it should have been a Stand' });
    });

    it('is not a play no nearby count calls for', () => {
      const check = checkPlay({ ...sixteen(), action: ACTION.double, nearby: [counted(-1), counted(0)] });
      expect(check.message).toBe('That should have been a Stand');
    });
  });

  it('names the table and cell of a correct split, with no message', () => {
    const check = checkPlay({
      ...base(),
      hand: hand([card(8), card(8, HEARTS)]),
      upcard: card(1),
      action: ACTION.split,
    });
    expect(check).toEqual({
      correct: true,
      expected: ACTION.split,
      expectedName: 'Split',
      table: 'split',
      row: 3,
      column: 9,
      message: '',
    });
  });

  it('names the action the player should have taken', () => {
    const check = checkPlay({ ...base(), hand: hand([card(10), card(6)]), upcard: card(10), action: ACTION.stand });
    expect(check).toMatchObject({
      correct: false,
      expected: ACTION.surrender,
      expectedName: 'Surrender',
      table: 'surrender',
      row: 1,
      column: 8,
      message: 'That should have been a Surrender',
    });
  });

  it('reports no table for a 21, which no table decides', () => {
    const check = checkPlay({ ...base(), hand: hand([card(10), card(1)]), upcard: card(10), action: ACTION.stand });
    expect(check).toMatchObject({ correct: true, table: null, row: -1 });
  });

  it('puts an ace upcard in the last column', () => {
    const check = checkPlay({ ...base(), hand: hand([card(10), card(6)]), upcard: card(1), action: ACTION.surrender });
    expect(check).toMatchObject({ correct: true, column: 9 });
  });
});

// Insurance reads only the true count, so these counts leave out the running count.
describe('the correct insurance decision', () => {
  it('insures from the strategy index up', () => {
    const take = (trueCount: number) =>
      correctInsurance({
        strategy,
        counts: { trueCount } as PlayCounts,
        hand: hand([card(10), card(6)]),
        tenSideCount: null,
      });
    expect(take(2)).toBe(false);
    expect(take(3)).toBe(true);
  });

  it('uses the exact count where the index is fractional', () => {
    const silverFox = strategyFor(FRACTIONAL_INSURANCE_SYSTEM);
    const take = (counts: Omit<PlayCounts, 'runningCount'>) =>
      correctInsurance({ strategy: silverFox, counts: counts as PlayCounts, hand: null, tenSideCount: null });
    expect(take({ trueCount: 3, exactTrueCount: 3.9 })).toBe(true);
    expect(take({ trueCount: 4, exactTrueCount: 3.7 })).toBe(false);
  });

  it('insures on the ten side count alone when one is kept', () => {
    const take = (tens: number) =>
      correctInsurance({
        strategy,
        counts: { trueCount: 0 } as PlayCounts,
        hand: null,
        tenSideCount: { tens, decks: 6 },
      });
    expect(take(25)).toBe(true);
    expect(take(24)).toBe(false);
  });
});

describe('checking an insurance decision', () => {
  const check = (trueCount: number, tookInsurance: boolean) =>
    checkInsurance({
      strategy,
      counts: { trueCount } as PlayCounts,
      hand: hand([card(10), card(6)]),
      tenSideCount: null,
      tookInsurance,
    });

  it('accepts passing at a low count, with no table to blame', () => {
    expect(check(0, false)).toEqual({
      correct: true,
      expectedName: 'Pass',
      table: null,
      row: -1,
      column: -1,
      message: '',
    });
  });

  it('faults insuring at a low count', () => {
    expect(check(0, true)).toMatchObject({
      correct: false,
      expectedName: 'Pass',
      message: 'You should have taken no insurance',
    });
  });

  it('faults passing at a high count', () => {
    expect(check(5, false)).toMatchObject({
      correct: false,
      expectedName: 'Insure',
      message: 'You should have taken insurance',
    });
  });
});

describe('the bet a ramp calls for', () => {
  const ramp = {
    minCount: -1,
    rows: [
      { chips: 1, hands: 1 },
      { chips: 2, hands: 1 },
      { chips: 4, hands: 2 },
    ],
  };

  it('clamps the count to the rows it has', () => {
    expect(expectedBet({ ramp, chipValue: 5, count: -5 })).toEqual({ betPerHand: 5, hands: 1, chips: 1 });
    expect(expectedBet({ ramp, chipValue: 5, count: 0 })).toEqual({ betPerHand: 10, hands: 1, chips: 2 });
    expect(expectedBet({ ramp, chipValue: 5, count: 9 })).toEqual({ betPerHand: 20, hands: 2, chips: 4 });
  });

  it('falls back to one chip on one hand when the ramp has no rows', () => {
    expect(expectedBet({ ramp: { minCount: 0, rows: [] }, chipValue: 5, count: 0 })).toEqual({
      betPerHand: 5,
      hands: 1,
      chips: 1,
    });
  });
});

describe('checking a bet', () => {
  const ramp = {
    minCount: -1,
    rows: [
      { chips: 1, hands: 1 },
      { chips: 2, hands: 1 },
      { chips: 4, hands: 2 },
    ],
  };
  const check = (count: number, betPerHand: number, hands: number) =>
    checkBet({ ramp, chipValue: 5, count, betPerHand, hands });

  it('accepts the bet the ramp calls for', () => {
    expect(check(0, 10, 1)).toMatchObject({ correct: true, message: '', tooHigh: false });
  });

  it('asks for the amount when the ramp calls for one hand', () => {
    expect(check(0, 5, 1)).toMatchObject({ correct: false, message: 'You should have bet $10', tooHigh: false });
  });

  it('asks for the number of hands as well when the ramp calls for more than one', () => {
    expect(check(9, 10, 1)).toMatchObject({ correct: false, message: 'You should have bet 2 hands of $20' });
  });

  it('flags a bet that is too high rather than too low', () => {
    expect(check(0, 50, 1).tooHigh).toBe(true);
    expect(check(0, 5, 1).tooHigh).toBe(false);
  });
});
