// Per-cell counts of strategy errors, shared by the game and the Flash drill
// ("Drill Errors" hands). Each table is a 10 x 10 grid indexed like the
// strategy tables: [row][dealer column].

import { TABLE_NAMES } from '../core/strategy/strategy-file.js';

const STORAGE_KEY = 'errorTallies';

const emptyGrid = () => Array.from({ length: 10 }, () => new Array(10).fill(0));
export const emptyTallies = () => Object.fromEntries(TABLE_NAMES.map(name => [name, emptyGrid()]));

export class ErrorTallies {
  constructor(storage) {
    this.storage = storage;
  }

  load() {
    return { ...emptyTallies(), ...this.storage.get(STORAGE_KEY, {}) };
  }

  /** Records one error in `table` (a TABLE_NAMES entry) at [row][column]. */
  record(table, row, column) {
    if (row < 0 || row > 9 || column < 0 || column > 9) return;
    const tallies = this.load();
    tallies[table][row][column] += 1;
    this.storage.set(STORAGE_KEY, tallies);
  }

  clear() {
    this.storage.remove(STORAGE_KEY);
  }

  /** Cells with at least one error, most frequent first: [{table, row, column, count}]. */
  cells() {
    const tallies = this.load();
    const out = [];
    for (const table of TABLE_NAMES) {
      tallies[table].forEach((r, row) => r.forEach((count, column) => { if (count > 0) out.push({ table, row, column, count }); }));
    }
    return out.sort((a, b) => b.count - a.count);
  }
}
