// Crackjack's built-in Simple Running Count configurations: Infinite, a test about every 36 cards, pausing
// every interval. A fresh install drills the Running Count 3-Minute Intervals, so the settings schema's
// defaults are its settings (settings/schema.ts).

import type { PresetSpec } from './game-presets';

const FOUR_MINUTES = { 'drills.count.autoPauseSeconds': 225 } as const;
const TRUE_COUNT = { 'drills.count.drill': 'trueCount' } as const;

export const COUNT_PRESETS: readonly PresetSpec[] = [
  { id: 'running-count-3-minute', name: "Crackjack's Running Count 3-Minute Intervals", changes: {} },
  { id: 'running-count-4-minute', name: "Crackjack's Running Count 4-Minute Intervals", changes: FOUR_MINUTES },
  { id: 'true-count-3-minute', name: "Crackjack's True Count 3-Minute Intervals", changes: TRUE_COUNT },
  {
    id: 'true-count-4-minute',
    name: "Crackjack's True Count 4-Minute Intervals",
    changes: { ...TRUE_COUNT, ...FOUR_MINUTES },
  },
];
