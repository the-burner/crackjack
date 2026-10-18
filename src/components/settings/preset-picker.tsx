// Picks, saves, renames and deletes named presets (gesture configurations, betting strategies).
// The selected one shows "(edited)" once the settings move off it; Save writes them back, Revert drops them.

import { useStore } from 'zustand';
import { confirm, prompt } from '@/components/dialogs';
import { Select } from '@/components/ui/select';
import { ListRow, SettingsGroup } from '@/components/ui/settings-group';
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

export function PresetPicker<T extends Named, V>({
  kind,
  store,
}: {
  kind: PresetKind<T, V>;
  store: PersistedStore<T[]>;
}) {
  const settings = useSettings();
  const saved = useStore(store, state => state.value);
  const presets = [...kind.builtIns, ...saved];
  const values = kind.current(key => settings.get(key));
  const { selected, edited } = presetState(settings.get(kind.selectedKey), values, presets, kind.valuesOf, sameValues);
  const own = selected && !selected.builtIn ? selected : null;
  const options = [
    ...presets.map(preset => ({
      value: preset.id,
      label: preset === selected && edited ? `${preset.name} (edited)` : preset.name,
    })),
    ...(selected ? [] : [{ value: '', label: 'Custom' }]),
  ];

  const load = (preset: T) => settings.update({ ...kind.patch(kind.valuesOf(preset)), [kind.selectedKey]: preset.id });
  const keep = (presetsToSave: T[]) => store.setState({ value: presetsToSave });

  /** Unsaved settings are only dropped once the player agrees. */
  const mayDiscard = async () =>
    !edited || confirm(selected ? `Discard your changes to “${selected.name}”?` : 'Discard these unsaved settings?');

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
    <SettingsGroup>
      <Select label={kind.label} options={options} value={selected?.id ?? ''} onChange={id => void choose(id)} />
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
  );
}
