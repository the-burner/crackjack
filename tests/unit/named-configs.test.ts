import { describe, it, expect } from 'vitest';
import { checkName, deleteNamed, named, presetState, putNamed, renameNamed } from '@/settings/named-configs';

type Preset = { id: string; name: string; values: number; builtIn?: boolean };
const BUILT_IN: Preset[] = [{ id: 'default', name: 'Default', values: 0, builtIn: true }];
const spread: Preset = { id: 's', name: 'Spread', values: 5 };
const flat: Preset = { id: 'f', name: 'Flat', values: 1 };
const all = [...BUILT_IN, spread, flat];
const valuesOf = (preset: Preset) => preset.values;
const equal = (a: number, b: number) => a === b;

describe('the preset in use', () => {
  it('is the one selected, edited once the settings differ from it', () => {
    expect(presetState('s', 5, all, valuesOf, equal)).toEqual({ selected: spread, edited: false });
    expect(presetState('s', 6, all, valuesOf, equal)).toEqual({ selected: spread, edited: true });
  });

  it('is the one selected even when another holds the same settings', () => {
    const twin: Preset = { id: 't', name: 'Twin', values: 5 };
    expect(presetState('t', 5, [...all, twin], valuesOf, equal).selected).toBe(twin);
  });

  it('is none once the selected one is gone', () => {
    expect(presetState('gone', 5, all, valuesOf, equal)).toEqual({ selected: null, edited: true });
  });
});

describe('names', () => {
  it('are trimmed, must not be empty and cannot be a built-in one', () => {
    expect(checkName('  Spread ', BUILT_IN)).toEqual({ name: 'Spread' });
    expect(checkName('  ', BUILT_IN)).toEqual({ error: 'A name is needed.' });
    expect(checkName('default', BUILT_IN)).toEqual({ error: '“default” is built in.' });
  });

  it('find the saved one of that name, ignoring case', () => {
    expect(named([spread, flat], 'SPREAD')).toBe(spread);
    expect(named([spread, flat], 'Other')).toBeUndefined();
  });
});

describe('saving, renaming and deleting', () => {
  it('replaces a saved one by id, or adds a new one', () => {
    expect(putNamed([spread, flat], { ...spread, values: 9 })).toEqual([{ ...spread, values: 9 }, flat]);
    const added = { id: 'n', name: 'New', values: 2 };
    expect(putNamed([spread], added)).toEqual([spread, added]);
  });

  it('renames one, keeping what it holds', () => {
    expect(renameNamed([spread, flat], 's', 'Wide')).toEqual([{ ...spread, name: 'Wide' }, flat]);
  });

  it('deletes one', () => {
    expect(deleteNamed([spread, flat], 's')).toEqual([flat]);
  });
});
