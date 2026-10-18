// Strategy catalog and construction of the current
// strategy from settings.

import { STRATEGY_FILES } from '@/data/strategy-files';
import { buildStrategy } from '@/core/strategy/strategy-tables';
import type { Strategy, TableOptions } from '@/core/strategy/strategy-tables';
import { scopedKey, tableRuleKey } from './scopes';
import type { ScopeName } from './scopes';
import type { AppSettings } from './schema';

/** A strategy the player can pick. */
export interface StrategyEntry {
  id: number;
  name: string;
}

/** Reads settings; the store, or anything with its `get`. */
type SettingsSource = Pick<AppSettings, 'get'>;

const FILES: Readonly<Record<number, string | undefined>> = STRATEGY_FILES;

/** Built-in strategies in display order. The first is the default (see settings/schema.ts). */
export const BUILTIN_STRATEGIES = [
  [100, "Crackjack's High-Low Strategy"],
  [5, 'Basic Strategy'],
  [30, 'High-Low'],
  [31, 'Complete High-Low'],
  [32, 'Halves'],
  [73, 'KO Rookie'],
  [74, 'KO Preferred'],
  [75, 'KO Full 1-2 Decks'],
  [76, 'KO Full 6 Decks'],
  [77, 'KO Full 8 Decks'],
  [6, 'Basic Omega II'],
  [7, 'Advanced Omega II'],
  [80, 'Red7, 1&2 Deck'],
  [81, 'Red7, Shoes'],
  [2, 'Basic Zen Count'],
  [3, 'Complete Zen Count'],
  [92, 'Double Exposure'],
  [82, 'Hi-Lo Lite'],
  [83, '1998 Zen Count'],
  [20, 'Hi-Opt I Count'],
  [22, 'Hi-Opt II Count'],
  [96, 'REKO'],
  [24, 'REKO-F Single-Deck'],
  [25, 'REKO-F Double-Deck'],
  [26, 'REKO-F Six-Deck'],
  [27, 'REKO-F Eight-Deck'],
  [97, 'REKO-T'],
  [28, 'FELT'],
  [29, 'FELT-F'],
  [50, 'KISS Stage I'],
  [51, 'KISS Stage II'],
  [52, 'KISS Stage III'],
  [90, 'Spanish 21'],
  [91, 'Super Fun 21'],
  [40, 'Expert Count'],
  [70, 'Silver Fox Single Deck'],
  [71, 'Silver Fox Multiple Deck'],
  [60, 'UBZ11 Composite'],
  [61, 'UBZ11 Single Deck'],
  [42, 'Blackjack Apprenticeship'],
].map(([id, name]): StrategyEntry => ({ id: Number(id), name: String(name) }));

/** The built-in hole-carding strategy offered on the Peeking screen. */
export const HOLE_CARD_STRATEGY: StrategyEntry = { id: 99, name: 'Hole-Carding' };

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
    return this.build(system ?? Number(settings.get(scopedKey(scope, 'strategy.system'))), options);
  }
}

/** Strategy table options from module `scope`'s own settings. */
export function strategyOptions(settings: SettingsSource, scope: ScopeName, decks: number): TableOptions {
  const own = <T>(key: Parameters<typeof scopedKey>[1]) => settings.get(scopedKey(scope, key)) as T;
  const rule = (key: Parameters<typeof tableRuleKey>[1]) => Boolean(settings.get(tableRuleKey(scope, key)));
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
