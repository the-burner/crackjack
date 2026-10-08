// Playing Strategy: which counting system to play and its tables, how many of
// its indices to use, the rules the tables are built for, and the initial count.

import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { ListRow, Section, SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { ValueButton } from '@/components/ui/value-button';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';
import { applyIndexRangeChange } from '@/settings/rules-logic';
import { INDEX_SETS } from '@/core/strategy/strategy-tables';
import type { IndexSet } from '@/core/strategy/strategy-tables';
import { useNavigate } from 'react-router';
import { PATHS, tablesSearch } from '@/app/paths';

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
  { label: 'Double after split', key: 'rules.doubleAfterSplit' },
  { label: 'Hit soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', key: 'rules.noHoleCard' },
  { label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' },
];

export function PlayingStrategy() {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const writeRange = (key: 'strategy.indexRangeMin' | 'strategy.indexRangeMax', value: number) =>
    settings.update(applyIndexRangeChange(k => settings.get(k), key, value));
  const systemOptions = app.strategies.list().map(({ id, name }) => ({ value: id, label: name }));

  return (
    <ScreenLayout title="Strategies" help="settings.strategy">
      <Column className="gap-6 pt-1">
        <Section title="Strategy">
          <SettingsGroup>
            <Select
              aria-label="Strategy"
              options={systemOptions}
              value={settings.get('strategy.system')}
              onChange={id => settings.set('strategy.system', id)}
            />
            <ListRow
              block
              onClick={() => navigate(PATHS['strategy.tables'] + tablesSearch({ mode: 'view' }))}
              data-action="display-tables"
            >
              Display Tables
            </ListRow>
          </SettingsGroup>
        </Section>
        <Section title="Indices">
          <SettingsGroup>
            <SettingsRow>
              <Select
                aria-label="Indices"
                options={INDEX_SET_OPTIONS}
                value={settings.get('strategy.indexSet')}
                onChange={value => settings.set('strategy.indexSet', value)}
              />
              <Button
                onClick={() =>
                  navigate(
                    PATHS['strategy.tables'] + tablesSearch({ mode: 'editMask', maskKey: 'strategy.customIndexMask' }),
                  )
                }
                data-action="select-indices"
              >
                Select
              </Button>
            </SettingsRow>
            <SettingsRow label="Lowest index">
              <ValueButton
                label="Index range minimum"
                value={settings.get('strategy.indexRangeMin')}
                onChange={v => writeRange('strategy.indexRangeMin', v)}
                prompt="Minimum Count"
                min={-99}
                max={99}
              />
            </SettingsRow>
            <SettingsRow label="Highest index">
              <ValueButton
                label="Index range maximum"
                value={settings.get('strategy.indexRangeMax')}
                onChange={v => writeRange('strategy.indexRangeMax', v)}
                prompt="Maximum Count"
                min={-99}
                max={99}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
        <Section title="Rules">
          <SettingsGroup>
            <SettingChecks items={RULE_CHECKS} />
          </SettingsGroup>
        </Section>
        <Section title="Initial Running Count">
          <SettingsGroup>
            <CheckList
              items={[
                {
                  label: 'Adjust IRC',
                  checked: settings.get('strategy.adjustInitialCount'),
                  onChange: on => settings.set('strategy.adjustInitialCount', on),
                },
              ]}
            />
            <SettingsRow label="Initial running count">
              <ValueButton
                label="Initial running count"
                value={settings.get('strategy.initialCount')}
                onChange={v => settings.set('strategy.initialCount', v)}
                prompt="Adjust IRC"
                min={-999}
                max={999}
              />
            </SettingsRow>
          </SettingsGroup>
        </Section>
      </Column>
    </ScreenLayout>
  );
}
