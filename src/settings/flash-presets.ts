// Crackjack's built-in Flash Cards configurations. A fresh install drills the Infinite Round Robin,
// so the settings schema's defaults are its settings (settings/schema.ts).

import type { PresetSpec } from './game-presets';

export const FLASH_PRESETS: readonly PresetSpec[] = [
  {
    id: 'round-robin-2.5-minute',
    name: "Crackjack's Round Robin 2.5-Minute Intervals",
    changes: { 'drills.flash.autoPause': true, 'drills.flash.autoPauseSeconds': 150 },
  },
  {
    id: 'round-robin-3.5-minute',
    name: "Crackjack's Round Robin 3.5-Minute Intervals",
    changes: { 'drills.flash.autoPause': true, 'drills.flash.autoPauseSeconds': 210 },
  },
  { id: 'infinite-round-robin', name: "Crackjack's Infinite Round Robin", changes: {} },
];
