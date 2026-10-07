// Per-cell counts of strategy errors, shared by the game and the Flash drill
// ("Drill Errors" hands). Each table is a 10 x 10 grid indexed like the
// strategy tables: [row][dealer column].

import { TABLE_NAMES } from '@/core/strategy/strategy-file';
import type { TableName } from '@/core/strategy/strategy-file';
import type { Storage } from './storage';

const STORAGE_KEY = 'errorTallies';

/** Error counts per strategy table, each a 10 x 10 grid. */
export type Tallies = Record<TableName, number[][]>;

/** One cell with at least one error. */
export interface TallyCell {
  table: TableName;
  row: number;
  column: number;
  count: number;
}

const emptyGrid = (): number[][] => Array.from({ length: 10 }, () => new Array<number>(10).fill(0));
export const emptyTallies = (): Tallies => Object.fromEntries(TABLE_NAMES.map(name => [name, emptyGrid()])) as Tallies;

const isGrid = (grid: unknown): grid is number[][] =>
  Array.isArray(grid) && grid.length === 10 && grid.every(row => Array.isArray(row) && row.length === 10);

export class ErrorTallies {
  readonly storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  load(): Tallies {
    const saved = this.storage.get(STORAGE_KEY, {});
    const tallies = emptyTallies();
    // A damaged grid is thrown away rather than left to break recording.
    for (const name of TABLE_NAMES) if (isGrid(saved[name])) tallies[name] = saved[name];
    return tallies;
  }

  /** Records one error in `table` (a TABLE_NAMES entry) at [row][column]. */
  record(table: TableName, row: number, column: number) {
    if (row < 0 || row > 9 || column < 0 || column > 9) return;
    const tallies = this.load();
    tallies[table][row][column] += 1;
    this.storage.set(STORAGE_KEY, tallies);
  }

  clear() {
    this.storage.remove(STORAGE_KEY);
  }

  /** Cells with at least one error, most frequent first: [{table, row, column, count}]. */
  cells(): TallyCell[] {
    const tallies = this.load();
    const out: TallyCell[] = [];
    for (const table of TABLE_NAMES) {
      tallies[table].forEach((r, row) =>
        r.forEach((count, column) => {
          if (count > 0) out.push({ table, row, column, count });
        }),
      );
    }
    return out.sort((a, b) => b.count - a.count);
  }
}
