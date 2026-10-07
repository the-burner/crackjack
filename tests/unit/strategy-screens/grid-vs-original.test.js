// Compares the strategy-table presentation model with what the original app's
// table viewer drew, recorded in tests/fixtures/strategy-screens-tables.json.gz.

import { describe, it, expect } from 'vitest';
import { buildStrategy, INDEX_SETS } from '../../../src/core/strategy/strategy-tables.js';
import { STRATEGY_FILES } from '../../../src/data/strategy-files.js';
import { loadFixture } from '../../support/fixtures.js';
import { ALWAYS, NEVER, NO_ENTRY } from '../../../src/core/strategy/strategy-file.js';
import {
  TABLE_VIEWS,
  columnLabels,
  countsTables,
  gridCell,
  isIndexCell,
  rowCount,
  rowLabels,
  specialtyPlays,
  viewByKey,
} from '../../../src/core/strategy/strategy-grid.js';

/**
 * The recorded views number the tables in the original's order; this maps each
 * of our TABLE_VIEWS (by position) to that number.
 */
const TABLE_NUMBERS = [0, 4, 1, 2, 3, 5];

/** The recording has CSS colours as "rgb(r, g, b)". */
const RGB = {
  '#00ff00': 'rgb(0, 255, 0)',
  '#ff0000': 'rgb(255, 0, 0)',
  '#00ffff': 'rgb(0, 255, 255)',
  '#0000ff': 'rgb(0, 0, 255)',
};
/** Blank cells were a single space. */
const blank = text => (text ?? '').trim();

const viewFor = tablenum => TABLE_VIEWS.find((_, i) => TABLE_NUMBERS[i] === tablenum);

function strategyFor(config) {
  return buildStrategy(STRATEGY_FILES[config.system], {
    decks: config.decks,
    hitSoft17: config.h17,
    doubleAfterSplit: config.das,
    noHoleCard: config.noHoleCard,
    indexSet: INDEX_SETS[config.indexSet],
    rangeHigh: config.rangeHigh ?? 99,
    rangeLow: config.rangeLow ?? -99,
  });
}

const records = loadFixture('strategy-screens-tables');

describe.each(records.map(r => [`${r.name} ${JSON.stringify(r.config)}`, r]))('%s', (_, record) => {
  const strategy = strategyFor(record.config);
  const extended = strategy.extended;

  it('has the same name and shape', () => {
    expect(strategy.name).toBe(record.name);
    expect(strategy.extended).toBe(record.extended);
    expect(strategy.earlySurrender).toBe(record.earlySurrender);
    expect(extended ? 23 : 10).toBe(record.columns);
  });

  it('heads the columns the same way', () => {
    expect(columnLabels({ extended })).toEqual(record.views[0].columnLabels);
  });

  for (const recorded of record.views) {
    const view = viewFor(recorded.tablenum);
    const rows = rowCount(view, { extended });

    describe(view.label, () => {
      it('labels the rows the same way', () => {
        expect(rowLabels(view, { extended, earlySurrender: strategy.earlySurrender })).toEqual(
          recorded.rowLabels.filter(label => label !== ''),
        );
      });

      it('shows the same text in every cell', () => {
        const table = strategy.tables[view.table];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < record.columns; c++) {
            expect(gridCell({ value: table[r][c], view }).text, `row ${r} col ${c}`).toBe(blank(recorded.cells[r][c]));
          }
        }
      });

      it('uses the same colours', () => {
        const table = strategy.tables[view.table];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < record.columns; c++) {
            const cell = gridCell({ value: table[r][c], view });
            expect(RGB[cell.background], `row ${r} col ${c}`).toBe(recorded.colors[r][c]);
          }
        }
      });

      it('labels the legend boxes the same way', () => {
        expect(view.legend).toEqual(recorded.legend);
      });

      it('lists the same specialty plays', () => {
        const plays = specialtyPlays(strategy.tables[view.table], view, { extended, columns: record.columns });
        expect(plays).toEqual(recorded.specialty.filter(text => text !== 'none'));
      });
    });
  }

  it('fills the Insurance/Counts tables the same way', () => {
    const counts = countsTables(strategy);
    expect([counts.pointValues.rows[0].label, ...counts.pointValues.rows[0].values]).toEqual(
      record.counts.pointValues[0],
    );
    expect([counts.pointValues.rows[1].label, ...counts.pointValues.rows[1].values]).toEqual(
      record.counts.pointValues[1],
    );
    expect(counts.startingCount.rows[0].values).toEqual(record.counts.startingCount[0]);
    expect(counts.insuranceHands.rows[0].values).toEqual(record.counts.insuranceHands[0]);
    expect(counts.rule).toBe(record.counts.rule);
    // The original left the per-deck table showing the previous strategy's
    // numbers when the current one does not use it, so only check it when it does.
    if (counts.insuranceDecks) expect(counts.insuranceDecks.rows[0].values).toEqual(record.counts.insuranceDecks[0]);
  });
});

describe('views the recording does not cover', () => {
  it('gives the Insurance/Counts view no row labels', () => {
    expect(rowLabels(viewByKey('counts'))).toEqual([]);
  });

  it('counts only cells holding a real index as pickable for a mask', () => {
    expect(isIndexCell(-3)).toBe(true);
    expect(isIndexCell(0)).toBe(true);
    expect(isIndexCell(ALWAYS)).toBe(false);
    expect(isIndexCell(NEVER)).toBe(false);
    expect(isIndexCell(NO_ENTRY)).toBe(false);
  });
});
