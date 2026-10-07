// True Count Calcs: how the running count is turned into a true
// count. The arithmetic itself lives in core/counting.js.

import { useSettings } from '@/react/app-context';
import { ScreenLayout } from '@/components/screen-layout';
import { OptionSelect, SettingsGroup } from '@/components/settings-controls';
import { NumberRow, SwitchRow } from '@/components/settings/controls';
import type { SettingValues } from '@/settings/schema';

type Row<K extends keyof SettingValues> = {
  label: string;
  key: K;
  options: [SettingValues[K], string][];
};

const RESOLUTION: Row<'trueCount.resolution'> = {
  label: 'True Count Resolution',
  key: 'trueCount.resolution',
  options: [
    ['full', 'Full Deck'],
    ['half', 'Half Deck'],
    ['quarter', 'Quarter Deck'],
    ['exact', 'Exact'],
  ],
};
const LAST_DECK: Row<'trueCount.lastDeckResolution'> = {
  label: 'Last Deck Resolution',
  key: 'trueCount.lastDeckResolution',
  options: [
    ['half', 'Half Deck'],
    ['quarter', 'Quarter Deck'],
    ['exact', 'Exact'],
  ],
};
const ROUNDING: Row<'trueCount.rounding'> = {
  label: 'True Count Division',
  key: 'trueCount.rounding',
  options: [
    ['round', 'Round'],
    ['truncate', 'Truncate'],
    ['floor', 'Floor'],
  ],
};
const REMAINING: Row<'trueCount.remainingCards'> = {
  label: 'Remaining Cards',
  key: 'trueCount.remainingCards',
  options: [
    ['dealt', 'Cards dealt'],
    ['shown', 'Cards shown'],
    ['inTray', 'Cards in tray'],
  ],
};

const SIDE_COUNTS = [
  { label: 'Ace side count', key: 'trueCount.aceSideCount' },
  { label: 'Ten side count', key: 'trueCount.tenSideCount' },
] as const;

function SelectRow<K extends keyof SettingValues>({ row }: { row: Row<K> }) {
  const settings = useSettings();
  return (
    <OptionSelect
      label={row.label}
      options={row.options.map(([value, label]) => ({ value, label }))}
      value={settings.get(row.key)}
      onChange={value => settings.set(row.key, value)}
    />
  );
}

export function TrueCount() {
  const settings = useSettings();
  return (
    <ScreenLayout title="TC Calcs" help="settings.trueCount">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">Set the method of calculating true counts</p>
        <SettingsGroup>
          <SelectRow row={RESOLUTION} />
          <SelectRow row={LAST_DECK} />
          <SelectRow row={ROUNDING} />
          <SelectRow row={REMAINING} />
          <NumberRow
            label="Allowed estimation error"
            value={settings.get('trueCount.allowedErrorCards')}
            onChange={v => settings.set('trueCount.allowedErrorCards', v)}
            prompt="Cards"
            min={0}
            max={13}
          />
          {SIDE_COUNTS.map(({ label, key }) => (
            <SwitchRow
              key={key}
              label={label}
              checked={settings.get(key)}
              onCheckedChange={on => settings.set(key, on)}
            />
          ))}
        </SettingsGroup>
      </div>
    </ScreenLayout>
  );
}
