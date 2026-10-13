import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_CONFIGS,
  GESTURE_ACTIONS,
  GESTURES,
  MIN_SWIPE,
  STANDARD,
  STANDARD_KEYS,
  gestureOfKey,
  isGestureMap,
  isKeyMap,
  rotated,
  swipeOf,
  withAction,
  withKey,
} from '@/core/gestures';
import { GESTURE_PRESETS, gestureMapFor, readGestureConfigs } from '@/settings/gesture-configs';

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

  it('read and write both orientations as one preset', () => {
    const preset = GESTURE_PRESETS.make('a', 'Ring', both);
    expect(preset).toEqual({ id: 'a', name: 'Ring', ...both });
    expect(GESTURE_PRESETS.valuesOf(preset)).toEqual(both);
    expect(GESTURE_PRESETS.patch(both)).toEqual({ 'gestures.portrait': map, 'gestures.landscape': both.landscape });
    expect(GESTURE_PRESETS.builtIns).toBe(BUILT_IN_CONFIGS);
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

describe('the keys', () => {
  const press = (
    key: string,
    held: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey', boolean>> = {},
    keys = STANDARD_KEYS,
  ) => gestureOfKey({ key, ctrlKey: false, altKey: false, metaKey: false, ...held }, keys);

  it('make the swipes with the arrows and the double tap with /, to begin with', () => {
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '/'].map(key => press(key))).toEqual([
      'up',
      'down',
      'left',
      'right',
      'doubleTap',
    ]);
  });

  it('make nothing else, nor with Ctrl, Alt or ⌘ held', () => {
    expect(press('Enter')).toBeNull();
    expect(press('x')).toBeNull();
    expect(press('/', { metaKey: true })).toBeNull();
    expect(press('ArrowLeft', { ctrlKey: true })).toBeNull();
    expect(press('ArrowLeft', { altKey: true })).toBeNull();
  });

  it('follow the keys chosen; a key another gesture had swaps the two', () => {
    const keys = withKey(STANDARD_KEYS, 'doubleTap', 'ArrowUp');
    expect(keys).toEqual({ ...STANDARD_KEYS, doubleTap: 'ArrowUp', up: '/' });
    expect(press('ArrowUp', {}, keys)).toBe('doubleTap');
    expect(press('/', {}, keys)).toBe('up');
    // A letter whichever case.
    expect(press('K', {}, withKey(STANDARD_KEYS, 'doubleTap', 'k'))).toBe('doubleTap');
    expect(press('PageDown', {}, withKey(STANDARD_KEYS, 'down', 'PageDown'))).toBe('down');
  });

  it('are a key map only with a different key for every gesture', () => {
    expect(isKeyMap(STANDARD_KEYS)).toBe(true);
    expect(isKeyMap({ ...STANDARD_KEYS, up: '/' })).toBe(false);
    expect(isKeyMap({ ...STANDARD_KEYS, up: '' })).toBe(false);
    expect(isKeyMap({ ...STANDARD_KEYS, up: 3 })).toBe(false);
  });
});
