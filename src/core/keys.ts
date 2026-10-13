// Keys as KeyboardEvent.key names: one for a letter whichever case, and a name to show.

/** `key` as kept: a letter in lower case, any other key as named. */
export const normalKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

const NAMES: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ' ': 'Space' };

/** How `key` is shown: an arrow, a capital letter, or the key's name. */
export const keyLabel = (key: string): string => NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);

/** Keys held for others, which are never keys of their own. */
export const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);
