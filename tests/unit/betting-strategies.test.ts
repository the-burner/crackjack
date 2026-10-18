import { describe, it, expect } from 'vitest';
import {
  BETTING_PRESETS,
  BUILT_IN_BETTING,
  bettingPresets,
  bettingValues,
  readBettingStrategies,
} from '@/settings/betting-strategies';
import { presetState, sameValues } from '@/settings/named-configs';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';

const settings = () => new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
const values = () => {
  const s = settings();
  s.update({ 'game.betting.chipValue': 5, 'game.betting.wonging': true, 'game.betting.wongIn': 2 });
  return bettingValues(key => s.get(key));
};

describe('betting strategies', () => {
  it('hold the ramp, the chip value and the wonging settings, not the error warning', () => {
    expect(Object.keys(values()).sort()).toEqual([
      'game.betting.chipValue',
      'game.betting.ramp',
      'game.betting.wongIn',
      'game.betting.wongOut',
      'game.betting.wongStartOut',
      'game.betting.wonging',
    ]);
  });

  it("are built in as Crackjack's single- and multi-hand strategies, a fresh install on the multi-hand one", () => {
    const fresh = settings();
    expect(BUILT_IN_BETTING.map(s => s.name)).toEqual([
      "Crackjack's Single-Hand Strategy",
      "Crackjack's Multi-Hand Strategy",
    ]);
    const state = presetState(
      fresh.get('game.betting.strategy'),
      bettingValues(key => fresh.get(key)),
      BUILT_IN_BETTING,
      BETTING_PRESETS.valuesOf,
      sameValues,
    );
    expect(state).toEqual({ selected: BUILT_IN_BETTING[1], edited: false });
  });

  it('play two hands at the higher counts in the multi-hand one, and wong', () => {
    const multi = BUILT_IN_BETTING[1].values;
    expect(multi['game.betting.ramp'].rows.map(row => `${row.hands}x${row.chips}`)).toEqual([
      '1x1',
      '1x2',
      '2x2',
      '2x3',
      '2x6',
      '2x12',
    ]);
    expect(multi).toMatchObject({
      'game.betting.chipValue': 25,
      'game.betting.wonging': true,
      'game.betting.wongIn': 1,
      'game.betting.wongOut': -2,
      'game.betting.wongStartOut': false,
    });
  });

  it('write back as settings the strategy holds', () => {
    const preset = BETTING_PRESETS.make('a', 'Spread', values());
    expect(BETTING_PRESETS.patch(BETTING_PRESETS.valuesOf(preset))).toEqual(values());
  });

  it('load into Deck Estimation only the bets, chip value and Wong out it keeps', () => {
    const depth = bettingPresets('depth');
    const single = BUILT_IN_BETTING[0];
    expect(depth.selectedKey).toBe('drills.depth.betting.strategy');
    expect(depth.patch(depth.valuesOf(single))).toEqual({
      'drills.depth.betting.chipValue': 25,
      'drills.depth.betting.ramp': single.values['game.betting.ramp'],
      'drills.depth.betting.wonging': false,
      'drills.depth.betting.wongOut': -2,
    });
    const s = settings();
    expect(Object.keys(depth.current(key => s.get(key))).sort()).toEqual([
      'game.betting.chipValue',
      'game.betting.ramp',
      'game.betting.wongOut',
      'game.betting.wonging',
    ]);
  });

  it('saved from Deck Estimation, keep the rest of the strategy saved over', () => {
    const depth = bettingPresets('depth');
    const base = BETTING_PRESETS.make('a', 'Spread', values());
    const saved = depth.make('a', 'Spread', { 'game.betting.wongOut': -4 }, base);
    expect(saved.values).toEqual({ ...values(), 'game.betting.wongOut': -4 });
    // With nothing saved over, the rest is the shipped settings; Wong in stays above Wong out.
    const fresh = depth.make('b', 'Steep', { 'game.betting.wonging': true, 'game.betting.wongOut': 3 });
    expect(fresh.values).toMatchObject({ 'game.betting.wongStartOut': false, 'game.betting.wongIn': 4 });
    expect(readBettingStrategies([fresh])).toEqual([fresh]);
  });

  it('read back only well-formed ones', () => {
    const good = { id: 'a', name: 'A', values: values() };
    expect(readBettingStrategies([good, { id: 'b', name: 'B', values: { 'game.betting.ramp': 3 } }, 'x'])).toEqual([
      good,
    ]);
    expect(readBettingStrategies(undefined)).toEqual([]);
  });
});
