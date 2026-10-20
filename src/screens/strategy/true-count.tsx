// True Count Conversion: how one module turns its running count into a true count. The arithmetic
// itself lives in core/counting.ts; every module keeps its own answers here (settings/scopes.ts).

import { useSettings } from '@/react/app-context';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { Section, SettingsGroup, SettingsNote, SettingsRow } from '@/components/ui/settings-group';
import { ValueButton } from '@/components/ui/value-button';
import { scopedSettings } from '@/settings/scopes';
import type { ScopedKey, ScopedSettings, ScopeName } from '@/settings/scopes';
import type { SettingValues } from '@/settings/schema';

type Row<K extends ScopedKey> = {
  label: string;
  key: K;
  options: [SettingValues[`game.${K}`], string][];
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
/** Which cards count as gone: only the game has cards on a table. */
const REMAINING: Row<'trueCount.remainingCards'> = {
  label: 'Remaining Cards',
  key: 'trueCount.remainingCards',
  options: [
    ['dealt', 'Cards dealt'],
    ['shown', 'Cards shown'],
    ['inTray', 'Cards in tray'],
  ],
};

function SelectRow<K extends ScopedKey>({ row, own }: { row: Row<K>; own: ScopedSettings }) {
  return (
    <Select
      label={row.label}
      options={row.options.map(([value, label]) => ({ value, label }))}
      value={own.get(row.key)}
      onChange={value => own.set(row.key, value)}
    />
  );
}

export function TrueCount({ scope }: { scope: ScopeName }) {
  const own = scopedSettings(useSettings(), scope);
  // Only the game counts cards on a table and side counts: a drill asks the true count alone.
  const playing = scope === 'game';
  return (
    <ScreenLayout title="True Count Conversion" help="game.trueCount">
      <Column>
        <Section title="Calculation">
          <SettingsNote>Set the method of calculating true counts</SettingsNote>
          <SettingsGroup>
            <SelectRow row={RESOLUTION} own={own} />
            <SelectRow row={LAST_DECK} own={own} />
            <SelectRow row={ROUNDING} own={own} />
            {playing && <SelectRow row={REMAINING} own={own} />}
            {playing && (
              <SettingsRow label="Allowed estimation error">
                <ValueButton
                  label="Allowed estimation error"
                  value={own.get('trueCount.allowedErrorCards')}
                  onChange={v => own.set('trueCount.allowedErrorCards', v)}
                  prompt="Cards"
                  min={0}
                  max={13}
                />
              </SettingsRow>
            )}
            {playing && (
              <CheckList
                items={[
                  {
                    label: 'Ace side count',
                    checked: own.get('trueCount.aceSideCount'),
                    onChange: on => own.set('trueCount.aceSideCount', on),
                  },
                  {
                    label: 'Ten side count',
                    checked: own.get('trueCount.tenSideCount'),
                    onChange: on => own.set('trueCount.tenSideCount', on),
                  },
                ]}
              />
            )}
          </SettingsGroup>
        </Section>
      </Column>
    </ScreenLayout>
  );
}
