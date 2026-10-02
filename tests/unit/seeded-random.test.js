import { describe, it, expect } from 'vitest';
import { seededRandomInitScript } from '../support/seeded-random.js';

function install(seed) {
  const sandbox = { Math: Object.create(Math) };
  new Function('Math', seededRandomInitScript(seed))(sandbox.Math);
  return () => sandbox.Math.random();
}

describe('seeded Math.random used by the browser tests', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = install(7), b = install(7), c = install(8);
    const seqA = Array.from({ length: 1000 }, a);
    expect(Array.from({ length: 1000 }, b)).toEqual(seqA);
    expect(Array.from({ length: 1000 }, c)).not.toEqual(seqA);
    expect(seqA.every(x => x >= 0 && x < 1)).toBe(true);
  });
});
