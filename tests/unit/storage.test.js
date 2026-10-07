import { describe, it, expect } from 'vitest';
import { Storage, MemoryBackend } from '../../src/services/storage.ts';

const store = () => {
  const backend = new MemoryBackend();
  return { backend, storage: new Storage(backend) };
};

describe('namespaced storage', () => {
  it('round-trips a value through JSON', () => {
    const { storage } = store();
    storage.set('bankroll', { amount: 500, chips: [1, 5] });
    expect(storage.get('bankroll')).toEqual({ amount: 500, chips: [1, 5] });
  });

  it('prefixes every key it writes', () => {
    const { backend, storage } = store();
    storage.set('stats', 1);
    expect(backend.getItem('cj.stats')).toBe('1');
    expect(backend.getItem('stats')).toBe(null);
  });

  it('returns the fallback for a key that was never written', () => {
    const { storage } = store();
    expect(storage.get('missing')).toBe(undefined);
    expect(storage.get('missing', 7)).toBe(7);
  });

  it('returns the fallback rather than throwing on damaged JSON', () => {
    const { backend, storage } = store();
    backend.setItem('cj.stats', '{not json');
    expect(storage.get('stats', 'fallback')).toBe('fallback');
  });

  it('reads back a stored null', () => {
    const { storage } = store();
    storage.set('seen', null);
    expect(storage.get('seen', 'fallback')).toBe(null);
  });

  it('returns the fallback when a stored scalar cannot stand in for an object', () => {
    const { backend, storage } = store();
    backend.setItem('cj.settings', 'null');
    expect(storage.get('settings', {})).toEqual({});
    backend.setItem('cj.settings', '7');
    expect(storage.get('settings', {})).toEqual({});
  });

  it('falls back to memory when localStorage cannot be reached', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      const storage = new Storage();
      storage.set('a', 1);
      expect(storage.get('a')).toBe(1);
      expect(storage.persistent).toBe(false);
    } finally {
      delete globalThis.localStorage;
    }
  });

  it('falls back to memory when localStorage refuses to write', () => {
    globalThis.localStorage = {
      setItem() {
        throw new Error('full');
      },
      getItem: () => null,
      removeItem() {},
    };
    try {
      expect(new Storage().persistent).toBe(false);
    } finally {
      delete globalThis.localStorage;
    }
  });

  it('keeps going when a write fails, and reports it once', () => {
    const backend = new MemoryBackend();
    backend.setItem = () => {
      throw new Error('quota');
    };
    const storage = new Storage(backend);
    const seen = [];
    storage.onWriteError = err => seen.push(err.message);
    expect(() => storage.set('a', 1)).not.toThrow();
    storage.set('b', 2);
    expect(seen).toEqual(['quota']);
  });

  it('tells a watcher when another tab changes a key', () => {
    const { backend, storage } = store();
    let onStorage = null;
    const target = {
      addEventListener: (type, fn) => {
        onStorage = fn;
      },
      removeEventListener: () => {
        onStorage = null;
      },
    };
    const seen = [];
    const stop = storage.watch('settings', value => seen.push(value), target);
    backend.setItem('cj.settings', '{"a":1}');
    onStorage({ key: 'cj.settings' });
    onStorage({ key: 'other.thing' });
    expect(seen).toEqual([{ a: 1 }]);
    stop();
    expect(onStorage).toBe(null);
  });

  it('removes one key', () => {
    const { backend, storage } = store();
    storage.set('a', 1);
    storage.set('b', 2);
    storage.remove('a');
    expect(storage.get('a', 'gone')).toBe('gone');
    expect(storage.get('b')).toBe(2);
    expect(backend.length).toBe(1);
  });

  it('clears only the keys this app wrote', () => {
    const { backend, storage } = store();
    storage.set('a', 1);
    storage.set('b', 2);
    backend.setItem('other.thing', 'keep');
    storage.clear();
    expect(backend.length).toBe(1);
    expect(backend.getItem('other.thing')).toBe('keep');
  });

  it('clears nothing when nothing was written', () => {
    const { backend, storage } = store();
    storage.clear();
    expect(backend.length).toBe(0);
  });

  it('uses the browser localStorage by default', () => {
    const backend = new MemoryBackend();
    globalThis.localStorage = backend;
    try {
      new Storage().set('a', 1);
      expect(backend.getItem('cj.a')).toBe('1');
    } finally {
      delete globalThis.localStorage;
    }
  });
});

describe('the in-memory backend', () => {
  it('counts and lists the keys in insertion order', () => {
    const backend = new MemoryBackend();
    backend.setItem('a', '1');
    backend.setItem('b', '2');
    expect(backend.length).toBe(2);
    expect(backend.key(0)).toBe('a');
    expect(backend.key(1)).toBe('b');
  });

  it('reports null for an index past the end', () => {
    expect(new MemoryBackend().key(0)).toBe(null);
  });

  it('stores every value as a string, as localStorage does', () => {
    const backend = new MemoryBackend();
    backend.setItem('n', 5);
    expect(backend.getItem('n')).toBe('5');
  });

  it('forgets one key, or all of them', () => {
    const backend = new MemoryBackend();
    backend.setItem('a', '1');
    backend.setItem('b', '2');
    backend.removeItem('a');
    expect(backend.getItem('a')).toBe(null);
    expect(backend.length).toBe(1);
    backend.clear();
    expect(backend.length).toBe(0);
  });

  it('shrugs off removing a key it does not have', () => {
    const backend = new MemoryBackend();
    backend.removeItem('nope');
    expect(backend.length).toBe(0);
  });
});
