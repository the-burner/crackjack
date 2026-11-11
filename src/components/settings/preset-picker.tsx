// Picks, saves, renames and deletes named presets (gesture configurations, betting strategies).
// The selected one shows "(edited)" once the settings move off it; Save writes them back, Revert drops them.

import { useStore } from 'zustand';
import { confirm, prompt } from '@/components/dialogs';
import { Combobox } from '@/components/ui/combobox';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { toast } from '@/components/ui/toast';
import { useSettings } from '@/react/app-context';
import type { PersistedStore } from '@/services/persisted-store';
import {
  checkName,
  deleteNamed,
  named,
  newPresetId,
  presetState,
  putNamed,
  renameNamed,
  sameValues,
} from '@/settings/named-configs';
import type { Named, PresetKind } from '@/settings/named-configs';
import { SETTINGS_SCHEMA } from '@/settings/schema';

export function PresetPicker<T extends Named, V>({
  kind,
  store,
}: {
  kind: PresetKind<T, V>;
  store: PersistedStore<T[]>;
}) {
  const settings = useSettings();
  // A saved preset with a built-in's id or name is left out, so the built-in always wins.
  const saved = withoutBuiltIns(
    useStore(store, state => state.value),
    kind.builtIns,
  );
  const presets = [...kind.builtIns, ...saved];
  const values = kind.current(key => settings.get(key));
  const { selected, edited } = presetState(settings.get(kind.selectedKey), values, presets, kind.valuesOf, sameValues);
  const own = selected && !selected.builtIn ? selected : null;
  const options = [
    ...presets.map(preset => ({
      value: preset.id,
      label: preset === selected && edited ? `${preset.name} (edited)` : preset.name,
      detail: kind.detailOf?.(preset),
    })),
    ...(selected ? [] : [{ value: '', label: 'Custom' }]),
  ];

  const load = (preset: T) => settings.update({ ...kind.patch(kind.valuesOf(preset)), [kind.selectedKey]: preset.id });
  const keep = (presetsToSave: T[]) => store.setState({ value: presetsToSave });

  // A fresh install's settings, on no preset, are nothing to lose.
  const untouched =
    !selected &&
    sameValues(
      values,
      kind.current(key => SETTINGS_SCHEMA[key].default as never),
    );
  /** Unsaved settings are only dropped once the player agrees. */
  const mayDiscard = async () =>
    !edited ||
    untouched ||
    confirm(selected ? `Discard your changes to “${selected.name}”?` : 'Discard these unsaved settings?');

  async function choose(id: string) {
    const preset = presets.find(p => p.id === id);
    if (!preset || !(await mayDiscard())) return;
    load(preset);
  }

  function save() {
    if (!own) return;
    keep(putNamed(saved, kind.make(own.id, own.name, values, own)));
    toast(`Saved “${own.name}”`);
  }

  async function saveAsNew() {
    const input = await prompt('Save these settings as:', '');
    if (input === null) return;
    const checked = checkName(input, kind.builtIns);
    if ('error' in checked) {
      toast(checked.error, { tone: 'error' });
      return;
    }
    const existing = named(saved, checked.name);
    if (existing && !(await confirm(`Replace “${existing.name}” with these settings?`))) return;
    const preset = kind.make(existing?.id ?? newPresetId(), checked.name, values, selected ?? undefined);
    keep(putNamed(saved, preset));
    settings.set(kind.selectedKey, preset.id);
    toast(`Saved “${preset.name}”`);
  }

  async function rename() {
    if (!own) return;
    const input = await prompt(`Rename “${own.name}” to:`, own.name);
    if (input === null) return;
    const checked = checkName(input, kind.builtIns);
    const taken = 'name' in checked ? named(saved, checked.name) : undefined;
    if ('error' in checked || (taken && taken.id !== own.id)) {
      toast('error' in checked ? checked.error : `“${checked.name}” is already taken.`, { tone: 'error' });
      return;
    }
    keep(renameNamed(saved, own.id, checked.name));
  }

  async function remove() {
    if (!own || !(await confirm(`Delete “${own.name}”?`))) return;
    keep(deleteNamed(saved, own.id));
    // The settings stay as they are, now saved nowhere.
    settings.set(kind.selectedKey, '');
  }

  return (
    <Section title="Preset">
      {/* Picked by searching, however many there are: the field and its results are islands above the preset's rows. */}
      <Combobox
        label={kind.label}
        options={options}
        value={selected?.id ?? ''}
        onChange={id => void choose(id)}
        className="mb-2.5"
      />
      <SettingsGroup>
        {own && edited && (
          <ListRow block chevron={false} onClick={save}>
            {`Save “${own.name}”`}
          </ListRow>
        )}
        {selected && edited && (
          <ListRow block chevron={false} onClick={() => load(selected)}>
            Revert
          </ListRow>
        )}
        <ListRow block chevron={false} onClick={() => void saveAsNew()}>
          Save as New…
        </ListRow>
        {own && (
          <ListRow block chevron={false} onClick={() => void rename()}>
            Rename…
          </ListRow>
        )}
        {own && (
          <ListRow block chevron={false} onClick={() => void remove()}>
            {`Delete “${own.name}”`}
          </ListRow>
        )}
      </SettingsGroup>
    </Section>
  );
}

/** `saved` without any preset whose id or name (in any case) is a built-in's. */
export const withoutBuiltIns = <T extends Named>(saved: readonly T[], builtIns: readonly Named[]): T[] =>
  saved.filter(preset => !builtIns.some(b => b.id === preset.id || named([b], preset.name)));
