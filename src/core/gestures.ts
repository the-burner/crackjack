// The five gestures (four swipes and a double tap, each also a key) and the play each one makes.
// A mapping gives every gesture exactly one play, so it is always complete; the
// game's other gesture uses follow from it: the plays Hit and Double answer
// insurance yes and Stand and Split no, and while betting Stand's and Split's
// gestures move the highlight left and right and Surrender's places the bet.

import { normalKey } from './keys';

export const GESTURES = ['up', 'down', 'left', 'right', 'doubleTap'] as const;
export type Gesture = (typeof GESTURES)[number];

export const GESTURE_ACTIONS = ['hit', 'stand', 'double', 'split', 'surrender'] as const;
export type GestureAction = (typeof GESTURE_ACTIONS)[number];

export type GestureMap = Record<Gesture, GestureAction>;

export const GESTURE_LABELS: Record<Gesture, string> = {
  up: 'Swipe up',
  down: 'Swipe down',
  left: 'Swipe left',
  right: 'Swipe right',
  doubleTap: 'Double tap',
};

/** The key that makes each gesture, as KeyboardEvent.key names (see core/keys). */
export type KeyMap = Record<Gesture, string>;

/** The arrows swipe, / double taps. */
export const STANDARD_KEYS: KeyMap = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  doubleTap: '/',
};

/** The gesture a key press makes, or null; with Ctrl, Alt or ⌘ held it is a shortcut, not a gesture. */
export function gestureOfKey(
  { key, ctrlKey, altKey, metaKey }: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey'>,
  keys: KeyMap,
): Gesture | null {
  if (ctrlKey || altKey || metaKey) return null;
  return GESTURES.find(gesture => keys[gesture] === normalKey(key)) ?? null;
}

/** `keys` with `key` making `gesture`; the gesture it made before takes this one's old key. */
export function withKey(keys: KeyMap, gesture: Gesture, key: string): KeyMap {
  const holder = GESTURES.find(g => keys[g] === key);
  const next = { ...keys, [gesture]: key };
  if (holder && holder !== gesture) next[holder] = keys[gesture];
  return next;
}

/** Whether `value` gives every gesture a different key. */
export function isKeyMap(value: unknown): value is KeyMap {
  if (typeof value !== 'object' || value === null) return false;
  const keys = GESTURES.map(g => (value as Record<string, unknown>)[g]);
  return keys.every(key => typeof key === 'string' && key !== '') && new Set(keys).size === keys.length;
}

export const ACTION_LABELS: Record<GestureAction, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
};

/** Down Hit, left Stand, up Double, right Split, double tap Surrender. */
export const STANDARD: GestureMap = {
  down: 'hit',
  left: 'stand',
  up: 'double',
  right: 'split',
  doubleTap: 'surrender',
};

const CLOCKWISE: Record<Exclude<Gesture, 'doubleTap'>, Exclude<Gesture, 'doubleTap'>> = {
  up: 'right',
  right: 'down',
  down: 'left',
  left: 'up',
};

/** `map` with its swipes turned a quarter turn clockwise `turns` times (a double tap does not turn). */
export function rotated(map: GestureMap, turns: number): GestureMap {
  let out = { ...map };
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) {
    const next = { ...out };
    for (const [from, to] of Object.entries(CLOCKWISE) as [keyof typeof CLOCKWISE, keyof typeof CLOCKWISE][])
      next[to] = out[from];
    out = next;
  }
  return out;
}

/** A named pair of mappings: one for the device held upright, one on its side. Built-in ones cannot be deleted. */
export interface GestureConfig {
  id: string;
  name: string;
  portrait: GestureMap;
  landscape: GestureMap;
  builtIn?: boolean;
}

export const BUILT_IN_CONFIGS: readonly GestureConfig[] = [
  { id: 'standard', name: 'Standard', portrait: STANDARD, landscape: STANDARD, builtIn: true },
  {
    id: 'landscapeLeft',
    name: 'Landscape left',
    portrait: STANDARD,
    landscape: rotated(STANDARD, 3),
    builtIn: true,
  },
  {
    id: 'landscapeRight',
    name: 'Landscape right',
    portrait: STANDARD,
    landscape: rotated(STANDARD, 1),
    builtIn: true,
  },
];

/** `map` with `gesture` making `action`; the gesture that made it before takes this one's old play. */
export function withAction(map: GestureMap, gesture: Gesture, action: GestureAction): GestureMap {
  const holder = GESTURES.find(g => map[g] === action);
  const next = { ...map, [gesture]: action };
  if (holder && holder !== gesture) next[holder] = map[gesture];
  return next;
}

/** Whether `value` is a complete mapping: every gesture, each with a different play. */
export function isGestureMap(value: unknown): value is GestureMap {
  if (typeof value !== 'object' || value === null) return false;
  const plays = GESTURES.map(g => (value as Record<string, unknown>)[g]);
  return (
    plays.every(play => (GESTURE_ACTIONS as readonly unknown[]).includes(play)) && new Set(plays).size === plays.length
  );
}

/** A swipe shorter than this is a tap, not a gesture. */
export const MIN_SWIPE = 30;
/** How far from a diagonal a swipe may be and still count as one (and be ignored). */
const DIAGONAL_RATIO = 1.5;

/**
 * The swipe a drag makes, or null for a tap, a short drag or a diagonal.
 * @param dx  End x minus start x.
 * @param dy  End y minus start y (down is positive).
 */
export function swipeOf({ dx, dy, minDistance = MIN_SWIPE }: { dx: number; dy: number; minDistance?: number }) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.hypot(dx, dy) < minDistance) return null;
  if (ax < DIAGONAL_RATIO * ay && ay < DIAGONAL_RATIO * ax) return null;
  if (ax > ay) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
