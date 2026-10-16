// Named sets of settings the player saves beside built-in ones (gestures, betting strategies), and
// which one is in use: the one selected, edited once the settings no longer match it.

import type { SettingReader, SettingsPatch } from './schema';

export interface Named {
  id: string;
  name: string;
  builtIn?: boolean;
}

/** The selected preset (null once it is gone), and whether the settings have moved off it. */
export function presetState<T extends Named, V>(
  selectedId: string,
  values: V,
  presets: readonly T[],
  valuesOf: (preset: T) => V,
  equal: (a: V, b: V) => boolean,
): { selected: T | null; edited: boolean } {
  const selected = presets.find(preset => preset.id === selectedId) ?? null;
  return { selected, edited: !selected || !equal(valuesOf(selected), values) };
}

/** A usable name, trimmed; built-in names are taken. */
export function checkName(name: string, builtIns: readonly Named[]): { name: string } | { error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'A name is needed.' };
  if (named(builtIns, trimmed)) return { error: `“${trimmed}” is built in.` };
  return { name: trimmed };
}

/** The one called `name`, ignoring case. */
export const named = <T extends Named>(presets: readonly T[], name: string): T | undefined =>
  presets.find(preset => preset.name.toLowerCase() === name.trim().toLowerCase());

/** `saved` with `preset` in place of the one with its id, or added. */
export const putNamed = <T extends Named>(saved: readonly T[], preset: T): T[] =>
  saved.some(p => p.id === preset.id) ? saved.map(p => (p.id === preset.id ? preset : p)) : [...saved, preset];

export const renameNamed = <T extends Named>(saved: readonly T[], id: string, name: string): T[] =>
  saved.map(preset => (preset.id === id ? { ...preset, name } : preset));

export const deleteNamed = <T extends Named>(saved: readonly T[], id: string): T[] =>
  saved.filter(preset => preset.id !== id);

/** An id for a newly saved preset. */
export const newPresetId = (): string => `saved-${Date.now()}`;

/** The settings that hold which preset is selected. */
export type PresetSelectionKey =
  | 'betting.strategy'
  | 'gestures.config'
  | 'game.config'
  | 'drills.flash.config'
  | 'drills.depth.config'
  | 'drills.count.config'
  | 'drills.full.config';

/** What a kind of preset is: its built-ins, where its selection is kept, and how it reads and writes the settings. */
export interface PresetKind<T extends Named, V> {
  /** The select's label, e.g. "Betting strategy". */
  label: string;
  builtIns: readonly T[];
  selectedKey: PresetSelectionKey;
  current: (get: SettingReader) => V;
  valuesOf: (preset: T) => V;
  patch: (values: V) => SettingsPatch;
  make: (id: string, name: string, values: V) => T;
}

/** The same settings, whatever order their keys were written in. */
export function sameValues(a: unknown, b: unknown): boolean {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([x], [y]) => (x < y ? -1 : 1))
              .map(([k, v]) => [k, sorted(v)]),
          )
        : value;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}
