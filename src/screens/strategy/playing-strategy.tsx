// Playing Strategy: which counting system to play, how many
// of its indices to use, the rules the tables are built for, and the table
// display.

import type { ReactNode } from 'react';
import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/text';
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
  { label: 'Warning on Strategy Error', key: 'strategy.warnOnError' },
  { label: 'Double after split', key: 'rules.doubleAfterSplit' },
  { label: 'Hit soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', key: 'rules.noHoleCard' },
  { label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' },
];

/** A label in the narrow left column and a control filling the rest. */
function StratRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="flex-[0_0_90px] text-[14px] leading-[normal]">{label}</Label>
      {children}
    </div>
  );
}

export function PlayingStrategy() {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const writeRange = (key: 'strategy.indexRangeMin' | 'strategy.indexRangeMax', value: number) =>
    settings.update(applyIndexRangeChange(k => settings.get(k), key, value));
  const systemOptions = app.strategies.list().map(({ id, name }) => ({ value: id, label: name }));

  return (
    <ScreenLayout title="Strategies" help="settings.strategy">
      <Column>
        <StratRow label="Strategy:">
          <div className="min-w-0 flex-1">
            <Select
              aria-label="Strategy"
              options={systemOptions}
              value={settings.get('strategy.system')}
              onChange={id => settings.set('strategy.system', id)}
            />
          </div>
        </StratRow>
        <StratRow label="Indices:">
          <div className="min-w-0 flex-1">
            <Select
              mini
              aria-label="Indices"
              options={INDEX_SET_OPTIONS}
              value={settings.get('strategy.indexSet')}
              onChange={value => settings.set('strategy.indexSet', value)}
            />
          </div>
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
        </StratRow>
        <StratRow label="Index Range:">
          <div className="flex min-w-0 flex-1 items-center gap-2 *:flex-1">
            <ValueButton
              label="Index range minimum"
              value={settings.get('strategy.indexRangeMin')}
              onChange={v => writeRange('strategy.indexRangeMin', v)}
              prompt="Minimum Count"
              min={-99}
              max={99}
            />
            <Label className="flex-none! text-center">to</Label>
            <ValueButton
              label="Index range maximum"
              value={settings.get('strategy.indexRangeMax')}
              onChange={v => writeRange('strategy.indexRangeMax', v)}
              prompt="Maximum Count"
              min={-99}
              max={99}
            />
          </div>
        </StratRow>
        <StratRow label="Rules:">
          <div className="min-w-0 flex-1">
            <SettingChecks items={RULE_CHECKS} />
          </div>
        </StratRow>
        <div className="flex items-center gap-2 *:flex-1">
          <CheckList
            items={[
              {
                label: 'Adjust IRC',
                checked: settings.get('strategy.adjustInitialCount'),
                onChange: on => settings.set('strategy.adjustInitialCount', on),
              },
            ]}
          />
          <ValueButton
            label="Initial running count"
            value={settings.get('strategy.initialCount')}
            onChange={v => settings.set('strategy.initialCount', v)}
            prompt="Adjust IRC"
            min={-999}
            max={999}
          />
        </div>
        <Button
          icon="grid"
          iconPos="bottom"
          onClick={() => navigate(PATHS['strategy.tables'] + tablesSearch({ mode: 'view' }))}
          data-action="display-tables"
        >
          Display Tables
        </Button>
      </Column>
    </ScreenLayout>
  );
}
