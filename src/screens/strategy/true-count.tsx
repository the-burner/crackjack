// True Count Calcs: how the running count is turned into a true
// count. The arithmetic itself lives in core/counting.js.

import { reactScreen } from '../../react/screen.tsx';
import { useSettings } from '../../react/app-context.ts';
import { CheckList, Select, StandardScreen, ValueButton } from '../../react/components.tsx';
import { SettingsGroup } from '../../react/settings-form.tsx';
import type { SettingValues } from '../../settings/schema.ts';

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

function SelectRow<K extends keyof SettingValues>({ row }: { row: Row<K> }) {
  const settings = useSettings();
  return (
    <div className="tc-row">
      <span className="label">{row.label}</span>
      <Select
        mini
        options={row.options.map(([value, label]) => ({ value, label }))}
        value={settings.get(row.key)}
        onChange={value => settings.set(row.key, value)}
      />
    </div>
  );
}

export function TrueCount() {
  const settings = useSettings();
  return (
    <StandardScreen title="TC Calcs" help="settings.trueCount">
      <div className="column">
        <p className="note settings-note">Set the method of calculating true counts</p>
        <SettingsGroup>
          <SelectRow row={RESOLUTION} />
          <SelectRow row={LAST_DECK} />
          <SelectRow row={ROUNDING} />
          <SelectRow row={REMAINING} />
          <div className="tc-row">
            <span className="label">Allowed estimation error:</span>
            <ValueButton
              value={settings.get('trueCount.allowedErrorCards')}
              onChange={v => settings.set('trueCount.allowedErrorCards', v)}
              prompt="Cards"
              min={0}
              max={13}
            />
          </div>
          <CheckList
            items={SIDE_COUNTS.map(({ label, key }) => ({
              label,
              checked: settings.get(key),
              onChange: on => settings.set(key, on),
            }))}
          />
        </SettingsGroup>
      </div>
    </StandardScreen>
  );
}

export const trueCountScreen = reactScreen(TrueCount);
