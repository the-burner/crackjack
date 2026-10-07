// Random number sources. Everything that needs randomness takes a `random`
// function returning [0, 1), so tests can pass a seeded one.

/** A source of random numbers in [0, 1). */
export type Random = () => number;

export const defaultRandom: Random = () => Math.random();

/** Deterministic generator (mulberry32). */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [0, n). */
export const randomInt = (n: number, random: Random = defaultRandom): number => Math.floor(random() * n);

/** Shuffles an array in place (Fisher-Yates). */
export function shuffle<T>(items: T[], random: Random = defaultRandom): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
