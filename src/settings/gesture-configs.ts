// The gesture configurations the player saved, beside the built-in ones: what
// is read back from storage, and saving and deleting one.

import { BUILT_IN_CONFIGS, isGestureMap } from '@/core/gestures';
import type { GestureConfig, GestureMap } from '@/core/gestures';
import type { SettingReader } from './schema';

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

/** Every configuration on offer: the built-in ones, then the saved ones. */
export const allConfigs = (saved: readonly GestureConfig[]): GestureConfig[] => [...BUILT_IN_CONFIGS, ...saved];

/**
 * `saved` with both mappings saved as `name`: a new configuration, or the one
 * of that name (ignoring case) replaced. A built-in name cannot be taken.
 * @returns the configurations, and the one saved; null configs when the name is unusable.
 */
export function saveConfig(
  saved: readonly GestureConfig[],
  name: string,
  { portrait, landscape }: { portrait: GestureMap; landscape: GestureMap },
): { configs: GestureConfig[]; saved: GestureConfig } | { configs: null; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { configs: null, error: 'A configuration needs a name.' };
  const same = (config: GestureConfig) => config.name.toLowerCase() === trimmed.toLowerCase();
  if (BUILT_IN_CONFIGS.some(same)) return { configs: null, error: `“${trimmed}” is a built-in configuration.` };
  const existing = saved.find(same);
  const config: GestureConfig = { id: existing?.id ?? `saved-${Date.now()}`, name: trimmed, portrait, landscape };
  return {
    configs: existing ? saved.map(c => (c === existing ? config : c)) : [...saved, config],
    saved: config,
  };
}

export const deleteConfig = (saved: readonly GestureConfig[], id: string): GestureConfig[] =>
  saved.filter(config => config.id !== id);

/** The mapping in use: the portrait or the landscape one, by how the screen is held. */
export const gestureMapFor = (get: SettingReader, portrait: boolean): GestureMap =>
  get(portrait ? 'gestures.portrait' : 'gestures.landscape');
