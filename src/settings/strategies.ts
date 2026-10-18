// Strategy catalog and construction of the current
// strategy from settings.

import { STRATEGY_FILES } from '@/data/strategy-files';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import type { Strategy, TableOptions } from '@/core/strategy/strategy-tables';
import { BUILTIN_STRATEGIES } from './strategy-list';
import type { StrategyEntry } from './strategy-list';
import { ownOrDefault, tableRuleKey } from './scopes';
import type { ScopeName } from './scopes';
import { SETTINGS_SCHEMA } from './schema';
import type { AppSettings } from './schema';

/** Reads settings; the store, or anything with its `get`. */
type SettingsSource = Pick<AppSettings, 'get'>;

const FILES: Readonly<Record<number, string | undefined>> = STRATEGY_FILES;

export { BUILTIN_STRATEGIES, HOLE_CARD_STRATEGY } from './strategy-list';
export type { StrategyEntry } from './strategy-list';

/** The built-in strategies, by id. */
export class StrategyLibrary {
  private cache = new Map<string, Strategy>();

  /** Strategies selectable on the Playing Strategy screen. */
  list(): readonly StrategyEntry[] {
    return BUILTIN_STRATEGIES;
  }

  text(id: number): string | null {
    return FILES[id] ?? null;
  }

  /** Builds strategy `id` for the given rules (memoized). */
  build(id: number, options: TableOptions): Strategy {
    const key = JSON.stringify([id, options]);
    let strategy = this.cache.get(key);
    if (strategy === undefined) {
      const text = this.text(id) ?? STRATEGY_FILES[30];
      strategy = buildStrategy(text, options);
      this.cache.set(key, strategy);
      const oldest = this.cache.keys().next();
      if (this.cache.size > 50 && !oldest.done) this.cache.delete(oldest.value);
    }
    return strategy;
  }

  /** Builds the strategy module `scope` plays, for `decks` decks. */
  current(settings: SettingsSource, scope: ScopeName, decks: number, { system }: { system?: number } = {}): Strategy {
    const options = strategyOptions(settings, scope, decks);
    return this.build(system ?? Number(ownOrDefault(settings, scope, 'strategy.system')), options);
  }
}

/** Strategy table options from module `scope`'s own settings. */
export function strategyOptions(settings: SettingsSource, scope: ScopeName, decks: number): TableOptions {
  const own = <T>(key: Parameters<typeof ownOrDefault>[2]) => ownOrDefault(settings, scope, key) as T;
  // A drill not judged against the tables keeps no rules for them: they are built for the defaults.
  const rule = (key: Parameters<typeof tableRuleKey>[1]) => {
    const where = tableRuleKey(scope, key);
    return Boolean(where in SETTINGS_SCHEMA ? settings.get(where) : SETTINGS_SCHEMA[key].default);
  };
  const indexSet = own<TableOptions['indexSet']>('strategy.indexSet');
  return {
    decks,
    hitSoft17: rule('rules.dealerHitsSoft17'),
    doubleAfterSplit: rule('rules.doubleAfterSplit'),
    noHoleCard: rule('rules.noHoleCard'),
    indexSet,
    customMask: indexSet === 'custom' ? own<TableOptions['customMask']>('strategy.customIndexMask') : null,
    rangeLow: own<number>('strategy.indexRangeMin'),
    rangeHigh: own<number>('strategy.indexRangeMax'),
    forcedInitialRunningCount: own<boolean>('strategy.adjustInitialCount')
      ? own<number>('strategy.initialCount')
      : null,
  };
}
