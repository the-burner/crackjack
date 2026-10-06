// Namespaced JSON storage on top of localStorage.

const PREFIX = 'cj.';

const isObject = value => typeof value === 'object' && value !== null;

/** localStorage when it works, otherwise an in-memory stand-in. */
export function createBackend() {
  try {
    const backend = globalThis.localStorage;
    backend.setItem(`${PREFIX}probe`, '1');
    backend.removeItem(`${PREFIX}probe`);
    return backend;
  } catch {
    // Blocked cookies, private mode, an embedded web view: the app still runs.
    return new MemoryBackend();
  }
}

export class Storage {
  /** @param {globalThis.Storage} [backend] */
  constructor(backend = createBackend()) {
    this.backend = backend;
    /** False when nothing written will outlive the page. */
    this.persistent = !(backend instanceof MemoryBackend);
    /** Called with the first write that fails, if set. */
    this.onWriteError = null;
    this.reported = false;
  }

  get(key, fallback = undefined) {
    const raw = this.backend.getItem(PREFIX + key);
    if (raw === null) return fallback;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      return fallback;
    }
    // A stored null or scalar where the reader wants an object would break it.
    if (isObject(fallback) && !isObject(value)) return fallback;
    return value;
  }

  set(key, value) {
    try {
      this.backend.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      // A full or blocked store must not throw out of whatever was saving.
      if (!this.reported) {
        this.reported = true;
        this.onWriteError?.(err);
      }
    }
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

  /**
   * Calls `fn` with the new value whenever another tab changes `key`.
   * @returns {() => void} unsubscribe
   */
  watch(key, fn, target = globalThis) {
    const onStorage = event => { if (event.key === PREFIX + key) fn(this.get(key)); };
    target.addEventListener?.('storage', onStorage);
    return () => target.removeEventListener?.('storage', onStorage);
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
