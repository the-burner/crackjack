// Controls bound to settings, for the settings and options screens. Every
// write goes through applyRuleChange, so a change that implies other rules
// updates them too; useSettings() re-renders the screen with the result.

import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { promptNumber } from '@/components/dialogs';
import { ScreenLayout, Section } from '@/components/screen-layout';
import { useSettings } from '@/react/app-context';
import { applyRuleChange } from '@/settings/rules-logic';
import type { SettingKey, SettingValues } from '@/settings/schema';

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
      {note && <p className="mb-4 text-center text-sm text-muted-foreground">{note}</p>}
      <div className="mx-auto grid max-w-4xl items-start gap-4 md:grid-cols-2">{children}</div>
    </ScreenLayout>
  );
}

/** A group of rows that stays together when the screen splits into columns. */
export const SettingsGroup = Section;

/** A label on the left and a control on the right. */
export function SettingRow({
  label,
  htmlFor,
  hidden,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hidden?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-11 items-center gap-3 px-4 py-2', className)} hidden={hidden}>
      <Label htmlFor={htmlFor} className="flex-1 font-normal">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** A boolean setting, or one member of an enum setting (`value`, with `off` when unchecked). */
export type SettingCheck =
  | { label: string; key: SettingKey; value?: undefined; off?: undefined }
  | { label: string; key: SettingKey; value: unknown; off: unknown };

/** A switch per item. */
export function SettingSwitches({ items, disabled }: { items: readonly SettingCheck[]; disabled?: boolean }) {
  return items.map(item => <SettingSwitch key={`${item.key}-${String(item.value)}`} item={item} disabled={disabled} />);
}

function SettingSwitch({ item, disabled }: { item: SettingCheck; disabled?: boolean }) {
  const settings = useSettings();
  const write = useWriteSetting();
  const id = useId();
  const checked = item.value === undefined ? Boolean(settings.get(item.key)) : settings.get(item.key) === item.value;
  return (
    <SettingRow label={item.label} htmlFor={id}>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={on =>
          // The schema coerces and validates whatever is written.
          write(item.key, (item.value === undefined ? on : on ? item.value : item.off) as SettingValues[SettingKey])
        }
      />
    </SettingRow>
  );
}

export type Option<T> = { value: T; label: string };

/** A labelled select of options; an unknown value shows as nothing chosen. */
export function OptionSelect<T>({
  label,
  options,
  value,
  onChange,
  hidden,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  hidden?: boolean;
}) {
  const id = useId();
  const index = options.findIndex(o => o.value === value);
  return (
    <SettingRow label={label} htmlFor={id} hidden={hidden}>
      <Select
        value={index >= 0 ? String(index) : null}
        onValueChange={next => {
          if (next !== null) onChange(options[Number(next)].value);
        }}
        items={options.map((o, i) => ({ value: String(i), label: o.label }))}
      >
        <SelectTrigger id={id} className="max-w-[60%]" aria-label={label}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o, i) => (
            <SelectItem key={i} value={String(i)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingRow>
  );
}

/** A select bound to a setting. `onChange` replaces the plain write. */
export function SettingSelect<K extends SettingKey>({
  label,
  setting,
  options,
  onChange,
  hidden,
}: {
  label: string;
  setting: K;
  options: readonly Option<SettingValues[K]>[];
  onChange?: (value: SettingValues[K]) => void;
  hidden?: boolean;
}) {
  const settings = useSettings();
  const write = useWriteSetting();
  return (
    <OptionSelect
      label={label}
      options={options}
      value={settings.get(setting)}
      onChange={onChange ?? (value => write(setting, value))}
      hidden={hidden}
    />
  );
}

type NumberKey = { [K in SettingKey]: SettingValues[K] extends number ? K : never }[SettingKey];

const rangeOf = (def: object): { min?: number; max?: number } => ({
  min: 'min' in def && typeof def.min === 'number' ? def.min : undefined,
  max: 'max' in def && typeof def.max === 'number' ? def.max : undefined,
});

/**
 * A number setting shown as a button; tapping it asks for a new value within
 * the schema's range (narrowed further by `clamp` when it depends on another setting).
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
  const value = settings.get(setting);
  return (
    <SettingRow label={label} hidden={hidden}>
      <Button
        variant="outline"
        className="min-w-16 tabular-nums"
        aria-label={`${label.replace(/:$/, '')}: ${format(value)}`}
        onClick={async () => {
          const n = await promptNumber(prompt ?? label, value, { min, max });
          if (n !== null) write(setting, clamp(n));
        }}
      >
        {format(value)}
      </Button>
    </SettingRow>
  );
}

/** A labelled slider with a number box for typing the value. */
export function SettingSlider({ label, setting }: { label: string; setting: NumberKey }) {
  const settings = useSettings();
  const write = useWriteSetting();
  const { min = 0, max = 100 } = rangeOf(settings.schema[setting]);
  const value = settings.get(setting);
  return (
    <div className="space-y-2 px-4 py-3">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          inputMode="numeric"
          className="w-20 tabular-nums"
          aria-label={label}
          min={min}
          max={max}
          key={value}
          defaultValue={value}
          onBlur={event => {
            const n = Math.round(Number(event.currentTarget.value));
            if (event.currentTarget.value.trim() === '' || !Number.isFinite(n))
              event.currentTarget.value = String(value);
            else write(setting, Math.min(max, Math.max(min, n)));
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {/* Moves freely while dragged; the stored value is written on release. */}
        <Slider
          key={value}
          aria-label={label}
          min={min}
          max={max}
          defaultValue={[value]}
          onValueCommitted={next => write(setting, Array.isArray(next) ? next[0] : next)}
        />
      </div>
    </div>
  );
}
