import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_CONFIGS,
  GESTURE_ACTIONS,
  GESTURES,
  MIN_SWIPE,
  STANDARD,
  configFor,
  isGestureMap,
  rotated,
  swipeOf,
  withAction,
} from '@/core/gestures';
import { allConfigs, deleteConfig, gestureMapFor, readGestureConfigs, saveConfig } from '@/settings/gesture-configs';

describe('reading a swipe', () => {
  it('reads the four straight swipes', () => {
    expect(swipeOf({ dx: 0, dy: 60 })).toBe('down');
    expect(swipeOf({ dx: -60, dy: 0 })).toBe('left');
    expect(swipeOf({ dx: 0, dy: -60 })).toBe('up');
    expect(swipeOf({ dx: 60, dy: 0 })).toBe('right');
  });

  it('ignores diagonals and taps, measuring the real distance', () => {
    expect(swipeOf({ dx: 50, dy: 50 })).toBe(null);
    expect(swipeOf({ dx: -50, dy: 60 })).toBe(null);
    expect(swipeOf({ dx: 4, dy: 4 })).toBe(null);
    expect(swipeOf({ dx: 0, dy: MIN_SWIPE + 1 })).toBe('down');
    expect(swipeOf({ dx: 25, dy: 0 })).toBe(null);
    expect(swipeOf({ dx: 12, dy: 0, minDistance: 10 })).toBe('right');
  });
});

describe('a gesture mapping', () => {
  it('starts as Standard: down Hit, left Stand, up Double, right Split, double tap Surrender', () => {
    expect(STANDARD).toEqual({ down: 'hit', left: 'stand', up: 'double', right: 'split', doubleTap: 'surrender' });
  });

  it('swaps plays, so every gesture always makes a different one', () => {
    const map = withAction(STANDARD, 'up', 'hit');
    expect(map.up).toBe('hit');
    expect(map.down).toBe('double');
    expect(isGestureMap(map)).toBe(true);
    expect(withAction(STANDARD, 'up', 'double')).toEqual(STANDARD);
  });

  it('turns the swipes a quarter at a time, never the double tap', () => {
    expect(rotated(STANDARD, 1)).toEqual({
      left: 'hit',
      up: 'stand',
      right: 'double',
      down: 'split',
      doubleTap: 'surrender',
    });
    expect(rotated(STANDARD, 4)).toEqual(STANDARD);
    expect(rotated(rotated(STANDARD, 1), 3)).toEqual(STANDARD);
  });

  it('offers three built-in configurations: Standard upright, and Standard or turned on its side', () => {
    expect(BUILT_IN_CONFIGS.map(c => c.name)).toEqual(['Standard', 'Landscape left', 'Landscape right']);
    for (const config of BUILT_IN_CONFIGS) {
      expect(config.portrait).toEqual(STANDARD);
      expect(isGestureMap(config.landscape)).toBe(true);
    }
    expect(new Set(BUILT_IN_CONFIGS.map(c => JSON.stringify(c.landscape))).size).toBe(3);
  });

  it('accepts only a complete mapping with five different plays', () => {
    expect(isGestureMap({ ...STANDARD, up: 'hit' })).toBe(false);
    expect(isGestureMap({ up: 'hit' })).toBe(false);
    expect(isGestureMap(null)).toBe(false);
    expect(GESTURES.length).toBe(GESTURE_ACTIONS.length);
  });

  it('names the configuration a pair of mappings is, or none', () => {
    expect(configFor(STANDARD, rotated(STANDARD, 1), BUILT_IN_CONFIGS)?.name).toBe('Landscape right');
    expect(configFor(rotated(STANDARD, 1), STANDARD, BUILT_IN_CONFIGS)).toBe(null);
  });

  it('uses the portrait or the landscape mapping by how the screen is held', () => {
    const side = rotated(STANDARD, 1);
    const get = ((key: string) => (key === 'gestures.portrait' ? STANDARD : side)) as Parameters<
      typeof gestureMapFor
    >[0];
    expect(gestureMapFor(get, true)).toEqual(STANDARD);
    expect(gestureMapFor(get, false)).toEqual(side);
  });
});

describe('saved configurations', () => {
  const map = withAction(STANDARD, 'up', 'hit');
  const both = { portrait: map, landscape: rotated(STANDARD, 1) };

  it('saves both orientations as a new one, and replaces one of the same name', () => {
    const first = saveConfig([], 'Ring', both);
    expect(first.configs).toHaveLength(1);
    expect(first.configs?.[0]).toMatchObject({ name: 'Ring', ...both });
    const again = saveConfig(first.configs ?? [], ' ring ', { portrait: STANDARD, landscape: STANDARD });
    expect(again.configs).toHaveLength(1);
    expect(again.configs?.[0].landscape).toEqual(STANDARD);
    expect(allConfigs(again.configs ?? [])).toHaveLength(4);
  });

  it('refuses no name and a built-in name', () => {
    expect(saveConfig([], '  ', both).configs).toBe(null);
    expect(saveConfig([], 'standard', both).configs).toBe(null);
  });

  it('deletes one', () => {
    const { configs } = saveConfig([], 'Ring', both);
    expect(deleteConfig(configs ?? [], configs?.[0].id ?? '')).toEqual([]);
  });

  it('reads back only well-formed configurations', () => {
    expect(
      readGestureConfigs([
        { id: 'a', name: 'A', ...both },
        { id: 'b', name: 'B', portrait: map, landscape: { up: 'hit' } },
        { id: 'c', name: 'C', map },
        'x',
      ]),
    ).toEqual([{ id: 'a', name: 'A', ...both }]);
    expect(readGestureConfigs(undefined)).toEqual([]);
  });
});
