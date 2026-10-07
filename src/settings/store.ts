// Schema-driven settings: typed values with defaults, persisted as one object.

import type { Storage } from '../services/storage.ts';

const STORAGE_KEY = 'settings';

/** Version of the saved `{ version, values }` envelope. */
export const SETTINGS_VERSION = 1;

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
 * the flat object of values saved before the envelope.
 */
const MIGRATIONS: readonly ((values: Record<string, unknown>) => Record<string, unknown>)[] = [values => values];

/** The values in a saved settings object, brought up to the current version. */
export function migrate(saved: unknown): Record<string, unknown> {
  if (!isRecord(saved)) return {};
  const { version, values } = saved;
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

export class Settings<S extends SettingsSchema = SettingsSchema> {
  readonly schema: S;
  readonly storage: Storage;
  private listeners = new Set<SettingsListener<S>>();
  values: SettingsValues<S>;

  constructor(schema: S, storage: Storage) {
    this.schema = schema;
    this.storage = storage;
    this.values = this.read();
    // Another tab writing the same key would otherwise be erased by our next save.
    this.storage.watch?.(STORAGE_KEY, () => this.reload());
  }

  private keys(): SettingsKey<S>[] {
    return Object.keys(this.schema) as SettingsKey<S>[];
  }

  private check(key: string): asserts key is SettingsKey<S> {
    if (!(key in this.schema)) throw new Error(`Unknown setting: ${key}`);
  }

  /** Re-reads what another tab saved, and tells the listeners about each key that changed. */
  reload() {
    const before = this.values;
    this.load();
    for (const key of this.keys()) {
      if (JSON.stringify(before[key]) === JSON.stringify(this.values[key])) continue;
      this.notify(key);
    }
  }

  load() {
    this.values = this.read();
  }

  private read(): SettingsValues<S> {
    const saved = migrate(this.storage.get(STORAGE_KEY));
    const values: Partial<SettingsValues<S>> = {};
    for (const key of this.keys()) {
      values[key] = key in saved ? this.coerce(key, saved[key]) : structuredClone(this.schema[key].default);
    }
    return values as SettingsValues<S>;
  }

  save() {
    this.storage.set(STORAGE_KEY, { version: SETTINGS_VERSION, values: this.values });
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
    const changed: SettingsKey<S>[] = [];
    for (const [key, value] of Object.entries(changes)) {
      this.check(key);
      const v = this.coerce(key, value);
      if (!this.same(key, v, this.values[key])) {
        Object.assign(this.values, { [key]: v });
        changed.push(key);
      }
    }
    if (changed.length) {
      this.save();
      changed.forEach(key => this.notify(key));
    }
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
