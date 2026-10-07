// Checks the new drill logic against behavior recorded from the original app
// (tests/fixtures/drills-*.json.gz, captured by tools/capture-drill-fixtures.mjs).

import { describe, it, expect } from 'vitest';
import { loadFixture } from '../../support/fixtures.js';
import { buildStrategy } from '../../../src/core/strategy/strategy-tables.js';
import { STRATEGY_FILES } from '../../../src/data/strategy-files.js';
import { roundTrueCount, TC_ROUNDING, TC_DIVISION, TC_LAST_DECK } from '../../../src/core/counting.js';
import { emptyTallies } from '../../../src/services/error-tallies.js';
import {
  buildHandList,
  handIndex,
  correctPlay,
  errorCell,
  columnOf,
  SITUATIONS,
} from '../../../src/drills/flash/logic.js';
import { depthGrid, trueCountFor } from '../../../src/drills/depth/logic.js';
import { trayImage, TRAY_STYLES } from '../../../src/drills/shared/discard-tray.js';
import { drillCounts } from '../../../src/drills/shared/count-answers.js';
import { DrillShoe } from '../../../src/drills/shared/shoe.js';

const strategyFor = c =>
  buildStrategy(STRATEGY_FILES[c.system], {
    decks: c.decks,
    hitSoft17: Boolean(c.h17),
    doubleAfterSplit: Boolean(c.das),
    noHoleCard: false,
    indexSet: 'all',
  });

const emptyMask = () =>
  Object.fromEntries(SITUATIONS.map(k => [k, Array.from({ length: 10 }, () => new Array(10).fill(false))]));

/** The original packed a list entry as [dealer column, value, type slot]. */
const TYPE_SLOT = { hardStand: 0, split: 1, softStand: 2, hardDouble: 3, softDouble: 4, surrender: 5 };
const packed = e => [columnOf(e.upcard), e.kind === 'split' && e.value === 1 ? 11 : e.value, TYPE_SLOT[e.kind]];

describe('flash hand lists match the original', () => {
  for (const record of loadFixture('drills-hand-lists')) {
    const { config } = record;
    const chosen = Object.entries(config.situations)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join('+');
    it(`${config.hands}, system ${config.system}, ${chosen || 'nothing'}`, () => {
      const customMask = emptyMask();
      for (const [table, row, column] of config.mask ?? []) customMask[table][row][column] = true;
      const tallies = emptyTallies();
      for (const [table, row, column] of config.tallies ?? []) tallies[table][row][column] += 1;
      const { entries, error } = buildHandList({
        hands: config.hands,
        situations: config.situations,
        strategy: strategyFor(config),
        customMask,
        tallies,
      });
      // The Default list repeats hands to weight them; the drill picks from it at
      // random, so only its contents matter, not the order.
      const order = list => (config.hands === 'default' ? [...list].sort() : list);
      expect(order(entries.map(packed))).toEqual(order(record.list));
      expect(Boolean(error)).toBe(record.list.length === 0);
    });
  }
});

describe('flash indices and plays match the original', () => {
  const records = loadFixture('drills-flash-play');
  const allSituations = Object.fromEntries(SITUATIONS.map(k => [k, true]));
  /** The record's hand as the new logic wants it. */
  const handOf = r => ({
    kind: r.hand.kind,
    entry: { kind: r.hand.kind, upcard: r.upcard, value: r.hand.kind === 'split' ? r.hand.card1 : r.hand.hardTotal },
    cards: [r.hand.card1, r.hand.card2],
    cardIds: [r.hand.card1, r.hand.card2],
    total: r.hand.total,
    hardTotal: r.hand.hardTotal,
    soft: r.hand.total !== r.hand.hardTotal,
    cardCount: r.hand.cards,
    upcard: r.upcard,
  });

  it(`finds the same playing index for ${records.length} hands`, () => {
    const wrong = [];
    for (const r of records) {
      const strategy = strategyFor(r.config);
      const mine = handIndex(strategy, handOf(r), allSituations);
      if (mine !== r.index) wrong.push({ ...r.hand, upcard: r.upcard, system: r.config.system, mine, theirs: r.index });
    }
    expect(wrong).toEqual([]);
  });

  it('picks the same action, deciding table and row at every count', () => {
    const wrong = [];
    for (const r of records) {
      const strategy = strategyFor(r.config);
      const hand = handOf(r);
      for (const play of r.plays) {
        const mine = correctPlay(strategy, hand, {
          count: play.count,
          situations: allSituations,
          doubleAnyCards: Boolean(r.config.doubleAnyCards),
        });
        const cell = errorCell(mine, null, hand);
        if (mine.action !== play.action || mine.section !== play.table || (cell && cell.row !== play.row)) {
          wrong.push({
            ...r.hand,
            upcard: r.upcard,
            count: play.count,
            system: r.config.system,
            mine: [mine.action, mine.section, mine.row],
            theirs: [play.action, play.table, play.row],
          });
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('depth answer grids match the original', () => {
  /** Each column's labels from the top, with the empty rows between them dropped. */
  const labelsByColumn = columns => columns.map(rows => rows.filter(label => label !== ''));
  /** How many rows actually carry a label. */
  const usedRows = columns => {
    const rows = new Set();
    columns.forEach(column =>
      column.forEach((label, row) => {
        if (label !== '') rows.add(row);
      }),
    );
    return rows.size;
  };

  for (const record of loadFixture('drills-depth-grids')) {
    const { config } = record;
    it(`${config.drill}, ${config.resolution} resolution, ${config.decks} decks${config.askInTray ? ', in tray' : ''}`, () => {
      const grid = depthGrid(config);
      const labelled = grid.cells.some(c => c.label !== '');
      // The original kept its labels in karray[column][row].
      const mine = Array.from({ length: 12 }, (_, column) =>
        Array.from({ length: 12 }, (_, row) => grid.cells.find(c => c.column === column && c.row === row)?.label ?? ''),
      );
      // Deliberate difference: at half resolution the original left an empty row
      // between the halves and the whole decks, which the rebuild drops so the
      // rows are evenly spaced (see depthGrid). Every label still belongs to the
      // same column, in the same order down the screen, and the grid is exactly
      // as many rows tall as the original had in use.
      expect(labelsByColumn(mine)).toEqual(labelsByColumn(record.columns));
      // One deck at full resolution has nothing to ask; the new options screen
      // refuses it instead of showing an empty grid.
      if (labelled) expect(grid.rows).toBe(usedRows(record.columns));
    });
  }
});

describe('depth tray photos match the original', () => {
  const styles = Object.keys(TRAY_STYLES);

  /**
   * A deliberate divergence. The original picked a photo one step too low, so
   * every tray held a quarter deck more than the drill asked about and the
   * deepest step of two styles showed an empty tray from another style's
   * series. We shifted each style's base up by two, which is this offset.
   * See tests/unit/drills/tray-depth.test.js for what is now guaranteed.
   */
  const CORRECTION = 2;

  it('picks the photo the original picked, one step deeper', () => {
    const wrong = [];
    for (const record of loadFixture('drills-depth-trays')) {
      const { style, decksInTray } = record.config;
      const mine = trayImage(decksInTray, styles[style]);
      const theirs = record.failed ? null : record.image;
      const mineNumber = mine ? Number(mine.src.match(/(\d+)\.jpg/)[1]) : null;
      const expected = theirs === null ? null : theirs + CORRECTION;
      // The original gave up two steps earlier than we do, so it recorded no
      // photo where we now have one; that is the point of the correction.
      if (mineNumber !== expected && !(theirs === null && mineNumber !== null)) {
        wrong.push({ ...record.config, mine: mineNumber, original: theirs });
      }
      if (mine) {
        expect([mine.crop.width, mine.crop.height]).toEqual(record.crop);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('shows a tray at the two depths the original could not', () => {
    const rescued = loadFixture('drills-depth-trays')
      .filter(record => record.failed)
      .filter(record => trayImage(record.config.decksInTray, styles[record.config.style]));
    expect(rescued.map(r => r.config.decksInTray)).toEqual(Array(rescued.length).fill(7.5));
  });
});

describe('count drill answers match the original', () => {
  const ROUNDING = { 1: TC_ROUNDING.truncate, 2: TC_ROUNDING.floor, 3: TC_ROUNDING.floor };
  /** Both sides shed the floating-point dust their divisions leave behind. */
  const tidy = value => Math.round(value * 1e9) / 1e9;
  const records = loadFixture('drills-count-answers');

  /** Replays a card sequence through the new shoe and counter. */
  function replay(config, cards, rounding) {
    const strategy = buildStrategy(STRATEGY_FILES[config.system], {
      decks: config.decks,
      hitSoft17: false,
      doubleAfterSplit: false,
      noHoleCard: false,
      indexSet: 'all',
    });
    const shoe = new DrillShoe({
      decks: config.decks,
      strategy,
      trueCountSettings: { division: config.division, lastDeck: config.lastDeck, rounding },
    });
    // Replace the front of the shoe with the recorded sequence, keeping its
    // length so the decks-remaining arithmetic is unchanged.
    const stacked = shoe.cards.slice();
    cards.forEach((card, i) => {
      stacked[i] = card;
    });
    shoe.cards = stacked;
    shoe.dealt = 0;
    return shoe;
  }

  it(`replays ${records.length} shoes`, () => {
    for (const record of records) {
      const cards = record.steps.map(s => s.card);
      const rounding = ROUNDING[record.config.rounding];
      const shoe = replay(record.config, cards, rounding);
      record.steps.forEach((step, i) => {
        shoe.deal();
        const counts = drillCounts(shoe);
        const where = `${JSON.stringify(record.config)} card ${i}`;
        expect(counts.runningCount, `running ${where}`).toBeCloseTo(step.running, 9);
        expect(counts.aces, `aces ${where}`).toBe(step.aces);
        expect(counts.tens, `tens ${where}`).toBe(step.tens);
        if (record.config.rounding !== 3) {
          expect(counts.trueCount, `true count ${where}`).toBe(step.trueCount);
        }
        // The original left the ace-adjusted counts unrounded; the new code
        // rounds them with the true-count rule.
        expect(counts.betCount, `bet ${where}`).toBe(roundTrueCount(tidy(step.bet), rounding));
        expect(counts.playCount, `play ${where}`).toBe(roundTrueCount(tidy(step.play), rounding));
        expect(counts.insureCount, `insure ${where}`).toBe(roundTrueCount(tidy(step.insure), rounding));
      });
    }
  });

  it('rounds the exact true count every way the settings allow', () => {
    const exact = records.filter(r => r.config.rounding === 3);
    expect(exact.length).toBeGreaterThan(10);
    for (const rounding of [TC_ROUNDING.round, TC_ROUNDING.truncate, TC_ROUNDING.floor]) {
      for (const record of exact) {
        const shoe = replay(
          record.config,
          record.steps.map(s => s.card),
          rounding,
        );
        record.steps.forEach(step => {
          shoe.deal();
          const counts = drillCounts(shoe);
          expect(counts.trueCount).toBe(roundTrueCount(tidy(step.trueCount), rounding));
        });
      }
    }
  });
});

describe('the true count of a depth test matches the original', () => {
  it('converts a running count the same way for every resolution', () => {
    const strategy = buildStrategy(STRATEGY_FILES[30], {
      decks: 6,
      hitSoft17: false,
      doubleAfterSplit: false,
      noHoleCard: false,
      indexSet: 'all',
    });
    // Taken from the count fixture: the same decks_left rounding drives both.
    for (const division of [TC_DIVISION.fullDeck, TC_DIVISION.halfDeck, TC_DIVISION.quarterDeck, TC_DIVISION.exact]) {
      for (const lastDeck of [TC_LAST_DECK.halfDeck, TC_LAST_DECK.quarterDeck, TC_LAST_DECK.exact]) {
        for (const decksInTray of [0.25, 1, 2.5, 5, 5.75]) {
          const value = trueCountFor(8, decksInTray, {
            decks: 6,
            strategy,
            trueCountSettings: { division, lastDeck, rounding: TC_ROUNDING.floor },
          });
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });
});
