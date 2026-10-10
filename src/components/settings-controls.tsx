// Controls bound to settings, for the settings and options screens. Every
// write goes through applyRuleChange, so a change that implies other rules
// updates them too; useSettings() re-renders the screen with the result.

import type { ReactNode } from 'react';
import { CheckList } from '@/components/ui/check-list';
import type { CheckListLayout } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import type { Option } from '@/components/ui/select';
import { SettingsCols, SettingsNote, SettingsRow } from '@/components/ui/settings-group';
import { Slider } from '@/components/ui/slider';
import { ValueButton } from '@/components/ui/value-button';
import { ScreenLayout } from '@/components/screen-layout';
import { useSettings } from '@/react/app-context';
import { applyRuleChange } from '@/settings/rules-logic';
import type { SettingKey, SettingValues } from '@/settings/schema';

export type { Option };

/** Writes a setting and whatever rules it implies. */
export function useWriteSetting() {
  const settings = useSettings();
  return <K extends SettingKey>(key: K, value: SettingValues[K]) =>
    settings.update(applyRuleChange(k => settings.get(k), key, value));
}

/** A settings screen: title bar, an optional note, then groups in one or two columns. */
export function SettingsScreen({
  title,
  help,
  note,
  children,
}: {
  title: string;
  help: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <ScreenLayout title={title} help={help}>
      {note && <SettingsNote>{note}</SettingsNote>}
      <SettingsCols>{children}</SettingsCols>
    </ScreenLayout>
  );
}

/** A boolean setting, or one member of an enum setting (`value`, with `off` when unchecked). */
export type SettingCheck =
  | { label: string; key: SettingKey; value?: undefined; off?: undefined }
  | { label: string; key: SettingKey; value: unknown; off: unknown };

/** A checklist of settings: switch rows, a segmented control or chips. */
export function SettingChecks({
  items,
  layout,
  disabled,
}: {
  items: readonly SettingCheck[];
  layout?: CheckListLayout;
  disabled?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  const checked = (item: SettingCheck) =>
    item.value === undefined ? Boolean(settings.get(item.key)) : settings.get(item.key) === item.value;
  return (
    <CheckList
      layout={layout}
      items={items.map(item => ({
        label: item.label,
        checked: checked(item),
        disabled,
        // The schema coerces and validates whatever is written.
        onChange: on =>
          write(item.key, (item.value === undefined ? on : on ? item.value : item.off) as SettingValues[SettingKey]),
      }))}
    />
  );
}

/**
 * A select bound to a setting. `onChange` replaces the plain write. `label` names
 * it; with `labelled`, the label is shown in the row and the choice at its end.
 */
export function SettingSelect<K extends SettingKey>({
  setting,
  options,
  onChange,
  label,
  labelled,
  hidden,
}: {
  setting: K;
  options: readonly Option<SettingValues[K]>[];
  onChange?: (value: SettingValues[K]) => void;
  label?: string;
  labelled?: boolean;
  hidden?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  if (hidden) return null;
  return (
    <Select
      name={setting}
      aria-label={label}
      label={labelled ? label : undefined}
      options={options}
      value={settings.get(setting)}
      onChange={onChange ?? (value => write(setting, value))}
    />
  );
}

type NumberKey = { [K in SettingKey]: SettingValues[K] extends number ? K : never }[SettingKey];

const rangeOf = (def: object): { min?: number; max?: number } => ({
  min: 'min' in def && typeof def.min === 'number' ? def.min : undefined,
  max: 'max' in def && typeof def.max === 'number' ? def.max : undefined,
});

/**
 * A label and a button showing a number setting; tapping it asks for a new
 * value within the schema's range (narrowed further by `clamp` when it depends
 * on another setting).
 */
export function SettingNumber({
  label,
  setting,
  prompt,
  format = String,
  clamp = value => value,
  hidden,
}: {
  label: string;
  setting: NumberKey;
  prompt?: string;
  format?: (value: number) => string;
  clamp?: (value: number) => number;
  hidden?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  const { min, max } = rangeOf(settings.schema[setting]);
  return (
    <SettingsRow label={label} hidden={hidden}>
      <ValueButton
        label={label}
        value={settings.get(setting)}
        prompt={prompt ?? label}
        min={min}
        max={max}
        format={format}
        onChange={value => write(setting, clamp(value))}
      />
    </SettingsRow>
  );
}

/** A labelled slider with a number box, bound to a setting. */
export function SettingSlider({ label, setting }: { label: string; setting: NumberKey }) {
  const settings = useSettings();
  const write = useWriteSetting();
  const { min = 0, max = 100 } = rangeOf(settings.schema[setting]);
  return (
    <Slider label={label} value={settings.get(setting)} min={min} max={max} onChange={value => write(setting, value)} />
  );
}
