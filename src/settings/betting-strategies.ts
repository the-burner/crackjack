// Betting strategies: the bet ramp, chip value and wonging settings saved under a name, beside Crackjack's built-in ones.
// Every module that bets reads them from one library, kept in the game's names (the game keeps every betting setting).

import type { SettingKey, SettingReader, SettingValues, SettingsPatch } from './schema';
import { isRamp } from './bet-ramp';
import { sameValues } from './named-configs';
import type { Named, PresetKind, PresetSelectionKey } from './named-configs';
import { BETTING_SCOPES, keeps, scopedKey } from './scopes';
import type { BettingScope, ScopedKey } from './scopes';

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

/** The part of a strategy one module keeps. */
type ScopedBetting = Partial<BettingValues>;

/** The game's name of each betting setting, as a module names its own. */
const nameIn = (key: (typeof BETTING_KEYS)[number]) => key.slice('game.'.length) as ScopedKey;

/** Betting strategies as module `scope` keeps them, for the preset picker. */
export function bettingPresets(scope: BettingScope): PresetKind<BettingStrategy, ScopedBetting> {
  const kept = BETTING_KEYS.filter(key => keeps(scope, nameIn(key)));
  const pick = (values: BettingValues): ScopedBetting => Object.fromEntries(kept.map(key => [key, values[key]]));
  return {
    label: 'Betting strategy',
    builtIns: BUILT_IN_BETTING,
    selectedKey: scopedKey(scope, 'betting.strategy') as PresetSelectionKey,
    current: get => Object.fromEntries(kept.map(key => [key, get(scopedKey(scope, nameIn(key)) as SettingKey)])),
    valuesOf: strategy => pick(strategy.values),
    patch: values =>
      Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          scopedKey(scope, nameIn(key as (typeof BETTING_KEYS)[number])),
          value,
        ]),
      ) as SettingsPatch,
    // What the module does not keep comes from the strategy saved over, else the shipped settings.
    make: (id, name, values, base) => {
      const whole = { ...(base?.values ?? MULTI_HAND), ...values };
      const wongIn = Math.max(whole['game.betting.wongIn'], whole['game.betting.wongOut'] + 1);
      return { id, name, values: { ...whole, 'game.betting.wongIn': wongIn } };
    },
  };
}

export const BETTING_PRESETS = bettingPresets('game');

/**
 * When a saved strategy changes, what each module on it takes from it: a module that had not moved off
 * it follows it, one that had keeps its own edit.
 */
export function followSaved(
  get: SettingReader,
  before: readonly BettingStrategy[],
  after: readonly BettingStrategy[],
): SettingsPatch {
  const changes: SettingsPatch = {};
  for (const scope of BETTING_SCOPES) {
    const kind = bettingPresets(scope);
    const id = get(kind.selectedKey);
    const was = before.find(strategy => strategy.id === id);
    const now = after.find(strategy => strategy.id === id);
    if (!was || !now || was === now || !sameValues(kind.valuesOf(was), kind.current(get))) continue;
    Object.assign(changes, kind.patch(kind.valuesOf(now)));
  }
  return changes;
}
