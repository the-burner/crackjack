// The table's minimum and maximum bet: the amounts their slider steps through.

/**
 * What the slider stops at, from $1 to $100,000, including every minimum and maximum Current Blackjack News
 * lists; a typed amount may be any whole dollar between.
 */
export const LIMIT_STEPS: readonly number[] = [
  ...new Set([
    1,
    2,
    3,
    5,
    10,
    15,
    20,
    25,
    50,
    150,
    250,
    1500,
    2500,
    25000,
    ...Array.from({ length: 10 }, (_, i) => (i + 1) * 100),
    ...Array.from({ length: 9 }, (_, i) => (i + 2) * 1000),
    ...Array.from({ length: 9 }, (_, i) => (i + 2) * 10000),
  ]),
].sort((a, b) => a - b);

export const LOWEST_LIMIT = LIMIT_STEPS[0];
export const HIGHEST_LIMIT = LIMIT_STEPS[LIMIT_STEPS.length - 1];
