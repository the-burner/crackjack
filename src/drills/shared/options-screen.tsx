// The options screen every drill has: groups of controls bound to the drill's
// settings and the "Launch the Drill" button. The playing strategy and true
// count settings the drills use are set from Settings on the home screen.
//
// Controls follow settings that other screens write too (the custom-hand
// editor, the tray-style correction made at launch): useSettings() re-renders
// the screen on every change.

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScreenLayout } from '@/components/screen-layout';
import { SettingRow, SettingSlider } from '@/components/settings-controls';
import { DurationDialog } from '@/components/drills/duration-dialog';
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
      <div className="mx-auto grid max-w-4xl items-start gap-4 md:grid-cols-2">
        {children}
        <Button size="lg" className="h-12 text-base md:col-span-2" onClick={onLaunch} data-action="launch">
          Launch the Drill
          <PlayIcon />
        </Button>
      </div>
    </ScreenLayout>
  );
}

/** A switch for a boolean setting. */
export function OptionSwitch({ label, setting, hidden }: { label: string; setting: BoolKey; hidden?: boolean }) {
  const settings = useSettings();
  const id = useId();
  return (
    <SettingRow label={label} htmlFor={id} hidden={hidden}>
      {/* Named directly: Base UI only finds the label after a later render. */}
      <Switch
        id={id}
        aria-label={label}
        checked={settings.get(setting)}
        onCheckedChange={on => settings.set(setting, on)}
      />
    </SettingRow>
  );
}

/** A labelled slider over the schema's range. */
export const OptionSlider = ({ label, setting, hidden }: { label: string; setting: IntKey; hidden?: boolean }) => (
  <div hidden={hidden}>
    <SettingSlider label={label} setting={setting} />
  </div>
);

/**
 * A row showing a duration setting as hh:mm:ss (or, with `tenths`, a value
 * in tenths of a second as "0.8 s"); tapping it opens the duration dialog.
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
  const id = useId();
  const [open, setOpen] = useState(false);
  const { min, max = Infinity } = settings.schema[setting];
  const value = settings.get(setting);
  return (
    <SettingRow label={label} htmlFor={id} hidden={hidden}>
      <Button
        id={id}
        variant="outline"
        className="min-w-24 tabular-nums"
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        {tenths ? `${(value / 10).toFixed(1)} s` : clockTime(value)}
      </Button>
      <DurationDialog
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
    </SettingRow>
  );
}

/** Deck-count options; drills that allow Spanish decks add them separately. */
export const DECK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(value => ({
  value,
  label: `${['Single', 'Double', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][value - 1]} Deck${value > 1 ? 's' : ''}`,
}));

/** The timer mode every drill offers besides its own timed mode: stop when the drill time runs out. */
export const COUNT_DOWN_HALT_OPTION = { value: 'countDownHalt', label: 'Count Down & Halt' } as const;

export const ACCURACY_OPTIONS = [
  { value: 0, label: 'Exact' },
  { value: 1, label: '±1' },
  { value: 2, label: '±2' },
];

export const TRAY_OPTIONS = [
  { value: 'eightDeckFront', label: 'Eight-deck tray, front' },
  { value: 'sixDeckFront', label: 'Six-deck tray, front' },
  { value: 'doubleDeckFront', label: 'Double-deck tray, front' },
  { value: 'sixDeckRear', label: 'Six-deck tray, rear' },
  { value: 'doubleDeckRear', label: 'Double-deck tray, rear' },
] as const;

export const BIAS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'negative', label: 'Negative' },
  { value: 'positive', label: 'Positive' },
] as const;

export const END_WARNING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'oneCardLeft', label: 'One card left' },
  { value: 'twoCardsLeft', label: 'Two cards left' },
] as const;
