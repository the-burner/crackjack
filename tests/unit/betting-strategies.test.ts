import { describe, it, expect } from 'vitest';
import { BETTING_PRESETS, BUILT_IN_BETTING, bettingValues, readBettingStrategies } from '@/settings/betting-strategies';
import { presetState, sameValues } from '@/settings/named-configs';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { Storage, MemoryBackend } from '@/services/storage';

const settings = () => new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
const values = () => {
  const s = settings();
  s.update({ 'betting.chipValue': 5, 'betting.wonging': true, 'betting.wongIn': 2 });
  return bettingValues(key => s.get(key));
};

describe('betting strategies', () => {
  it('hold the ramp, the chip value and the wonging settings, not the error warning', () => {
    expect(Object.keys(values()).sort()).toEqual([
      'betting.chipValue',
      'betting.ramp',
      'betting.wongIn',
      'betting.wongOut',
      'betting.wongStartOut',
      'betting.wonging',
    ]);
  });

  it("are built in as Crackjack's single- and multi-hand strategies, a fresh install on the single-hand one", () => {
    const fresh = settings();
    expect(BUILT_IN_BETTING.map(s => s.name)).toEqual([
      "Crackjack's Single-Hand Strategy",
      "Crackjack's Multi-Hand Strategy",
    ]);
    const state = presetState(
      fresh.get('betting.strategy'),
      bettingValues(key => fresh.get(key)),
      BUILT_IN_BETTING,
      BETTING_PRESETS.valuesOf,
      sameValues,
    );
    expect(state).toEqual({ selected: BUILT_IN_BETTING[0], edited: false });
  });

  it('play two hands at the higher counts in the multi-hand one, and wong', () => {
    const multi = BUILT_IN_BETTING[1].values;
    expect(multi['betting.ramp'].rows.map(row => `${row.hands}x${row.chips}`)).toEqual([
      '1x1',
      '1x2',
      '2x2',
      '2x3',
      '2x6',
      '2x12',
    ]);
    expect(multi).toMatchObject({
      'betting.chipValue': 25,
      'betting.wonging': true,
      'betting.wongIn': 1,
      'betting.wongOut': -2,
      'betting.wongStartOut': false,
    });
  });

  it('write back as settings the strategy holds', () => {
    const preset = BETTING_PRESETS.make('a', 'Spread', values());
    expect(BETTING_PRESETS.patch(BETTING_PRESETS.valuesOf(preset))).toEqual(values());
  });

  it('read back only well-formed ones', () => {
    const good = { id: 'a', name: 'A', values: values() };
    expect(readBettingStrategies([good, { id: 'b', name: 'B', values: { 'betting.ramp': 3 } }, 'x'])).toEqual([good]);
    expect(readBettingStrategies(undefined)).toEqual([]);
  });
});
