// Betting strategies: the bet ramp, chip value and wonging settings saved under a name, beside Crackjack's built-in ones.

import type { SettingReader, SettingValues } from './schema';
import { isRamp } from './bet-ramp';
import type { Named, PresetKind } from './named-configs';

/** The settings a betting strategy holds. */
export const BETTING_KEYS = [
  'game.betting.ramp',
  'game.betting.chipValue',
  'game.betting.wonging',
  'game.betting.wongIn',
  'game.betting.wongOut',
  'game.betting.wongStartOut',
] as const;

export type BettingValues = Pick<SettingValues, (typeof BETTING_KEYS)[number]>;

export interface BettingStrategy extends Named {
  values: BettingValues;
  builtIn?: boolean;
}

export const bettingValues = (get: SettingReader): BettingValues =>
  Object.fromEntries(BETTING_KEYS.map(key => [key, get(key)])) as BettingValues;

/** One hand, flat until the count rises. */
const SINGLE_HAND: BettingValues = {
  'game.betting.ramp': { minCount: 0, rows: [1, 2, 4, 6, 12, 16].map(chips => ({ chips, hands: 1 })) },
  'game.betting.chipValue': 25,
  'game.betting.wonging': false,
  'game.betting.wongIn': 1,
  'game.betting.wongOut': -2,
  'game.betting.wongStartOut': false,
};

/** Two hands at the higher counts, sitting out (wonging) between -2 and +1: the shipped settings. */
export const MULTI_HAND: BettingValues = {
  'game.betting.ramp': {
    minCount: 0,
    rows: [
      { chips: 1, hands: 1 },
      { chips: 2, hands: 1 },
      { chips: 2, hands: 2 },
      { chips: 3, hands: 2 },
      { chips: 6, hands: 2 },
      { chips: 12, hands: 2 },
    ],
  },
  'game.betting.chipValue': 25,
  'game.betting.wonging': true,
  'game.betting.wongIn': 1,
  'game.betting.wongOut': -2,
  'game.betting.wongStartOut': false,
};

export const BUILT_IN_BETTING: readonly BettingStrategy[] = [
  { id: 'single-hand', name: "Crackjack's Single-Hand Strategy", values: SINGLE_HAND, builtIn: true },
  { id: 'multi-hand', name: "Crackjack's Multi-Hand Strategy", values: MULTI_HAND, builtIn: true },
];

/** The saved strategies in `saved`, dropping any that are malformed (the settings store tidies the rest). */
export function readBettingStrategies(saved: unknown): BettingStrategy[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry: unknown): BettingStrategy[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { id, name, values } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof values !== 'object' || values === null) return [];
    const read = values as Record<string, unknown>;
    if (!isRamp(read['game.betting.ramp']) || BETTING_KEYS.some(key => !(key in read))) return [];
    return [{ id, name, values: values as BettingValues }];
  });
}

/** Betting strategies, for the preset picker. */
export const BETTING_PRESETS: PresetKind<BettingStrategy, BettingValues> = {
  label: 'Betting strategy',
  builtIns: BUILT_IN_BETTING,
  selectedKey: 'game.betting.strategy',
  current: bettingValues,
  valuesOf: strategy => strategy.values,
  patch: values => ({ ...values }),
  make: (id, name, values) => ({ id, name, values }),
};
