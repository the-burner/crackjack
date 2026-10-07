// Playing Strategy: which counting system to play, how many
// of its indices to use, the rules the tables are built for, and the table
// display.

import { reactScreen } from '../../react/screen.tsx';
import { useApp, useSettings } from '../../react/app-context.ts';
import { Button, CheckList, Select, StandardScreen, ValueButton } from '../../react/components.tsx';
import { SettingChecks } from '../../react/settings-form.tsx';
import { applyIndexRangeChange } from '../../settings/rules-logic.ts';
import { INDEX_SETS } from '../../core/strategy/strategy-tables.ts';
import type { IndexSet } from '../../core/strategy/strategy-tables.ts';
import type { SettingCheck } from '../../react/settings-form.tsx';

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
    <StandardScreen title="Strategies" help="settings.strategy">
      <div className="column">
        <div className="strat-row">
          <span className="label">Strategy:</span>
          <div className="strat-row__fill">
            <Select
              options={systemOptions}
              value={settings.get('strategy.system')}
              onChange={id => settings.set('strategy.system', id)}
            />
          </div>
        </div>
        <div className="strat-row">
          <span className="label">Indices:</span>
          <div className="strat-row__fill">
            <Select
              mini
              options={INDEX_SET_OPTIONS}
              value={settings.get('strategy.indexSet')}
              onChange={value => settings.set('strategy.indexSet', value)}
            />
          </div>
          <Button
            onClick={() => app.open('strategy.tables', { mode: 'editMask', maskKey: 'strategy.customIndexMask' })}
            data-action="select-indices"
          >
            Select
          </Button>
        </div>
        <div className="strat-row">
          <span className="label">Index Range:</span>
          <div className="strat-row__fill row">
            <ValueButton
              value={settings.get('strategy.indexRangeMin')}
              onChange={v => writeRange('strategy.indexRangeMin', v)}
              prompt="Minimum Count"
              min={-99}
              max={99}
            />
            <span className="label">to</span>
            <ValueButton
              value={settings.get('strategy.indexRangeMax')}
              onChange={v => writeRange('strategy.indexRangeMax', v)}
              prompt="Maximum Count"
              min={-99}
              max={99}
            />
          </div>
        </div>
        <div className="strat-row">
          <span className="label">Rules:</span>
          <div className="strat-row__fill">
            <SettingChecks items={RULE_CHECKS} />
          </div>
        </div>
        <div className="row">
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
          onClick={() => app.open('strategy.tables', { mode: 'view' })}
          data-action="display-tables"
        >
          Display Tables
        </Button>
      </div>
    </StandardScreen>
  );
}

export const playingStrategyScreen = reactScreen(PlayingStrategy);
