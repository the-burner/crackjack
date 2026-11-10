// Playing Strategy: which counting system one module plays, and of what follows from it only what
// the module reads (settings/scopes.ts): the indices and the rules its tables are built for where
// it is judged against them, the initial count where it counts a shoe. The game's follow the table's
// rules unless Use the table's rules is turned off.

import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { ListRow, Section, SettingsGroup, SettingsNote, SettingsRow } from '@/components/ui/settings-group';
import { ValueButton } from '@/components/ui/value-button';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';
import { applyIndexRangeChange } from '@/settings/rules-logic';
import type { IndexRangeKey } from '@/settings/rules-logic';
import { decksOf, indexMaskKey, keeps, scopedSettings, tableRuleKey, TABLE_RULES } from '@/settings/scopes';
import type { ScopeName, TableRuleKey } from '@/settings/scopes';
import type { IndexSet } from '@/core/strategy/strategy-tables';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { useNavigate } from 'react-router';
import { PATHS, tablesSearch } from '@/app/paths';

export const INDEX_SET_LABELS: Record<IndexSet, string> = {
  all: 'All Indices',
  illustrious18: 'Illustrious 18',
  sweet16: 'Sweet 16',
  catch20: 'Catch 20',
  crack35: 'Crack 35',
  none: 'No Indices',
  custom: 'Custom',
};

const INDEX_SET_OPTIONS = SETTINGS_SCHEMA['game.strategy.indexSet'].values.map(value => ({
  value,
  label: INDEX_SET_LABELS[value],
}));

/** The modules whose hands may double on more than two cards by a rule of their own (the game's is the table's). */
const DOUBLE_ANY: Partial<Record<ScopeName, SettingCheck['key']>> = {
  flash: 'drills.flash.rules.doubleAnyNumberOfCards',
};

/** The module's own copies of the rules its tables are built for. */
function ruleChecks(scope: ScopeName): SettingCheck[] {
  const doubleAny = DOUBLE_ANY[scope];
  return [
    { label: 'Double after split', key: tableRuleKey(scope, 'rules.doubleAfterSplit') },
    { label: 'Hit soft 17', key: tableRuleKey(scope, 'rules.dealerHitsSoft17') },
    { label: 'No hole card', key: tableRuleKey(scope, 'rules.noHoleCard') },
    ...(doubleAny ? [{ label: 'Double any number of cards', key: doubleAny }] : []),
  ];
}

export function PlayingStrategy({ scope }: { scope: ScopeName }) {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const own = scopedSettings(settings, scope);
  const writeRange = (key: IndexRangeKey, value: number) =>
    own.update(applyIndexRangeChange(k => own.get(k), key, value));
  const systemOptions = app.strategies.list().map(({ id, name }) => ({ value: id, label: name }));
  /** The tables as this module plays them: its strategy, built for its decks. */
  const tables = (over: Omit<Parameters<typeof tablesSearch>[0], 'scope'> = {}) =>
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
              {scope === 'game' && <TableRulesSwitch />}
              {scope === 'game' && settings.get('game.strategy.useTableRules') ? (
                <SettingsNote>{`Built for the table's rules: ${tableRulesSummary(k => settings.get(k))}.`}</SettingsNote>
              ) : (
                <SettingChecks items={ruleChecks(scope)} />
              )}
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

/** The game's strategy follows the table's rules, or (turned off) its own, starting from the table's. */
function TableRulesSwitch() {
  const settings = useSettings();
  const on = settings.get('game.strategy.useTableRules');
  return (
    <CheckList
      items={[
        {
          label: "Use the table's rules",
          checked: on,
          onChange: value =>
            settings.update({
              'game.strategy.useTableRules': value,
              ...(value
                ? {}
                : Object.fromEntries(TABLE_RULES.map(key => [tableRuleKey('game', key), settings.get(key)]))),
            }),
        },
      ]}
    />
  );
}

/** "H17, DAS, hole card": the table rules the strategy is built for. */
export function tableRulesSummary(get: (key: TableRuleKey) => boolean): string {
  return [
    get('rules.dealerHitsSoft17') ? 'H17' : 'S17',
    get('rules.doubleAfterSplit') ? 'DAS' : 'no DAS',
    get('rules.noHoleCard') ? 'no hole card' : 'hole card',
  ].join(', ');
}
