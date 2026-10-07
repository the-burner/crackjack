import { describe, it, expect } from 'vitest';
import { ErrorTallies, emptyTallies } from '../../src/services/error-tallies.js';
import { Storage, MemoryBackend } from '../../src/services/storage.js';
import { TABLE_NAMES } from '../../src/core/strategy/strategy-file.js';

const tallies = () => new ErrorTallies(new Storage(new MemoryBackend()));

describe('empty tallies', () => {
  it('has a ten by ten grid of zeroes per strategy table', () => {
    const empty = emptyTallies();
    expect(Object.keys(empty)).toEqual(TABLE_NAMES);
    expect(empty.hardStand).toHaveLength(10);
    expect(empty.hardStand.every(row => row.length === 10 && row.every(n => n === 0))).toBe(true);
  });

  it('gives each table its own rows', () => {
    const empty = emptyTallies();
    empty.split[0][0] = 1;
    expect(empty.hardStand[0][0]).toBe(0);
    expect(empty.split[1][0]).toBe(0);
  });
});

describe('recording strategy errors', () => {
  it('counts each error in its own cell', () => {
    const errors = tallies();
    errors.record('hardStand', 3, 4);
    errors.record('hardStand', 3, 4);
    errors.record('split', 0, 9);
    const loaded = errors.load();
    expect(loaded.hardStand[3][4]).toBe(2);
    expect(loaded.split[0][9]).toBe(1);
  });

  it('survives a reload, since it goes through storage', () => {
    const storage = new Storage(new MemoryBackend());
    new ErrorTallies(storage).record('softDouble', 1, 1);
    expect(new ErrorTallies(storage).load().softDouble[1][1]).toBe(1);
  });

  it('ignores a cell outside the ten by ten grid', () => {
    const errors = tallies();
    for (const [row, column] of [[-1, 0], [10, 0], [0, -1], [0, 10]]) errors.record('hardStand', row, column);
    expect(errors.cells()).toEqual([]);
  });

  it('rebuilds a saved grid that is not a ten by ten of counts', () => {
    const storage = new Storage(new MemoryBackend());
    storage.set('errorTallies', { split: null, hardStand: [[1]], softDouble: 'nonsense' });
    const errors = new ErrorTallies(storage);
    expect(errors.load().split).toEqual(emptyTallies().split);
    expect(errors.load().hardStand).toEqual(emptyTallies().hardStand);
    errors.record('split', 1, 2);
    expect(errors.cells()).toEqual([{ table: 'split', row: 1, column: 2, count: 1 }]);
  });

  it('fills in tables a saved tally never mentioned', () => {
    const storage = new Storage(new MemoryBackend());
    storage.set('errorTallies', { split: emptyTallies().split });
    expect(Object.keys(new ErrorTallies(storage).load())).toEqual(TABLE_NAMES);
  });
});

describe('the cells worth practising', () => {
  it('lists only cells with an error, worst first', () => {
    const errors = tallies();
    errors.record('hardStand', 2, 2);
    for (let i = 0; i < 3; i++) errors.record('split', 5, 5);
    errors.record('surrender', 9, 9);
    errors.record('surrender', 9, 9);
    expect(errors.cells()).toEqual([
      { table: 'split', row: 5, column: 5, count: 3 },
      { table: 'surrender', row: 9, column: 9, count: 2 },
      { table: 'hardStand', row: 2, column: 2, count: 1 },
    ]);
  });

  it('is empty before anything goes wrong', () => {
    expect(tallies().cells()).toEqual([]);
  });

  it('forgets everything when cleared', () => {
    const errors = tallies();
    errors.record('hardStand', 0, 0);
    errors.clear();
    expect(errors.cells()).toEqual([]);
    expect(errors.load()).toEqual(emptyTallies());
  });
});
