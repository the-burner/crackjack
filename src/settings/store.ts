// Schema-driven settings: typed values with defaults, held in a Zustand store
// and persisted (with Zustand's persist middleware) as one object.

import { createStore } from 'zustand/vanilla';
import type { Mutate, StoreApi } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Storage } from '@/services/storage';

const STORAGE_KEY = 'settings';

/** Version of what is saved; 2 is Zustand's `{ state: { values }, version }`. */
export const SETTINGS_VERSION = 2;

/** A setting definition. */
export interface BoolDef {
  type: 'bool';
  default: boolean;
}
export interface NumberDef {
  type: 'int' | 'number';
  default: number;
  min?: number;
  max?: number;
}
export interface EnumDef<T extends string | number = string | number> {
  type: 'enum';
  /** Allowed values. */
  values: readonly T[];
  default: T;
}
export interface StringDef {
  type: 'string';
  default: string;
}
export interface JsonDef<T = unknown> {
  type: 'json';
  default: T;
  /** Accepts a 'json' value the default's shape cannot describe. */
  shape?: (value: unknown) => boolean;
}
export type SettingDef = BoolDef | NumberDef | EnumDef | StringDef | JsonDef;

/** Flat map of dotted keys to definitions. */
export type SettingsSchema = Record<string, SettingDef>;
export type SettingsKey<S extends SettingsSchema> = keyof S & string;
/** The value type of every setting in a schema. */
export type SettingsValues<S extends SettingsSchema> = { [K in keyof S]: S[K]['default'] };
/** The settings under `${P}.`, keyed without the prefix. */
export type SettingsGroup<S extends SettingsSchema, P extends string> = {
  [K in keyof S as K extends `${P}.${infer R}` ? R : never]: S[K]['default'];
};
/** A changed key with its new value; the value narrows when the key is checked. */
export type SettingChange<S extends SettingsSchema> = {
  [K in SettingsKey<S>]: [key: K, value: SettingsValues<S>[K]];
}[SettingsKey<S>];
export type SettingsListener<S extends SettingsSchema> = (...change: SettingChange<S>) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Upgrades what was saved by version n to version n + 1, by n. Version 0 is
 * the flat object of values saved before any envelope, 1 the `{ version,
 * values }` envelope, 2 Zustand's.
 */
const MIGRATIONS: readonly ((values: Record<string, unknown>) => Record<string, unknown>)[] = [
  values => values,
  values => values,
];

/** The values in a saved settings object of any version, brought up to the current one. */
export function migrate(saved: unknown): Record<string, unknown> {
  if (!isRecord(saved)) return {};
  const { version, values, state } = saved;
  if (Number.isInteger(version) && isRecord(state) && isRecord(state.values))
    return upgrade(Number(version), state.values);
  if (Number.isInteger(version) && Number(version) >= 1 && isRecord(values)) return upgrade(Number(version), values);
  return upgrade(0, saved);
}

/** Runs the migrations from `version` on; a newer version's values are read as they are. */
function upgrade(version: number, values: Record<string, unknown>): Record<string, unknown> {
  let out = values;
  for (let v = version; v < SETTINGS_VERSION; v += 1) out = MIGRATIONS[v](out);
  return out;
}

/** Whether a json value is shaped like its default: same kind, array lengths and keys. */
function sameShape(value: unknown, def: unknown): boolean {
  if (Array.isArray(def)) {
    return Array.isArray(value) && value.length === def.length && def.every((d, i) => sameShape(value[i], d));
  }
  if (def !== null && typeof def === 'object') {
    return isRecord(value) && Object.entries(def).every(([key, d]) => sameShape(value[key], d));
  }
  return typeof value === typeof def;
}

/** `value` as setting `def` holds it. */
function coerceTo(def: SettingDef, value: unknown): unknown {
  switch (def.type) {
    case 'bool':
      return Boolean(value);
    case 'int':
    case 'number': {
      let n = Number(value);
      if (!Number.isFinite(n)) return structuredClone(def.default);
      if (def.type === 'int') n = Math.round(n);
      if (def.min !== undefined) n = Math.max(def.min, n);
      if (def.max !== undefined) n = Math.min(def.max, n);
      return n;
    }
    case 'enum':
      return def.values.some(v => v === value) ? value : structuredClone(def.default);
    case 'string':
      return String(value);
    default:
      // Copied, so the caller's object cannot change the setting behind its back.
      return structuredClone((def.shape ? def.shape(value) : sameShape(value, def.default)) ? value : def.default);
  }
}

/** What the settings store holds. */
export type SettingsState<S extends SettingsSchema> = { values: SettingsValues<S> };

export class Settings<S extends SettingsSchema = SettingsSchema> {
  readonly schema: S;
  readonly storage: Storage;
  /** The Zustand store; React components read it with `useStore`. */
  readonly store: Mutate<StoreApi<SettingsState<S>>, [['zustand/persist', unknown]]>;
  private listeners = new Set<SettingsListener<S>>();

  constructor(schema: S, storage: Storage) {
    this.schema = schema;
    this.storage = storage;
    this.store = createStore<SettingsState<S>>()(
      persist(() => ({ values: this.defaults() }), {
        name: STORAGE_KEY,
        version: SETTINGS_VERSION,
        // Read raw, so every saved shape (flat, envelope, Zustand's) goes through migrate().
        storage: createJSONStorage(() => ({
          getItem: () => {
            const saved = storage.get(STORAGE_KEY);
            return saved === undefined
              ? null
              : JSON.stringify({ state: { values: migrate(saved) }, version: SETTINGS_VERSION });
          },
          setItem: (_, value) => storage.set(STORAGE_KEY, JSON.parse(value)),
          removeItem: () => storage.remove(STORAGE_KEY),
        })),
        // Every saved value is checked against its setting; anything else is the default.
        merge: (saved, current) => ({ ...current, values: this.valuesFrom(isRecord(saved) ? saved.values : {}) }),
      }),
    );
    this.store.subscribe((state, previous) => {
      for (const key of this.keys()) if (!this.same(key, state.values[key], previous.values[key])) this.notify(key);
    });
    // Another tab writing the same key would otherwise be erased by our next save.
    this.storage.watch?.(STORAGE_KEY, () => this.reload());
  }

  /** The current values (read-only: change them through set/update). */
  get values(): SettingsValues<S> {
    return this.store.getState().values;
  }

  private keys(): SettingsKey<S>[] {
    return Object.keys(this.schema) as SettingsKey<S>[];
  }

  private check(key: string): asserts key is SettingsKey<S> {
    if (!(key in this.schema)) throw new Error(`Unknown setting: ${key}`);
  }

  private defaults(): SettingsValues<S> {
    return this.valuesFrom({});
  }

  /** Every setting, from `saved` where it holds a valid value, else the default. */
  private valuesFrom(saved: unknown): SettingsValues<S> {
    const source = isRecord(saved) ? saved : {};
    const values: Partial<SettingsValues<S>> = {};
    for (const key of this.keys()) {
      values[key] = key in source ? this.coerce(key, source[key]) : structuredClone(this.schema[key].default);
    }
    return values as SettingsValues<S>;
  }

  /** Re-reads what another tab saved; the listeners hear about each key that changed. */
  reload() {
    void this.store.persist.rehydrate();
  }

  /** The value of `key`; json values are copies, so changing one means setting it back. */
  get<K extends SettingsKey<S>>(key: K): SettingsValues<S>[K] {
    this.check(key);
    const value = this.values[key];
    return this.schema[key].type === 'json' ? structuredClone(value) : value;
  }

  /** Returns all settings under a prefix as an object without the prefix, e.g. group('rules'). */
  group<P extends string>(prefix: P): SettingsGroup<S, P> {
    const out: Record<string, unknown> = {};
    const p = `${prefix}.`;
    for (const key of this.keys()) if (key.startsWith(p)) out[key.slice(p.length)] = this.get(key);
    return out as SettingsGroup<S, P>;
  }

  set<K extends SettingsKey<S>>(key: K, value: SettingsValues<S>[K]) {
    this.update({ [key]: value } as Partial<SettingsValues<S>>);
  }

  /** Applies several values at once (one save, one notification per key). */
  update(changes: Partial<SettingsValues<S>>) {
    const next = { ...this.values };
    let changed = false;
    for (const [key, value] of Object.entries(changes)) {
      this.check(key);
      const v = this.coerce(key, value);
      if (!this.same(key, v, next[key])) {
        Object.assign(next, { [key]: v });
        changed = true;
      }
    }
    if (changed) this.store.setState({ values: next });
  }

  /** Restores defaults (all settings, or those under the given prefixes). */
  reset(prefixes: readonly string[] | null = null) {
    const changes: Partial<SettingsValues<S>> = {};
    for (const key of this.keys()) {
      if (!prefixes || prefixes.some(p => key === p || key.startsWith(`${p}.`)))
        changes[key] = structuredClone(this.schema[key].default);
    }
    this.update(changes);
  }

  /** @returns unsubscribe */
  subscribe(fn: SettingsListener<S>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  coerce<K extends SettingsKey<S>>(key: K, value: unknown): SettingsValues<S>[K] {
    return coerceTo(this.schema[key], value) as SettingsValues<S>[K];
  }

  /** Whether two values of `key` are the same; json values compare by content. */
  private same(key: SettingsKey<S>, a: unknown, b: unknown): boolean {
    return this.schema[key].type === 'json' ? JSON.stringify(a) === JSON.stringify(b) : Object.is(a, b);
  }

  private notify(key: SettingsKey<S>) {
    const change = [key, this.get(key)] as SettingChange<S>;
    this.listeners.forEach(fn => fn(...change));
  }
}
