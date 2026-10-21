// @vitest-environment jsdom
// Drill regressions, driven through the controllers with no screen: what the
// index test may ask, an unanswered test when time runs out, Pause once a run
// is over, and a pending next test against Pause, Restart and double taps.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../support/render';
import { seededRandom } from '@/core/random';
import { ACTION } from '@/core/strategy/advisor';
import { emptyTallies } from '@/services/error-tallies';
import type { SettingsPatch } from '@/settings/schema';
import type { App } from '@/app/app';
import type { DrillShell } from '@/drills/shared/drill-shell';
import type { GridTap } from '@/drills/shared/grid-answers';
import { DrillShoe } from '@/drills/shared/shoe';
import { createFlashDrill } from '@/drills/flash/controller';
import { createDepthDrill } from '@/drills/depth/controller';
import { createCountDrill } from '@/drills/count/controller';
import { createFullDrill } from '@/drills/full/controller';

const BOX = { left: 0, top: 0, width: 600, height: 300 };
const gridCanvas = { getBoundingClientRect: () => BOX } as Element;

/** A tap at a fraction of the way across and down an answer grid. */
const tapAt = (x: number, y: number): GridTap => ({
  clientX: x * BOX.width,
  clientY: y * BOX.height,
  currentTarget: gridCanvas,
});

/** The middle of a cell of a 3 x 6 count grid. */
const cell = (row: number, column: number) => tapAt((column + 0.5) / 6, (row + 0.5) / 3);
const EVERY_CELL = Array.from({ length: 18 }, (_, i) => cell(i % 3, Math.floor(i / 3)));

const wait = (ms: number) => vi.advanceTimersByTime(ms);

function appWith(settings: SettingsPatch): App {
  const app = createTestApp();
  app.settings.update(settings);
  return app;
}

/** Shows the drill and waits out its "2, 1" countdown. */
function launch<T extends { shell: DrillShell }>(drill: T): T {
  drill.shell.show();
  wait(2000);
  return drill;
}

const view = (shell: DrillShell) => shell.getSnapshot();
const tests = (shell: DrillShell) => view(shell).stats.count;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(7));
  HTMLImageElement.prototype.decode = () => Promise.resolve();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ONLY_HARD_STAND = {
  hardStand: true,
  softStand: false,
  hardDouble: false,
  softDouble: false,
  split: false,
  surrender: false,
};

/** Custom hands of one Hard H/S cell. */
const maskWith = (row: number, column: number) => {
  const grid = () => Array.from({ length: 10 }, () => new Array<boolean>(10).fill(false));
  const mask = {
    split: grid(),
    hardStand: grid(),
    softDouble: grid(),
    hardDouble: grid(),
    softStand: grid(),
    surrender: grid(),
  };
  mask.hardStand[row][column] = true;
  return mask;
};

/** Every hand is 16 against a ten at a count of zero, so Stand is right. */
const FIXED_16_V_TEN: SettingsPatch = {
  'drills.flash.hands': 'custom',
  'drills.flash.shuffle': 'random',
  'drills.flash.customHands': maskWith(1, 8),
  'drills.flash.situations': ONLY_HARD_STAND,
  'drills.flash.countMode': 'fixed',
  'drills.flash.fixedCount': 0,
  'drills.flash.maxCards': 2,
  'drills.flash.timerMode': 'auto',
  'drills.flash.seconds': 60,
  'drills.flash.handsPerDrill': 10,
  'drills.flash.strategy.system': 30,
};

const flash = (settings: SettingsPatch) => launch(createFlashDrill(appWith(settings), { openTable: () => {} }));

describe('flash drill', () => {
  it('the index test refuses a hand that has no index of its own', () => {
    // Hard 17 against a six is always Stand, so there is no index to be asked for.
    const { shell } = flash({
      'drills.flash.hands': 'custom',
      'drills.flash.shuffle': 'random',
      'drills.flash.customHands': maskWith(0, 4),
      'drills.flash.situations': ONLY_HARD_STAND,
      'drills.flash.countMode': 'indexTest',
      'drills.flash.maxCards': 2,
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
      'drills.flash.strategy.system': 30,
    });
    expect(view(shell).message).toContain('no tests configured');
    expect(tests(shell)).toBe('Hands: 0');
  });

  it('pause is off once the drill has finished', () => {
    const drill = flash({ ...FIXED_16_V_TEN, 'drills.flash.testMode': 'errorsAtEnd' });
    for (let hand = 0; hand < 10; hand++) drill.answer(ACTION.stand);
    expect(tests(drill.shell)).toBe('Hands: 10');
    expect(view(drill.shell).pauseDisabled).toBe(true);
    // Restart brings it back with the new run.
    drill.shell.restart();
    wait(2000);
    expect(view(drill.shell).pauseDisabled).toBe(false);
  });

  it('no tests mode neither grades the index test nor records an error', () => {
    const app = appWith({
      'drills.flash.hands': 'withIndices',
      'drills.flash.shuffle': 'random',
      'drills.flash.countMode': 'indexTest',
      'drills.flash.testMode': 'none',
      'drills.flash.timerMode': 'infinite',
      'drills.flash.seconds': 60,
    });
    const drill = launch(createFlashDrill(app, { openTable: () => {} }));
    for (const tap of EVERY_CELL) drill.gridTap(tap);
    expect(tests(drill.shell)).toBe('Hands: 19');
    expect(view(drill.shell).stats.accuracy).toBe('No Tests');
    expect(app.errorTallies.load()).toEqual(emptyTallies());
  });

  it('an unanswered hand is not scored when the clock halts', () => {
    const { shell } = flash({
      ...FIXED_16_V_TEN,
      'drills.flash.testMode': 'warn',
      'drills.flash.timerMode': 'countDownHalt',
      'drills.flash.drillSeconds': 10,
    });
    expect(tests(shell)).toBe('Hands: 1');
    wait(11000);
    expect(tests(shell)).toBe('Hands: 0');
    expect(view(shell).stats.accuracy).toBe('Accuracy: 0%');
  });
});

/** Two decks at full resolution: the only answer is "1", in the middle of the grid. */
const TWO_DECK_DEPTH: SettingsPatch = {
  'drills.depth.decks': 2,
  'drills.depth.resolution': 'full',
  'drills.depth.trayStyle': 'sixDeckFront',
  'drills.depth.timerMode': 'auto',
  'drills.depth.seconds': 60,
  'drills.depth.testsPerDrill': 50,
  'drills.depth.accuracy': 0,
};
const RIGHT_DEPTH = tapAt(0.5, 0.5);

/** The true-count drill with a count range no one-deck shoe can reach. */
const NO_DEPTH_TESTS: SettingsPatch = {
  'drills.depth.drill': 'trueCount',
  'drills.depth.decks': 1,
  'drills.depth.resolution': 'half',
  'drills.depth.countRangeMin': 30,
  'drills.depth.countRangeMax': 64,
  'drills.depth.timerMode': 'auto',
  'drills.depth.seconds': 60,
};

const depth = (settings: SettingsPatch) => launch(createDepthDrill(appWith(settings)));

describe('depth drill', () => {
  it('a pause leaves no test waiting from the answer before it', () => {
    const drill = depth(TWO_DECK_DEPTH);
    drill.tap(RIGHT_DEPTH);
    drill.shell.togglePause();
    const before = drill.shell.score.tests;
    // Past the pause the answer leaves before the next test is built.
    wait(400);
    expect(drill.shell.score.tests).toBe(before);
    expect(view(drill.shell).pauseLabel).toBe('Continue');
  });

  it('a restarted drill builds no test during its countdown', () => {
    const drill = depth(TWO_DECK_DEPTH);
    drill.tap(RIGHT_DEPTH);
    drill.shell.restart();
    wait(400);
    expect(view(drill.shell).countdown).not.toBe(null);
    expect(drill.shell.score.tests).toBe(1);
  });

  it('counts one test for two quick taps on the right answer', () => {
    const drill = depth(TWO_DECK_DEPTH);
    expect(tests(drill.shell)).toBe('Tests: 1');
    drill.tap(RIGHT_DEPTH);
    drill.tap(RIGHT_DEPTH);
    // Past the pause after an answer, by which a second advance would have come.
    wait(400);
    expect(tests(drill.shell)).toBe('Tests: 2');
  });

  it('says when the options allow no tests at all', () => {
    const { shell } = depth(NO_DEPTH_TESTS);
    expect(view(shell).message).toBe('No tests can be shown with these options.');
  });

  it('a finished drill offers no Pause', () => {
    const { shell } = depth(NO_DEPTH_TESTS);
    expect(view(shell).pauseDisabled).toBe(true);
  });
});

const count = (settings: SettingsPatch) => launch(createCountDrill(appWith(settings)));

/** Taps every cell of a count grid twice in one tick, so the right one is among them. */
const tapEveryCellTwice = (drill: { tap: (tap: GridTap) => void }) => {
  for (let pass = 0; pass < 2; pass++) for (const tap of EVERY_CELL) drill.tap(tap);
};

/** Records when each drill card is dealt. */
const recordDeals = () => {
  const deals: number[] = [];
  const deal = DrillShoe.prototype.deal;
  vi.spyOn(DrillShoe.prototype, 'deal').mockImplementation(function recordedDeal(this: DrillShoe) {
    deals.push(Date.now());
    return deal.call(this);
  });
  return deals;
};

describe('count drill answers', () => {
  it('deals once after a right answer tapped twice', () => {
    const drill = count({
      'drills.count.decks': 1,
      'drills.count.cardsPerFlash': '1',
      'drills.count.testEvery': 'everyCard',
      'drills.count.dealByHand': true,
      'drills.count.accuracy': 0,
      'drills.count.alarmSeconds': 1799,
    });
    const deals = recordDeals();
    drill.next();
    drill.next();
    expect(drill.getSnapshot().gridShown).toBe(true);

    tapEveryCellTwice(drill);
    wait(200);
    // One card comes, then the player deals the next test by hand.
    expect(drill.getSnapshot().gridShown).toBe(false);
    expect(drill.getSnapshot().nextShown).toBe(true);
    expect(deals).toHaveLength(2);
  });

  it('a Restart right after a right answer deals at the set speed', () => {
    const drill = count({
      'drills.count.decks': 1,
      'drills.count.cardsPerFlash': '1',
      'drills.count.testEvery': 'everyCard',
      'drills.count.accuracy': 0,
      'drills.count.dealTenths': 5,
      'drills.count.timerMode': 'countDownHalt',
      'drills.count.alarmSeconds': 1799,
    });
    wait(500);
    expect(drill.getSnapshot().gridShown).toBe(true);
    tapEveryCellTwice(drill);
    drill.shell.restart();
    const deals = recordDeals();
    wait(2000);
    wait(2000);
    const gaps = deals.slice(1).map((t, i) => t - deals[i]);
    // Every half second, never two deal loops at once.
    expect(gaps.every(gap => gap > 350)).toBe(true);
  });
});

describe('count drill Infinite', () => {
  /** Infinite, one card at a time every tenth of a second, from one deck. */
  const INFINITE: SettingsPatch = {
    'drills.count.decks': 1,
    'drills.count.cardsPerFlash': '1',
    'drills.count.testEvery': 'never',
    'drills.count.accuracy': 0,
    'drills.count.dealTenths': 1,
    'drills.count.timerMode': 'infinite',
  };

  it('shuffles a new shoe when one runs out, says so, and deals on', () => {
    const drill = count(INFINITE);
    const deals: { shoe: DrillShoe; at: number }[] = [];
    const deal = DrillShoe.prototype.deal;
    vi.spyOn(DrillShoe.prototype, 'deal').mockImplementation(function recordedDeal(this: DrillShoe) {
      deals.push({ shoe: this, at: Date.now() });
      return deal.call(this);
    });
    wait(60 * 100 + 3000);
    const shoes = [...new Set(deals.map(d => d.shoe))];
    expect(shoes.length).toBeGreaterThan(1);
    // The first shoe dealt every card it had, then "Shuffle" showed for a moment.
    const first = deals.filter(d => d.shoe === shoes[0]);
    expect(first.length).toBeGreaterThanOrEqual(51);
    const next = deals.find(d => d.shoe === shoes[1])!;
    expect(next.at - first.at(-1)!.at).toBeGreaterThanOrEqual(3000);
    expect(drill.shell.paused).toBe(false);
  });

  it('pauses between deals once each interval is up, until Continue', () => {
    const drill = count({
      ...INFINITE,
      'drills.count.dealTenths': 10,
      'drills.count.decks': 2,
      'drills.count.autoPause': true,
      'drills.count.autoPauseSeconds': 5,
    });
    const deals = recordDeals();
    wait(6000);
    expect(drill.shell.paused).toBe(true);
    expect(drill.getSnapshot().shell.message).toBe('0:05 done: 0 tests, 0%');
    const dealt = deals.length;
    wait(30000);
    expect(deals).toHaveLength(dealt);
    drill.shell.togglePause();
    wait(5000);
    expect(drill.shell.paused).toBe(false);
    expect(deals.length).toBeGreaterThan(dealt);
  });

  it('times each test only when Time limit per test is on', () => {
    const tested = { ...INFINITE, 'drills.count.testEvery': 'everyCard', 'drills.count.testSeconds': 2 } as const;
    const untimed = count({ ...tested, 'drills.count.timePerTest': false });
    wait(5000);
    expect(untimed.getSnapshot().gridShown).toBe(true);
    expect(untimed.shell.score.errors).toBe(0);
    untimed.shell.destroy();
    const timed = count({ ...tested, 'drills.count.timePerTest': true });
    wait(5000);
    expect(timed.shell.score.errors).toBe(1);
  });
});

describe('count drill time up', () => {
  /** Count Down & Halt over ten seconds, a card every three, and no tests of its own. */
  const HALT: SettingsPatch = {
    'drills.count.decks': 1,
    'drills.count.cardsPerFlash': '1',
    'drills.count.testEvery': 'never',
    'drills.count.accuracy': 0,
    'drills.count.dealTenths': 30,
    'drills.count.timerMode': 'countDownHalt',
    'drills.count.alarmSeconds': 10,
  };

  it('asks one last test when the time runs out, and ends only once it is answered', () => {
    const drill = count(HALT);
    const gridShown = () => drill.getSnapshot().gridShown;
    wait(8000);
    expect(gridShown()).toBe(false);
    wait(4000);
    // A test, though no test was due.
    expect(gridShown()).toBe(true);
    wait(10000);
    expect(gridShown()).toBe(true);
    expect(view(drill.shell).pauseDisabled).toBe(false);
    tapEveryCellTwice(drill);
    wait(2000);
    expect(gridShown()).toBe(false);
    expect(view(drill.shell).pauseDisabled).toBe(true);
  });

  it('time running out mid-flash leaves the cards their full time before the last test', () => {
    const drill = count(HALT);
    // Cards at 0, 3, 6, 9 and 12 s; the time runs out at 10 s, between two of them.
    wait(11500);
    expect(drill.getSnapshot().gridShown).toBe(false);
    wait(1000);
    expect(drill.getSnapshot().gridShown).toBe(true);
  });

  it('a test on screen when the time runs out is the last one', () => {
    const drill = count({ ...HALT, 'drills.count.testEvery': 'everyCard', 'drills.count.dealTenths': 5 });
    wait(500);
    expect(drill.getSnapshot().gridShown).toBe(true);
    wait(12000);
    expect(drill.getSnapshot().gridShown).toBe(true);
    expect(view(drill.shell).pauseDisabled).toBe(false);
    tapEveryCellTwice(drill);
    wait(2000);
    expect(view(drill.shell).pauseDisabled).toBe(true);
  });
});

const full = (settings: SettingsPatch) => launch(createFullDrill(appWith(settings)));

describe('full table drill', () => {
  it('Two Tables runs its shoe out without crashing', () => {
    const drill = full({
      'drills.full.drill': 'twoTables',
      'drills.full.decks': 1,
      'drills.full.players': 6,
      'drills.full.timerMode': 'auto',
      'drills.full.testSeconds': 40,
      'drills.full.flashSpeed': 30,
      'drills.full.accuracy': 0,
    });
    expect(drill.getSnapshot().gridShown).toBe(true);
    for (let question = 0; question < 200 && drill.getSnapshot().gridShown; question++) {
      const before = drill.shell.score.tests;
      for (const tap of EVERY_CELL) {
        drill.tap(tap);
        // Past the pause after a right answer, so the test has moved on if it was.
        wait(120);
        if (drill.shell.score.tests !== before || !drill.getSnapshot().gridShown) break;
      }
    }
    expect(drill.getSnapshot().gridShown).toBe(false);
    expect(view(drill.shell).pauseDisabled).toBe(true);
  });

  it('a double tap on the right answer moves on by one test, not two', () => {
    const drill = full({
      'drills.full.timerMode': 'auto',
      'drills.full.testSeconds': 40,
      'drills.full.flashSpeed': 30,
      'drills.full.accuracy': 0,
    });
    for (let i = 0; i < 18 && tests(drill.shell) === 'Tests: 1'; i++) {
      drill.tap(EVERY_CELL[i]);
      drill.tap(EVERY_CELL[i]);
      // Past the pause after a right answer, by which a second advance would have come.
      wait(150);
    }
    expect(tests(drill.shell)).toBe('Tests: 2');
  });

  it('an unanswered test is not scored when the drill time runs out', () => {
    const drill = full({
      'drills.full.timerMode': 'countDownHalt',
      'drills.full.alarmSeconds': 10,
      'drills.full.flashSpeed': 30,
    });
    expect(tests(drill.shell)).toBe('Tests: 1');
    wait(11000);
    expect(drill.getSnapshot().gridShown).toBe(false);
    expect(tests(drill.shell)).toBe('Tests: 0');
    expect(view(drill.shell).stats.accuracy).toBe('Accuracy: 0%');
  });
});
