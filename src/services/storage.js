// Namespaced JSON storage on top of localStorage.

const PREFIX = 'bjv.';

export class Storage {
  /** @param {globalThis.Storage} [backend] */
  constructor(backend = globalThis.localStorage) {
    this.backend = backend;
  }

  get(key, fallback = undefined) {
    const raw = this.backend.getItem(PREFIX + key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    this.backend.setItem(PREFIX + key, JSON.stringify(value));
  }

  remove(key) {
    this.backend.removeItem(PREFIX + key);
  }

  /** Removes every key written by this app. */
  clear() {
    const keys = [];
    for (let i = 0; i < this.backend.length; i++) {
      const k = this.backend.key(i);
      if (k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => this.backend.removeItem(k));
  }
}

/** In-memory backend with the localStorage interface, for tests. */
export class MemoryBackend {
  constructor() {
    this.map = new Map();
  }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
