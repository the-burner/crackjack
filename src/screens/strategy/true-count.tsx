// True Count Calcs: how the running count is turned into a true
// count. The arithmetic itself lives in core/counting.js.

import type { ReactNode } from 'react';
import { useSettings } from '@/react/app-context';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { Label } from '@/components/ui/text';
import { ValueButton } from '@/components/ui/value-button';
import type { SettingValues } from '@/settings/schema';

type Row<K extends keyof SettingValues> = {
  label: string;
  key: K;
  options: [SettingValues[K], string][];
};

const RESOLUTION: Row<'trueCount.resolution'> = {
  label: 'True Count Resolution:',
  key: 'trueCount.resolution',
  options: [
    ['full', 'Full Deck'],
    ['half', 'Half Deck'],
    ['quarter', 'Quarter Deck'],
    ['exact', 'Exact'],
  ],
};
const LAST_DECK: Row<'trueCount.lastDeckResolution'> = {
  label: 'Last Deck Resolution:',
  key: 'trueCount.lastDeckResolution',
  options: [
    ['half', 'Half Deck'],
    ['quarter', 'Quarter Deck'],
    ['exact', 'Exact'],
  ],
};
const ROUNDING: Row<'trueCount.rounding'> = {
  label: 'True Count Division:',
  key: 'trueCount.rounding',
  options: [
    ['round', 'Round'],
    ['truncate', 'Truncate'],
    ['floor', 'Floor'],
  ],
};
const REMAINING: Row<'trueCount.remainingCards'> = {
  label: 'Remaining Cards:',
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

/** A long label and a fixed-width control. */
function TcRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-(--control-h) items-center justify-between gap-2 px-3.5 *:not-data-[slot=label]:flex-[0_0_150px]">
      <Label className="min-w-0 flex-1">{label}</Label>
      {children}
    </div>
  );
}

function SelectRow<K extends keyof SettingValues>({ row }: { row: Row<K> }) {
  const settings = useSettings();
  return (
    <TcRow label={row.label}>
      <Select
        mini
        aria-label={row.label.replace(/:$/, '')}
        options={row.options.map(([value, label]) => ({ value, label }))}
        value={settings.get(row.key)}
        onChange={value => settings.set(row.key, value)}
      />
    </TcRow>
  );
}

export function TrueCount() {
  const settings = useSettings();
  return (
    <ScreenLayout title="TC Calcs" help="settings.trueCount">
      <Column>
        <SettingsNote>Set the method of calculating true counts</SettingsNote>
        <SettingsGroup>
          <SelectRow row={RESOLUTION} />
          <SelectRow row={LAST_DECK} />
          <SelectRow row={ROUNDING} />
          <SelectRow row={REMAINING} />
          <TcRow label="Allowed estimation error:">
            <ValueButton
              label="Allowed estimation error"
              value={settings.get('trueCount.allowedErrorCards')}
              onChange={v => settings.set('trueCount.allowedErrorCards', v)}
              prompt="Cards"
              min={0}
              max={13}
            />
          </TcRow>
          <CheckList
            items={SIDE_COUNTS.map(({ label, key }) => ({
              label,
              checked: settings.get(key),
              onChange: on => settings.set(key, on),
            }))}
          />
        </SettingsGroup>
      </Column>
    </ScreenLayout>
  );
}
