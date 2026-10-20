// The Playing Strategy Charts' two sides: the strategy, decks, indices and rules each is built for, and how
// the key tells them apart.

import type { SettingKey, SettingReader, SettingsPatch, SettingValues } from './schema';
import { decksKey, SCOPES, TABLE_RULES, tableRuleKey } from './scopes';
import type { TableRuleKey } from './scopes';

export type ChartSide = 'charts' | 'compare';

/** What one side is built for. */
export interface SideSettings {
  system: number;
  decks: number;
  indexSet: SettingValues['charts.strategy.indexSet'];
  rules: Record<TableRuleKey, boolean>;
}

/** Where a side keeps each of its settings. */
export const sideKeys = (side: ChartSide) => ({
  system: `${SCOPES[side]}.strategy.system` as Extract<SettingKey, `${string}.strategy.system`>,
  decks: decksKey(side),
  indexSet: `${SCOPES[side]}.strategy.indexSet` as 'charts.strategy.indexSet' | 'charts.compare.strategy.indexSet',
  rule: (rule: TableRuleKey) => tableRuleKey(side, rule),
});

export function sideSettings(get: SettingReader, side: ChartSide): SideSettings {
  const keys = sideKeys(side);
  return {
    system: Number(get(keys.system)),
    decks: Number(get(keys.decks)),
    indexSet: get(keys.indexSet),
    rules: Object.fromEntries(TABLE_RULES.map(rule => [rule, Boolean(get(keys.rule(rule)))])) as SideSettings['rules'],
  };
}

/** The compared side set to the first side's settings, as Compare starts out. */
export function copyOfFirst(get: SettingReader): SettingsPatch {
  const first = sideSettings(get, 'charts');
  const keys = sideKeys('compare');
  return {
    [keys.system]: first.system,
    [keys.decks]: first.decks,
    [keys.indexSet]: first.indexSet,
    ...Object.fromEntries(TABLE_RULES.map(rule => [keys.rule(rule), first.rules[rule]])),
  };
}

/** How the key words each rule, on and off. */
const RULE_WORDS: Record<TableRuleKey, [on: string, off: string]> = {
  'rules.doubleAfterSplit': ['Double after split', 'No double after split'],
  'rules.dealerHitsSoft17': ['Hit soft 17', 'Stand soft 17'],
  'rules.noHoleCard': ['No hole card', 'Hole card'],
};

/**
 * The key's name for each side: its strategy, then whatever it is built for that the other side is not
 * ("High-Low · 2 decks · Stand soft 17").
 * @param names  A strategy's name, and an index set's, as the pickers list them.
 */
export function sideLabels(
  first: SideSettings,
  second: SideSettings,
  names: { strategy: (id: number) => string; indexSet: (set: SideSettings['indexSet']) => string },
): [string, string] {
  const label = (side: SideSettings, other: SideSettings) =>
    [
      names.strategy(side.system),
      side.decks !== other.decks && `${side.decks} deck${side.decks === 1 ? '' : 's'}`,
      side.indexSet !== other.indexSet && names.indexSet(side.indexSet),
      ...TABLE_RULES.map(rule => side.rules[rule] !== other.rules[rule] && RULE_WORDS[rule][side.rules[rule] ? 0 : 1]),
    ]
      .filter(Boolean)
      .join(' · ');
  return [label(first, second), label(second, first)];
}
