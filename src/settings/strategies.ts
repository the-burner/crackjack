// Strategy catalog and construction of the current
// strategy from settings.

import { STRATEGY_FILES } from '../data/strategy-files.ts';
import { buildStrategy } from '../core/strategy/strategy-tables.ts';
import type { Strategy, TableOptions } from '../core/strategy/strategy-tables.ts';
import type { AppSettings } from './schema.ts';

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

  /** Builds the user's selected strategy for `decks` decks. */
  current(
    settings: SettingsSource,
    decks: number,
    { system = settings.get('strategy.system') }: { system?: number } = {},
  ): Strategy {
    return this.build(system, strategyOptions(settings, decks));
  }
}

/** Strategy table options derived from the shared settings. */
export function strategyOptions(settings: SettingsSource, decks: number): TableOptions {
  return {
    decks,
    hitSoft17: settings.get('rules.dealerHitsSoft17'),
    doubleAfterSplit: settings.get('rules.doubleAfterSplit'),
    noHoleCard: settings.get('rules.noHoleCard'),
    indexSet: settings.get('strategy.indexSet'),
    customMask: settings.get('strategy.indexSet') === 'custom' ? settings.get('strategy.customIndexMask') : null,
    rangeLow: settings.get('strategy.indexRangeMin'),
    rangeHigh: settings.get('strategy.indexRangeMax'),
    forcedInitialRunningCount: settings.get('strategy.adjustInitialCount')
      ? settings.get('strategy.initialCount')
      : null,
  };
}
