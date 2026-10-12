// The gesture configurations the player saved, beside the built-in ones: what
// is read back from storage, and how the preset picker reads and writes them.

import { BUILT_IN_CONFIGS, isGestureMap } from '@/core/gestures';
import type { GestureConfig, GestureMap } from '@/core/gestures';
import type { SettingReader } from './schema';
import type { PresetKind } from './named-configs';

/** The saved configurations in `saved`, dropping any that are malformed. */
export function readGestureConfigs(saved: unknown): GestureConfig[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((entry: unknown): GestureConfig[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { id, name, portrait, landscape } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string' || !isGestureMap(portrait) || !isGestureMap(landscape))
      return [];
    return [{ id, name, portrait, landscape }];
  });
}

/** Gesture configurations, for the preset picker. */
export const GESTURE_PRESETS: PresetKind<GestureConfig, Pick<GestureConfig, 'portrait' | 'landscape'>> = {
  label: 'Configuration',
  builtIns: BUILT_IN_CONFIGS,
  selectedKey: 'gestures.config',
  current: get => ({ portrait: get('gestures.portrait'), landscape: get('gestures.landscape') }),
  valuesOf: ({ portrait, landscape }) => ({ portrait, landscape }),
  patch: ({ portrait, landscape }) => ({ 'gestures.portrait': portrait, 'gestures.landscape': landscape }),
  make: (id, name, { portrait, landscape }) => ({ id, name, portrait, landscape }),
};

/** The mapping in use: the portrait or the landscape one, by how the screen is held. */
export const gestureMapFor = (get: SettingReader, portrait: boolean): GestureMap =>
  get(portrait ? 'gestures.portrait' : 'gestures.landscape');
