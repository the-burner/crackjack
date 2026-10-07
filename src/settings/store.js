// Schema-driven settings: typed values with defaults, persisted as one object.

const STORAGE_KEY = 'settings';

/**
 * A setting definition.
 * @typedef {object} SettingDef
 * @property {'bool'|'int'|'number'|'enum'|'string'|'json'} type
 * @property {*} default
 * @property {Array} [values]   Allowed values for 'enum'.
 * @property {number} [min]
 * @property {number} [max]
 * @property {(value: *) => boolean} [shape]  Accepts a 'json' value the default's shape cannot describe.
 */

/** Whether a json value is shaped like its default: same kind, array lengths and keys. */
function sameShape(value, def) {
  if (Array.isArray(def)) {
    return Array.isArray(value) && value.length === def.length && def.every((d, i) => sameShape(value[i], d));
  }
  if (def !== null && typeof def === 'object') {
    return (
      Boolean(value) &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.entries(def).every(([key, d]) => sameShape(value[key], d))
    );
  }
  return typeof value === typeof def;
}

export class Settings {
  /**
   * @param {Record<string, SettingDef>} schema  Flat map of dotted keys to definitions.
   * @param {import('./storage.js').Storage} storage
   */
  constructor(schema, storage) {
    this.schema = schema;
    this.storage = storage;
    this.listeners = new Set();
    this.values = {};
    this.load();
    // Another tab writing the same key would otherwise be erased by our next save.
    this.storage.watch?.(STORAGE_KEY, () => this.reload());
  }

  /** Re-reads what another tab saved, and tells the listeners about each key that changed. */
  reload() {
    const before = this.values;
    this.load();
    for (const key of Object.keys(this.schema)) {
      if (JSON.stringify(before[key]) === JSON.stringify(this.values[key])) continue;
      this.listeners.forEach(fn => fn(key, this.values[key]));
    }
  }

  load() {
    const saved = this.storage.get(STORAGE_KEY, {});
    this.values = {};
    for (const [key, def] of Object.entries(this.schema)) {
      this.values[key] = key in saved ? this.coerce(key, saved[key]) : structuredClone(def.default);
    }
  }

  save() {
    this.storage.set(STORAGE_KEY, this.values);
  }

  get(key) {
    if (!(key in this.schema)) throw new Error(`Unknown setting: ${key}`);
    return this.values[key];
  }

  /** Returns all settings under a prefix as an object without the prefix, e.g. group('rules'). */
  group(prefix) {
    const out = {};
    const p = `${prefix}.`;
    for (const key of Object.keys(this.schema)) if (key.startsWith(p)) out[key.slice(p.length)] = this.values[key];
    return out;
  }

  set(key, value) {
    if (!(key in this.schema)) throw new Error(`Unknown setting: ${key}`);
    const v = this.coerce(key, value);
    if (Object.is(v, this.values[key])) return;
    this.values[key] = v;
    this.save();
    this.listeners.forEach(fn => fn(key, v));
  }

  /** Applies several values at once (one save, one notification per key). */
  update(changes) {
    const changed = [];
    for (const [key, value] of Object.entries(changes)) {
      if (!(key in this.schema)) throw new Error(`Unknown setting: ${key}`);
      const v = this.coerce(key, value);
      if (!Object.is(v, this.values[key])) {
        this.values[key] = v;
        changed.push(key);
      }
    }
    if (changed.length) {
      this.save();
      changed.forEach(key => this.listeners.forEach(fn => fn(key, this.values[key])));
    }
  }

  /** Restores defaults (all settings, or those under the given prefixes). */
  reset(prefixes = null) {
    const changes = {};
    for (const [key, def] of Object.entries(this.schema)) {
      if (!prefixes || prefixes.some(p => key === p || key.startsWith(`${p}.`)))
        changes[key] = structuredClone(def.default);
    }
    this.update(changes);
  }

  /** @returns {() => void} unsubscribe */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  coerce(key, value) {
    const def = this.schema[key];
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
        return def.values.includes(value) ? value : structuredClone(def.default);
      case 'string':
        return String(value);
      default:
        return (def.shape ? def.shape(value) : sameShape(value, def.default)) ? value : structuredClone(def.default);
    }
  }
}
