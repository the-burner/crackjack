import { describe, it, expect } from 'vitest';
import { copyOfFirst, sideLabels, sideSettings } from '@/settings/chart-sides';
import type { SideSettings } from '@/settings/chart-sides';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Settings } from '@/settings/store';
import { MemoryBackend, Storage } from '@/services/storage';

const settings = () => new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
const names = { strategy: (id: number) => (id === 30 ? 'High-Low' : 'Basic Strategy'), indexSet: (set: string) => set };
const HIGH_LOW: SideSettings = {
  system: 30,
  decks: 6,
  indexSet: 'crack33',
  rules: { 'rules.doubleAfterSplit': true, 'rules.dealerHitsSoft17': true, 'rules.noHoleCard': false },
};

describe("the Charts' two sides", () => {
  it('read each its own settings', () => {
    const s = settings();
    s.update({ 'charts.decks': 2, 'charts.compare.decks': 8, 'charts.compare.rules.noHoleCard': true });
    expect(sideSettings(key => s.get(key), 'charts')).toMatchObject({ decks: 2, rules: { 'rules.noHoleCard': false } });
    expect(sideSettings(key => s.get(key), 'compare')).toMatchObject({ decks: 8, rules: { 'rules.noHoleCard': true } });
  });

  it('start the compared side as a copy of the first', () => {
    const s = settings();
    s.update({ 'charts.strategy.system': 5, 'charts.decks': 2, 'charts.rules.dealerHitsSoft17': false });
    s.update(copyOfFirst(key => s.get(key)));
    expect(sideSettings(key => s.get(key), 'compare')).toEqual(sideSettings(key => s.get(key), 'charts'));
  });

  it('name each side by its strategy and what it is built for that the other is not', () => {
    expect(sideLabels(HIGH_LOW, HIGH_LOW, names)).toEqual(['High-Low', 'High-Low']);
    const twoDecks = { ...HIGH_LOW, decks: 2, rules: { ...HIGH_LOW.rules, 'rules.dealerHitsSoft17': false } };
    expect(sideLabels(HIGH_LOW, twoDecks, names)).toEqual([
      'High-Low · 6 decks · Hit soft 17',
      'High-Low · 2 decks · Stand soft 17',
    ]);
    const basic = { ...HIGH_LOW, system: 5, decks: 1, indexSet: 'none' as const };
    expect(sideLabels(HIGH_LOW, basic, names)).toEqual([
      'High-Low · 6 decks · crack33',
      'Basic Strategy · 1 deck · none',
    ]);
  });
});
