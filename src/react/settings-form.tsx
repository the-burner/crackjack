// Settings-bound controls for React screens.
//
// Every control writes through `applyRuleChange`, so a change that implies other
// rules updates them too; useSettings() re-renders the screen, so every control
// shows the result.

import type { ReactNode } from 'react';
import { applyRuleChange } from '@/settings/rules-logic';
import type { SettingKey, SettingValues } from '@/settings/schema';
import type { SelectOption } from '@/ui/components';
import { useSettings } from './app-context';
import { CheckList, Select, Slider, StandardScreen, ValueButton } from './components';

/** Writes a setting and whatever rules it implies. */
export function useWriteSetting() {
  const settings = useSettings();
  return <K extends SettingKey>(key: K, value: SettingValues[K]) =>
    settings.update(applyRuleChange(k => settings.get(k), key, value));
}

/**
 * A settings screen: the standard title bar plus a body that holds one or two
 * columns of control groups. Build it with `reactScreen(..., { className: 'settings' })`.
 */
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
    <StandardScreen title={title} help={help}>
      {note && <p className="note settings-note">{note}</p>}
      <div className="settings-cols">{children}</div>
    </StandardScreen>
  );
}

/** A group of controls that stays together when the screen splits into columns. */
export const SettingsGroup = ({ children }: { children: ReactNode }) => (
  <div className="settings-group">{children}</div>
);

/** A label on the left and a control on the right. */
export const SettingsRow = ({ label, hidden, children }: { label: string; hidden?: boolean; children: ReactNode }) => (
  <div className="settings-row" hidden={hidden}>
    <span className="label">{label}</span>
    {children}
  </div>
);

/** A boolean setting, or one member of an enum setting (`value`, with `off` when unchecked). */
export type SettingCheck =
  | { label: string; key: SettingKey; value?: undefined; off?: undefined }
  | { label: string; key: SettingKey; value: unknown; off: unknown };

/** A group of checkboxes bound to settings. */
export function SettingChecks({
  items,
  horizontal,
  chips,
}: {
  items: readonly SettingCheck[];
  horizontal?: boolean;
  chips?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  const checked = (item: SettingCheck) =>
    item.value === undefined ? Boolean(settings.get(item.key)) : settings.get(item.key) === item.value;
  return (
    <CheckList
      horizontal={horizontal}
      chips={chips}
      items={items.map(item => ({
        label: item.label,
        checked: checked(item),
        // The schema coerces and validates whatever is written.
        onChange: on =>
          write(item.key, (item.value === undefined ? on : on ? item.value : item.off) as SettingValues[SettingKey]),
      }))}
    />
  );
}

/** A select bound to a setting. `onChange` replaces the plain write. */
export function SettingSelect<K extends SettingKey>({
  setting,
  options,
  onChange,
  mini,
}: {
  setting: K;
  options: readonly SelectOption<SettingValues[K]>[];
  onChange?: (value: SettingValues[K]) => void;
  mini?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  return (
    <Select
      name={setting}
      mini={mini}
      options={options}
      value={settings.get(setting)}
      onChange={onChange ?? (value => write(setting, value))}
    />
  );
}

type NumberKey = { [K in SettingKey]: SettingValues[K] extends number ? K : never }[SettingKey];

/**
 * A label and a button showing a number; tapping it prompts for a new one.
 * The prompt clamps to the schema's range; `clamp` narrows it further when
 * the limit depends on another setting.
 */
export function SettingNumber({
  label,
  setting,
  prompt,
  format,
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
        value={settings.get(setting)}
        onChange={value => write(setting, clamp(value))}
        prompt={prompt ?? label}
        min={min}
        max={max}
        format={format}
      />
    </SettingsRow>
  );
}

/** A labelled slider bound to a setting. */
export function SettingSlider({ label, setting }: { label: string; setting: NumberKey }) {
  const settings = useSettings();
  const write = useWriteSetting();
  const { min = 0, max = 100 } = rangeOf(settings.schema[setting]);
  return (
    <Slider label={label} value={settings.get(setting)} onChange={value => write(setting, value)} min={min} max={max} />
  );
}

const rangeOf = (def: object): { min?: number; max?: number } => ({
  min: 'min' in def && typeof def.min === 'number' ? def.min : undefined,
  max: 'max' in def && typeof def.max === 'number' ? def.max : undefined,
});
