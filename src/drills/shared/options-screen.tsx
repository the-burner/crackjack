// The options screen every drill has: a column of controls bound to the
// drill's settings and the green "Launch the Drill" button. The playing
// strategy and true count settings the drills use are set from Settings on the
// home screen.
//
// Controls follow settings that other screens write too (the custom-hand
// editor, the tray-style correction made at launch): useSettings() re-renders
// the screen on every change.

import type { ReactNode } from 'react';
import { useSettings } from '../../react/app-context.ts';
import { Button, CheckList, Field, Select, Slider, StandardScreen, ValueButton } from '../../react/components.tsx';
import type { AppSchema, SettingKey, SettingValues } from '../../settings/schema.ts';
import type { NumberDef } from '../../settings/store.ts';
import type { SelectOption } from '../../ui/components.ts';
import { pickDuration, tenthsColumns } from '../../ui/time-wheel.ts';
import { clockTime } from './format.ts';

type BoolKey = { [K in SettingKey]: SettingValues[K] extends boolean ? K : never }[SettingKey];
type IntKey = { [K in SettingKey]: AppSchema[K] extends NumberDef ? K : never }[SettingKey];

/** The title bar, the controls, then the launch button. Build it with `{ className: 'drill-options' }`. */
export function DrillOptionsScreen({
  title,
  help,
  onLaunch,
  children,
}: {
  title: string;
  help: string;
  onLaunch: () => void;
  children: ReactNode;
}) {
  return (
    <StandardScreen title={title} help={help}>
      <div className="column">
        {children}
        <Button variant="primary" icon="gear" iconPos="bottom" block onClick={onLaunch} data-action="launch">
          Launch the Drill
        </Button>
      </div>
    </StandardScreen>
  );
}

/** A group of controls kept together. */
export const Group = ({ children }: { children: ReactNode }) => <div className="drill-options__group">{children}</div>;

/** A label on the left and a control on the right. */
export const Row = ({ label, hidden, children }: { label: string; hidden?: boolean; children: ReactNode }) => (
  <Field label={label} inline hidden={hidden}>
    {children}
  </Field>
);

/** A label over one or more cards, keeping them together (as on the settings screens). */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="section">
    <h2 className="section__title">{title}</h2>
    {children}
  </div>
);

/** A select and a small button side by side. */
export const Pair = ({ children }: { children: ReactNode }) => <div className="drill-options__pair">{children}</div>;

/** A label on the left and a value on the right, as on the settings screens. */
export const ValueRow = ({ label, hidden, children }: { label: string; hidden?: boolean; children: ReactNode }) => (
  <div className="settings-row" hidden={hidden}>
    <span className="label">{label}</span>
    {children}
  </div>
);

/** A select bound to a setting. `onChange` runs after the write. */
export function OptionSelect<K extends SettingKey>({
  setting,
  options,
  hidden,
  onChange,
}: {
  setting: K;
  options: readonly SelectOption<SettingValues[K]>[];
  hidden?: boolean;
  onChange?: (value: SettingValues[K]) => void;
}) {
  const settings = useSettings();
  return (
    <Select
      name={setting}
      hidden={hidden}
      options={options}
      value={settings.get(setting)}
      onChange={value => {
        settings.set(setting, value);
        onChange?.(value);
      }}
    />
  );
}

/** One checkbox for a boolean setting. */
export function OptionCheck({ label, setting, hidden }: { label: string; setting: BoolKey; hidden?: boolean }) {
  const settings = useSettings();
  return (
    <CheckList
      hidden={hidden}
      items={[{ label, checked: settings.get(setting), onChange: on => settings.set(setting, on) }]}
    />
  );
}

/** A button showing a number; tapping it prompts for a new one within the schema's range. */
export function OptionNumber({ setting, prompt, hidden }: { setting: IntKey; prompt: string; hidden?: boolean }) {
  const settings = useSettings();
  const { min, max } = settings.schema[setting];
  return (
    <ValueButton
      hidden={hidden}
      value={settings.get(setting)}
      onChange={value => settings.set(setting, value)}
      prompt={prompt}
      min={min}
      max={max}
    />
  );
}

/**
 * A row showing a duration setting as hh:mm:ss (or, with `tenths`, a value
 * in tenths of a second as "0.8 s"); tapping it opens the wheels.
 */
export function OptionDuration({
  label,
  setting,
  tenths = false,
  hidden,
}: {
  label: string;
  setting: IntKey;
  tenths?: boolean;
  hidden?: boolean;
}) {
  const settings = useSettings();
  const { min, max = Infinity } = settings.schema[setting];
  const value = settings.get(setting);
  return (
    <ValueRow label={label} hidden={hidden}>
      <Button
        className="value-btn"
        aria-label={label}
        onClick={async () => {
          const picked = await pickDuration({
            title: label,
            value: settings.get(setting),
            min,
            max,
            columns: tenths ? tenthsColumns(max) : undefined,
          });
          if (picked !== null) settings.set(setting, picked);
        }}
      >
        {tenths ? `${(value / 10).toFixed(1)} s` : clockTime(value)}
      </Button>
    </ValueRow>
  );
}

/** An unlabelled slider bound to a setting, over the schema's range. */
export function OptionSlider({ setting }: { setting: IntKey }) {
  const settings = useSettings();
  const { min = 0, max = 100 } = settings.schema[setting];
  return (
    <Slider
      label=""
      value={settings.get(setting)}
      onChange={value => settings.set(setting, value)}
      min={min}
      max={max}
    />
  );
}

/** Deck-count options; drills that allow Spanish decks add them separately. */
export const DECK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(value => ({
  value,
  label: `${['Single', 'Double', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][value - 1]} Deck${value > 1 ? 's' : ''}`,
}));

/** The timer mode every drill offers besides its own timed mode: stop when the drill time runs out. */
export const COUNT_DOWN_HALT_OPTION = { value: 'countDownHalt', label: 'Timer Mode: Count Down & Halt' } as const;

export const ACCURACY_OPTIONS = [
  { value: 0, label: 'Accuracy: Exact' },
  { value: 1, label: 'Accuracy: ±1' },
  { value: 2, label: 'Accuracy: ±2' },
];

export const TRAY_OPTIONS = [
  { value: 'eightDeckFront', label: 'Eight-deck tray, front' },
  { value: 'sixDeckFront', label: 'Six-deck tray, front' },
  { value: 'doubleDeckFront', label: 'Double-deck tray, front' },
  { value: 'sixDeckRear', label: 'Six-deck tray, rear' },
  { value: 'doubleDeckRear', label: 'Double-deck tray, rear' },
];

export const BIAS_OPTIONS = [
  { value: 'none', label: 'Bias: None' },
  { value: 'negative', label: 'Bias: Negative' },
  { value: 'positive', label: 'Bias: Positive' },
] as const;

export const END_WARNING_OPTIONS = [
  { value: 'none', label: 'End warning: None' },
  { value: 'oneCardLeft', label: 'End warning: one card left' },
  { value: 'twoCardsLeft', label: 'End warning: two cards left' },
] as const;
