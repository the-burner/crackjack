import { describe, it, expect } from 'vitest';
import { Storage, MemoryBackend } from '../../src/services/storage.js';
import { Settings } from '../../src/settings/store.js';

const schema = {
  'mechanics.sound': { type: 'bool', default: false },
  'rules.decks': { type: 'int', default: 6, min: 1, max: 8 },
  'rules.surrender': { type: 'enum', default: 'none', values: ['none', 'late', 'early'] },
  'betting.table': { type: 'json', default: [1, 2] },
};

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
});
