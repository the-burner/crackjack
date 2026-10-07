import { describe, it, expect } from 'vitest';
import { Storage, MemoryBackend } from '../../src/services/storage.ts';
import { Settings } from '../../src/settings/store.ts';

const schema = {
  'mechanics.sound': { type: 'bool', default: false },
  'mechanics.speed': { type: 'number', default: 2.5 },
  'mechanics.chips': { type: 'int', default: 100 },
  'display.name': { type: 'string', default: 'Player' },
  'rules.decks': { type: 'int', default: 6, min: 1, max: 8 },
  'rules.surrender': { type: 'enum', default: 'none', values: ['none', 'late', 'early'] },
  'betting.table': { type: 'json', default: [1, 2] },
  paused: { type: 'bool', default: false },
};

const fresh = () => new Settings(schema, new Storage(new MemoryBackend()));

describe('Settings', () => {
  it('starts from defaults and persists changes', () => {
    const storage = new Storage(new MemoryBackend());
    const s = new Settings(schema, storage);
    expect(s.get('mechanics.sound')).toBe(false);
    s.set('rules.decks', 2);
    expect(new Settings(schema, storage).get('rules.decks')).toBe(2);
  });

  it('coerces and clamps values, rejecting unknown keys and enum values', () => {
    const s = new Settings(schema, new Storage(new MemoryBackend()));
    s.set('rules.decks', 12);
    expect(s.get('rules.decks')).toBe(8);
    s.set('rules.surrender', 'bogus');
    expect(s.get('rules.surrender')).toBe('none');
    expect(() => s.set('nope', 1)).toThrow();
  });

  it('groups by prefix, notifies listeners and resets', () => {
    const s = new Settings(schema, new Storage(new MemoryBackend()));
    const seen = [];
    s.subscribe((k, v) => seen.push([k, v]));
    s.update({ 'rules.decks': 1, 'rules.surrender': 'late' });
    expect(s.group('rules')).toEqual({ decks: 1, surrender: 'late' });
    s.reset(['rules']);
    expect(s.group('rules')).toEqual({ decks: 6, surrender: 'none' });
    expect(seen.map(([k]) => k)).toEqual(['rules.decks', 'rules.surrender', 'rules.decks', 'rules.surrender']);
  });

  it('does not share default objects between instances', () => {
    const s = new Settings(schema, new Storage(new MemoryBackend()));
    s.get('betting.table').push(3);
    expect(schema['betting.table'].default).toEqual([1, 2]);
  });

  it('rejects an unknown key on read as well as write', () => {
    const s = fresh();
    expect(() => s.get('nope')).toThrow('Unknown setting: nope');
    expect(() => s.update({ nope: 1 })).toThrow('Unknown setting: nope');
  });

  it('ignores a saved value for a key the schema no longer has', () => {
    const storage = new Storage(new MemoryBackend());
    storage.set('settings', { 'rules.decks': 4, gone: 'stale' });
    const s = fresh();
    expect(Object.keys(new Settings(schema, storage).values)).toEqual(Object.keys(s.values));
  });
});

describe('coercion', () => {
  it('makes a bool of anything', () => {
    const s = fresh();
    s.set('mechanics.sound', 'yes');
    expect(s.get('mechanics.sound')).toBe(true);
    s.set('mechanics.sound', 0);
    expect(s.get('mechanics.sound')).toBe(false);
  });

  it('rounds an int but keeps a number as it is', () => {
    const s = fresh();
    s.set('mechanics.chips', 7.6);
    expect(s.get('mechanics.chips')).toBe(8);
    s.set('mechanics.speed', 7.6);
    expect(s.get('mechanics.speed')).toBe(7.6);
  });

  it('leaves an unbounded number unclamped', () => {
    const s = fresh();
    s.set('mechanics.chips', -5000);
    expect(s.get('mechanics.chips')).toBe(-5000);
  });

  it('clamps up to the minimum as well as down to the maximum', () => {
    const s = fresh();
    s.set('rules.decks', 0);
    expect(s.get('rules.decks')).toBe(1);
  });

  it('falls back to the default for a number that is not one', () => {
    const s = fresh();
    s.set('rules.decks', 'nonsense');
    expect(s.get('rules.decks')).toBe(6);
    s.set('mechanics.speed', Infinity);
    expect(s.get('mechanics.speed')).toBe(2.5);
  });

  it('makes a string of a string setting', () => {
    const s = fresh();
    s.set('display.name', 42);
    expect(s.get('display.name')).toBe('42');
  });

  it('takes a json setting shaped like its default as given', () => {
    const s = fresh();
    s.set('betting.table', [5, 10]);
    expect(s.get('betting.table')).toEqual([5, 10]);
  });

  it('falls back to the default for a json setting of another shape', () => {
    const s = fresh();
    s.set('betting.table', 'oops');
    expect(s.get('betting.table')).toEqual([1, 2]);
    s.set('betting.table', [5, 10, 15]);
    expect(s.get('betting.table')).toEqual([1, 2]);
  });
});

describe('change notifications', () => {
  it('says nothing when the value is already what was asked for', () => {
    const s = fresh();
    const seen = [];
    s.subscribe(key => seen.push(key));
    s.set('rules.decks', 6);
    s.update({ 'rules.decks': 6, 'mechanics.sound': false });
    expect(seen).toEqual([]);
  });

  it('reports only the keys an update actually changed', () => {
    const s = fresh();
    const seen = [];
    s.subscribe(key => seen.push(key));
    s.update({ 'rules.decks': 6, 'rules.surrender': 'late' });
    expect(seen).toEqual(['rules.surrender']);
  });

  it('stops telling a listener that unsubscribed', () => {
    const s = fresh();
    const seen = [];
    const off = s.subscribe(key => seen.push(key));
    s.set('rules.decks', 2);
    off();
    s.set('rules.decks', 4);
    expect(seen).toEqual(['rules.decks']);
  });

  it('does not touch storage for a change that changes nothing', () => {
    const storage = new Storage(new MemoryBackend());
    const s = new Settings(schema, storage);
    s.update({});
    expect(storage.get('settings', 'untouched')).toBe('untouched');
  });
});

describe('resetting', () => {
  it('restores everything when no prefix is given', () => {
    const s = fresh();
    s.update({ 'rules.decks': 1, 'display.name': 'Ada', paused: true });
    s.reset();
    expect(s.get('rules.decks')).toBe(6);
    expect(s.get('display.name')).toBe('Player');
    expect(s.get('paused')).toBe(false);
  });

  it('leaves settings outside the given prefixes alone', () => {
    const s = fresh();
    s.update({ 'rules.decks': 1, 'display.name': 'Ada' });
    s.reset(['rules']);
    expect(s.get('rules.decks')).toBe(6);
    expect(s.get('display.name')).toBe('Ada');
  });

  it('matches a prefix that names one setting exactly', () => {
    const s = fresh();
    s.update({ paused: true, 'display.name': 'Ada' });
    s.reset(['paused']);
    expect(s.get('paused')).toBe(false);
    expect(s.get('display.name')).toBe('Ada');
  });
});

describe('groups', () => {
  it('drops the prefix and nothing else', () => {
    expect(fresh().group('display')).toEqual({ name: 'Player' });
  });

  it('is empty for a prefix no setting uses', () => {
    expect(fresh().group('nothing')).toEqual({});
  });
});

describe('settings changed in another tab', () => {
  it('are re-read, so the next save does not erase them', () => {
    const backend = new MemoryBackend();
    const storage = new Storage(backend);
    const watchers = [];
    storage.watch = (key, fn) => {
      watchers.push(fn);
      return () => {};
    };

    const settings = new Settings(schema, storage);
    expect(watchers).toHaveLength(1);
    settings.set('rules.decks', 8);

    // Another tab writes its own change over the same key, then the event fires.
    new Settings(schema, new Storage(backend)).set('mechanics.sound', true);
    watchers[0]();

    expect(settings.get('mechanics.sound')).toBe(true);
    settings.set('rules.decks', 6);
    expect(JSON.parse(backend.getItem('cj.settings'))['mechanics.sound']).toBe(true);
  });

  it('tell the listeners which keys changed', () => {
    const backend = new MemoryBackend();
    const storage = new Storage(backend);
    let watcher = null;
    storage.watch = (key, fn) => {
      watcher = fn;
      return () => {};
    };
    const settings = new Settings(schema, storage);
    const seen = [];
    settings.subscribe((key, value) => seen.push([key, value]));

    new Settings(schema, new Storage(backend)).set('mechanics.sound', true);
    watcher();

    expect(seen).toEqual([['mechanics.sound', true]]);
  });
});
