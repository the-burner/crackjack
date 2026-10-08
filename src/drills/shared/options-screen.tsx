// The options screen every drill has: groups of controls bound to the drill's
// settings and the "Launch the Drill" button. The playing strategy and true
// count settings the drills use are set from Settings on the home screen.
//
// Controls follow settings that other screens write too (the custom-hand
// editor, the tray-style correction made at launch): useSettings() re-renders
// the screen on every change.

import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import type { CheckListLayout } from '@/components/ui/check-list';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Slider } from '@/components/ui/slider';
import { DurationPicker } from '@/components/ui/time-wheel';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { useSettings } from '@/react/app-context';
import type { AppSchema, SettingKey, SettingValues } from '@/settings/schema';
import type { NumberDef } from '@/settings/store';
import { tenthsColumns } from '@/drills/shared/duration';
import { clockTime } from './format';

type BoolKey = { [K in SettingKey]: SettingValues[K] extends boolean ? K : never }[SettingKey];
type IntKey = { [K in SettingKey]: AppSchema[K] extends NumberDef ? K : never }[SettingKey];

/** The title bar, the groups of controls, then the launch button. */
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
    <ScreenLayout title={title} help={help}>
      <Column>
        {children}
        <Button
          variant="primary"
          icon="gear"
          iconPos="bottom"
          block
          className="mt-1"
          onClick={onLaunch}
          data-action="launch"
        >
          Launch the Drill
        </Button>
      </Column>
    </ScreenLayout>
  );
}

/** A group of controls kept together: a settings group with taller rows, so a highlight fills one from divider to divider. */
export const OptionGroup = ({ className, ...props }: ComponentProps<'div'>) => (
  <SettingsGroup className={cn('[--control-h:50px]', className)} {...props} />
);

/** Switch rows for boolean settings. A `hidden` row below renders nothing, as the original hid it. */
export function OptionChecks({
  items,
  layout,
}: {
  items: readonly { label: string; setting: BoolKey }[];
  layout?: CheckListLayout;
}) {
  const settings = useSettings();
  return (
    <CheckList
      layout={layout}
      items={items.map(({ label, setting }) => ({
        label,
        checked: settings.get(setting),
        onChange: on => settings.set(setting, on),
      }))}
    />
  );
}

/** One switch row for a boolean setting. */
export const OptionSwitch = ({ label, setting, hidden }: { label: string; setting: BoolKey; hidden?: boolean }) =>
  hidden ? null : <OptionChecks items={[{ label, setting }]} />;

/** A labelled slider (Thickness) over the schema's range. */
export function OptionSlider({ label, setting, hidden }: { label: string; setting: IntKey; hidden?: boolean }) {
  const settings = useSettings();
  const { min = 0, max = 100 } = settings.schema[setting];
  if (hidden) return null;
  return (
    <Slider
      label={label}
      value={settings.get(setting)}
      min={min}
      max={max}
      onChange={value => settings.set(setting, value)}
    />
  );
}

/**
 * A row showing a duration setting as hh:mm:ss (or, with `tenths`, a value
 * in tenths of a second as "0.8 s"); tapping it opens the duration wheels.
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
  const [open, setOpen] = useState(false);
  const { min, max = Infinity } = settings.schema[setting];
  const value = settings.get(setting);
  if (hidden) return null;
  return (
    <SettingsRow label={label}>
      <Button aria-label={label} onClick={() => setOpen(true)}>
        {tenths ? `${(value / 10).toFixed(1)} s` : clockTime(value)}
      </Button>
      <DurationPicker
        title={label}
        value={value}
        min={min}
        max={max}
        columns={tenths ? tenthsColumns(max) : undefined}
        open={open}
        onClose={picked => {
          setOpen(false);
          if (picked !== null) settings.set(setting, picked);
        }}
      />
    </SettingsRow>
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
] as const;

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
