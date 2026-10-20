// Playing Strategy: which counting system one module plays, and of what follows from it only what
// the module reads (settings/scopes.ts): the indices and the rules its tables are built for where
// it is judged against them, the initial count where it counts a shoe. The game's rules are the
// table's own, so it edits those.

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
import type { IndexRangeKey } from '@/settings/rules-logic';
import { decksOf, indexMaskKey, keeps, scopedSettings, tableRuleKey } from '@/settings/scopes';
import type { ScopeName } from '@/settings/scopes';
import type { IndexSet } from '@/core/strategy/strategy-tables';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { useNavigate } from 'react-router';
import { PATHS, tablesSearch } from '@/app/paths';

export const INDEX_SET_LABELS: Record<IndexSet, string> = {
  all: 'All Indices',
  illustrious18: 'Illustrious 18',
  sweet16: 'Sweet 16',
  catch20: 'Catch 20',
  crack33: 'Crack 33',
  none: 'No Indices',
  custom: 'Custom',
};

const INDEX_SET_OPTIONS = SETTINGS_SCHEMA['game.strategy.indexSet'].values.map(value => ({
  value,
  label: INDEX_SET_LABELS[value],
}));

/**
 * The rules this module's tables are built for. The game's are the table's own rules, shown on its
 * rules screens too, so they go through the same constraints; a drill keeps its own.
 */
const ruleChecks = (scope: ScopeName): SettingCheck[] => [
  { label: 'Double after split', key: tableRuleKey(scope, 'rules.doubleAfterSplit') },
  { label: 'Hit soft 17', key: tableRuleKey(scope, 'rules.dealerHitsSoft17') },
  { label: 'No hole card', key: tableRuleKey(scope, 'rules.noHoleCard') },
  ...(scope === 'game' ? [{ label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' as const }] : []),
];

export function PlayingStrategy({ scope }: { scope: ScopeName }) {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const own = scopedSettings(settings, scope);
  const writeRange = (key: IndexRangeKey, value: number) =>
    own.update(applyIndexRangeChange(k => own.get(k), key, value));
  const systemOptions = app.strategies.list().map(({ id, name }) => ({ value: id, label: name }));
  /** The tables as this module plays them: its strategy, built for its decks. */
  const tables = (over: Parameters<typeof tablesSearch>[0] = {}) =>
    PATHS['strategy.tables'] +
    tablesSearch({ scope, system: own.get('strategy.system'), decks: decksOf(settings, scope), ...over });

  return (
    <ScreenLayout title="Playing Strategy" help="game.strategy">
      <Column className="gap-6 pt-1">
        <Section title="Strategy">
          <SettingsGroup>
            <Select
              aria-label="Strategy"
              options={systemOptions}
              value={own.get('strategy.system')}
              onChange={id => own.set('strategy.system', id)}
            />
            <ListRow block onClick={() => navigate(tables())} data-action="display-tables">
              Display Tables
            </ListRow>
          </SettingsGroup>
        </Section>
        {keeps(scope, 'strategy.indexSet') && (
          <Section title="Indices">
            <SettingsGroup>
              <SettingsRow>
                <Select
                  aria-label="Indices"
                  options={INDEX_SET_OPTIONS}
                  value={own.get('strategy.indexSet')}
                  onChange={value => own.set('strategy.indexSet', value)}
                />
                <Button
                  icon="arrow-r"
                  onClick={() => navigate(tables({ mode: 'editMask', maskKey: indexMaskKey(scope) }))}
                  data-action="select-indices"
                >
                  Select
                </Button>
              </SettingsRow>
              <SettingsRow label="Lowest index">
                <ValueButton
                  label="Index range minimum"
                  value={own.get('strategy.indexRangeMin')}
                  onChange={v => writeRange('strategy.indexRangeMin', v)}
                  prompt="Minimum Count"
                  min={-99}
                  max={99}
                />
              </SettingsRow>
              <SettingsRow label="Highest index">
                <ValueButton
                  label="Index range maximum"
                  value={own.get('strategy.indexRangeMax')}
                  onChange={v => writeRange('strategy.indexRangeMax', v)}
                  prompt="Maximum Count"
                  min={-99}
                  max={99}
                />
              </SettingsRow>
            </SettingsGroup>
          </Section>
        )}
        {keeps(scope, 'strategy.indexSet') && (
          <Section title="Rules">
            <SettingsGroup>
              <SettingChecks items={ruleChecks(scope)} />
            </SettingsGroup>
          </Section>
        )}
        {keeps(scope, 'strategy.adjustInitialCount') && (
          <Section title="Initial Running Count">
            <SettingsGroup>
              <CheckList
                items={[
                  {
                    label: 'Adjust IRC',
                    checked: own.get('strategy.adjustInitialCount'),
                    onChange: on => own.set('strategy.adjustInitialCount', on),
                  },
                ]}
              />
              <SettingsRow label="Initial running count">
                <ValueButton
                  label="Initial running count"
                  value={own.get('strategy.initialCount')}
                  onChange={v => own.set('strategy.initialCount', v)}
                  prompt="Adjust IRC"
                  min={-999}
                  max={999}
                />
              </SettingsRow>
            </SettingsGroup>
          </Section>
        )}
      </Column>
    </ScreenLayout>
  );
}
