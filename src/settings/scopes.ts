// Each module keeps its own copy of the settings it counts cards with: its playing strategy and its
// true count calcs, and for the game its betting. They live under the module's own prefix; a scope
// reads and writes one module's by the names its screens know, so one screen serves every module.

import type { AppSettings, SettingKey, SettingValues, SettingsPatch } from './schema';

/** Where each module keeps its own settings. */
export const SCOPES = {
  game: 'game',
  flash: 'drills.flash',
  depth: 'drills.depth',
  count: 'drills.count',
  full: 'drills.full',
} as const;

/** A module with settings of its own. */
export type ScopeName = keyof typeof SCOPES;

/** The name under `prefix` of every setting kept there. */
type Suffix<P extends string> = { [K in SettingKey]: K extends `${P}.${infer Name}` ? Name : never }[SettingKey];

/**
 * A setting a module keeps its own copy of, as its screens name it. The game keeps the most (it
 * alone bets), and every module's copy of a setting holds the same type, so its keys name them all.
 */
export type ScopedKey = Suffix<'game'>;

/** Where module `scope` keeps `key`. */
export const scopedKey = <K extends ScopedKey>(scope: ScopeName, key: K): SettingKey =>
  `${SCOPES[scope]}.${key}` as SettingKey;

/** The rules a module's strategy tables are built for; the game uses its own table rules. */
export const TABLE_RULES = ['rules.doubleAfterSplit', 'rules.dealerHitsSoft17', 'rules.noHoleCard'] as const;
export type TableRuleKey = (typeof TABLE_RULES)[number];

/** Where module `scope` keeps the rule its tables are built for. */
export const tableRuleKey = (scope: ScopeName, key: TableRuleKey): SettingKey =>
  (scope === 'game' ? key : `${SCOPES[scope]}.${key}`) as SettingKey;

/** Where module `scope` keeps the decks it plays with. */
export const decksKey = (scope: ScopeName): SettingKey => (scope === 'game' ? 'table.decks' : `${SCOPES[scope]}.decks`);

/** Where module `scope` keeps the mask of indices it plays (its Custom index set). */
export const indexMaskKey = (scope: ScopeName) =>
  `${SCOPES[scope]}.strategy.customIndexMask` as `${(typeof SCOPES)[ScopeName]}.strategy.customIndexMask`;

/** The decks module `scope` plays with. */
export const decksOf = (settings: Pick<AppSettings, 'get'>, scope: ScopeName): number =>
  Number(settings.get(decksKey(scope)));

/** One module's own settings, by the names its screens use. */
export interface ScopedSettings {
  readonly scope: ScopeName;
  get<K extends ScopedKey>(key: K): SettingValues[`game.${K}`];
  set<K extends ScopedKey>(key: K, value: SettingValues[`game.${K}`]): void;
  update(changes: { [K in ScopedKey]?: SettingValues[`game.${K}`] }): void;
}

/** Module `scope`'s own settings, over the app's. */
export function scopedSettings(
  settings: Pick<AppSettings, 'get' | 'set' | 'update'>,
  scope: ScopeName,
): ScopedSettings {
  return {
    scope,
    get: name => settings.get(scopedKey(scope, name)) as never,
    set: (name, value) => settings.set(scopedKey(scope, name), value as never),
    update: changes =>
      settings.update(
        Object.fromEntries(
          Object.entries(changes).map(([name, value]) => [scopedKey(scope, name as ScopedKey), value]),
        ) as SettingsPatch,
      ),
  };
}
