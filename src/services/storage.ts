// Namespaced JSON storage on top of localStorage.

const PREFIX = 'cj.';

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/** The part of the localStorage interface the app uses. */
export type StorageBackend = Pick<globalThis.Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

/** What `watch` listens on: the window, or a stand-in in tests. */
export type StorageEventTarget = Partial<Pick<Window, 'addEventListener' | 'removeEventListener'>>;

/** localStorage when it works, otherwise an in-memory stand-in. */
export function createBackend(): StorageBackend {
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
  readonly backend: StorageBackend;
  readonly persistent: boolean;
  onWriteError: ((err: unknown) => void) | null;
  private reported: boolean;

  constructor(backend: StorageBackend = createBackend()) {
    this.backend = backend;
    /** False when nothing written will outlive the page. */
    this.persistent = !(backend instanceof MemoryBackend);
    /** Called with the first write that fails, if set. */
    this.onWriteError = null;
    this.reported = false;
  }

  /** The value saved under `key`, or `fallback` when there is none or it is unreadable. */
  get(key: string): unknown;
  /** With an object fallback, the result is always an object. */
  get(key: string, fallback: object): Record<string, unknown>;
  get(key: string, fallback: unknown): unknown;
  get(key: string, fallback: unknown = undefined): unknown {
    const raw = this.backend.getItem(PREFIX + key);
    if (raw === null) return fallback;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return fallback;
    }
    // A stored null or scalar where the reader wants an object would break it.
    if (isObject(fallback) && !isObject(value)) return fallback;
    return value;
  }

  set(key: string, value: unknown) {
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

  remove(key: string) {
    this.backend.removeItem(PREFIX + key);
  }

  /** Removes every key written by this app. */
  clear() {
    const keys: string[] = [];
    for (let i = 0; i < this.backend.length; i++) {
      const k = this.backend.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => this.backend.removeItem(k));
  }

  /**
   * Calls `fn` with the new value whenever another tab changes `key`.
   * @returns unsubscribe
   */
  watch(key: string, fn: (value: unknown) => void, target: StorageEventTarget = globalThis): () => void {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREFIX + key) fn(this.get(key));
    };
    target.addEventListener?.('storage', onStorage);
    return () => target.removeEventListener?.('storage', onStorage);
  }
}

/** In-memory backend with the localStorage interface, for tests. */
export class MemoryBackend implements StorageBackend {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: unknown) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}
