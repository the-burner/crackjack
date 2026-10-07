// Playing Strategy: which counting system to play, how many
// of its indices to use, the rules the tables are built for, and the table
// display.

import { Grid3x3Icon } from 'lucide-react';
import { reactScreen } from '@/react/screen';
import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { ListButton, ScreenLayout } from '@/components/screen-layout';
import { OptionSelect, SettingRow, SettingsGroup } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';
import { NumberButton, SwitchRow } from '@/components/settings/controls';
import { SettingSwitches } from '@/components/settings-controls';
import { applyIndexRangeChange } from '@/settings/rules-logic';
import { INDEX_SETS } from '@/core/strategy/strategy-tables';
import type { IndexSet } from '@/core/strategy/strategy-tables';

const INDEX_SET_LABELS: Record<IndexSet, string> = {
  all: 'All Indices',
  illustrious18: 'Illustrious 18',
  sweet16: 'Sweet 16',
  catch20: 'Catch 20',
  none: 'No Indices',
  custom: 'Custom',
};

const INDEX_SET_OPTIONS = INDEX_SETS.map(value => ({ value, label: INDEX_SET_LABELS[value] }));

// A rule here is the same rule as on the settings screens, so it goes through
// the same constraints.
const RULE_CHECKS: SettingCheck[] = [
  { label: 'Warning on Strategy Error', key: 'strategy.warnOnError' },
  { label: 'Double after split', key: 'rules.doubleAfterSplit' },
  { label: 'Hit soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', key: 'rules.noHoleCard' },
  { label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' },
];

export function PlayingStrategy() {
  const app = useApp();
  const settings = useSettings();
  const writeRange = (key: 'strategy.indexRangeMin' | 'strategy.indexRangeMax', value: number) =>
    settings.update(applyIndexRangeChange(k => settings.get(k), key, value));
  const systemOptions = app.strategies.list().map(({ id, name }) => ({ value: id, label: name }));

  return (
    <ScreenLayout title="Strategies" help="settings.strategy">
      <div className="mx-auto grid max-w-4xl items-start gap-4 md:grid-cols-2">
        <SettingsGroup>
          <OptionSelect
            label="Strategy"
            options={systemOptions}
            value={settings.get('strategy.system')}
            onChange={id => settings.set('strategy.system', id)}
          />
          <OptionSelect
            label="Indices"
            options={INDEX_SET_OPTIONS}
            value={settings.get('strategy.indexSet')}
            onChange={value => settings.set('strategy.indexSet', value)}
          />
          <ListButton
            onClick={() => app.open('strategy.tables', { mode: 'editMask', maskKey: 'strategy.customIndexMask' })}
            data-action="select-indices"
          >
            Select Custom Indices
          </ListButton>
          <SettingRow label="Index Range">
            <NumberButton
              label="Index range minimum"
              value={settings.get('strategy.indexRangeMin')}
              onChange={v => writeRange('strategy.indexRangeMin', v)}
              prompt="Minimum Count"
              min={-99}
              max={99}
            />
            <span className="text-sm text-muted-foreground">to</span>
            <NumberButton
              label="Index range maximum"
              value={settings.get('strategy.indexRangeMax')}
              onChange={v => writeRange('strategy.indexRangeMax', v)}
              prompt="Maximum Count"
              min={-99}
              max={99}
            />
          </SettingRow>
        </SettingsGroup>
        <SettingsGroup title="Rules">
          <SettingSwitches items={RULE_CHECKS} />
          <SwitchRow
            label="Adjust IRC"
            checked={settings.get('strategy.adjustInitialCount')}
            onCheckedChange={on => settings.set('strategy.adjustInitialCount', on)}
          >
            <NumberButton
              label="Initial running count"
              value={settings.get('strategy.initialCount')}
              onChange={v => settings.set('strategy.initialCount', v)}
              prompt="Adjust IRC"
              min={-999}
              max={999}
            />
          </SwitchRow>
        </SettingsGroup>
        <Button
          size="lg"
          className="h-12 md:col-span-2"
          onClick={() => app.open('strategy.tables', { mode: 'view' })}
          data-action="display-tables"
        >
          <Grid3x3Icon />
          Display Tables
        </Button>
      </div>
    </ScreenLayout>
  );
}

export const playingStrategyScreen = reactScreen(PlayingStrategy);
