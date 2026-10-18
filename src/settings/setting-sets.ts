// Saved sets of a screen's settings: the game's (everything on Game Options) and each drill's. Each kind has one built-in set, the
// settings a fresh install has, so a fresh install begins on it unedited.

import { SETTINGS_SCHEMA } from './schema';
import type { SettingKey, SettingReader, SettingsPatch } from './schema';
import type { Named, PresetKind, PresetSelectionKey } from './named-configs';

export interface SettingSet extends Named {
  values: SettingsPatch;
  builtIn?: boolean;
}

export type DrillName = 'flash' | 'depth' | 'count' | 'full';

const ALL_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];
const SELECTION_KEYS: readonly PresetSelectionKey[] = [
  'game.config',
  'drills.flash.config',
  'drills.depth.config',
  'drills.count.config',
  'drills.full.config',
];
const withPrefix = (...prefixes: string[]) =>
  ALL_KEYS.filter(
    key => prefixes.some(p => key.startsWith(`${p}.`)) && !SELECTION_KEYS.includes(key as PresetSelectionKey),
  );

/** Every setting on Blackjack's options and the screens it opens, its strategy and betting among them. */
export const GAME_KEYS: readonly SettingKey[] = [
  ...withPrefix('game', 'table', 'rules', 'bonuses', 'dealerErrors', 'peeking', 'mechanics'),
  'display.hideActionButtons',
  'display.hideDiscardTray',
  'display.hideShoe',
];

export const DRILL_KEYS = (drill: DrillName): readonly SettingKey[] => withPrefix(`drills.${drill}`);

/** `keys` as `get` reads them. */
const valuesOf = (keys: readonly SettingKey[], get: SettingReader): SettingsPatch =>
  Object.fromEntries(keys.map(key => [key, get(key)]));

/** One kind of setting set: its built-in, how it is read back from storage, and the preset picker's view of it. */
export function settingSets(
  keys: readonly SettingKey[],
  { label, selectedKey, builtInName }: { label: string; selectedKey: PresetSelectionKey; builtInName: string },
) {
  const defaults = valuesOf(keys, (key => SETTINGS_SCHEMA[key].default) as SettingReader);
  const builtIns: readonly SettingSet[] = [{ id: 'default', name: builtInName, values: defaults, builtIn: true }];
  /** Only the kind's keys; one added since a set was saved takes its default. */
  const tidy = (values: Record<string, unknown>): SettingsPatch => ({
    ...defaults,
    ...Object.fromEntries(Object.entries(values).filter(([key]) => (keys as readonly string[]).includes(key))),
  });
  const read = (saved: unknown): SettingSet[] => {
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((entry: unknown): SettingSet[] => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { id, name, values } = entry as Record<string, unknown>;
      if (typeof id !== 'string' || typeof name !== 'string' || typeof values !== 'object' || values === null)
        return [];
      return [{ id, name, values: tidy(values as Record<string, unknown>) }];
    });
  };
  const kind: PresetKind<SettingSet, SettingsPatch> = {
    label,
    builtIns,
    selectedKey,
    current: get => valuesOf(keys, get),
    valuesOf: set => set.values,
    patch: values => ({ ...values }),
    make: (id, name, values) => ({ id, name, values }),
  };
  return { kind, read };
}

export const GAME_SETS = settingSets(GAME_KEYS, {
  label: 'Configuration',
  selectedKey: 'game.config',
  builtInName: 'Default',
});

const drillSets = (drill: DrillName) =>
  settingSets(DRILL_KEYS(drill), {
    label: 'Configuration',
    selectedKey: `drills.${drill}.config`,
    builtInName: 'Default',
  });

export const DRILL_SETS: Record<DrillName, ReturnType<typeof settingSets>> = {
  flash: drillSets('flash'),
  depth: drillSets('depth'),
  count: drillSets('count'),
  full: drillSets('full'),
};
