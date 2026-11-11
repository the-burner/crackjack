// Crackjack's built-in Blackjack configurations, each the settings a fresh install has with the
// changes that make it what it is. A fresh install plays the 6D table game, so the settings
// schema's defaults are its settings (settings/schema.ts).

import type { SettingsPatch } from './schema';
import { TABLE_PRESETS } from './table-presets';

export interface PresetSpec {
  id: string;
  name: string;
  /** Where it is played, for a casino's table ("Tacoma, WA"). */
  place?: string;
  /** What it changes from a fresh install's settings. */
  changes: SettingsPatch;
}

/** Two decks: Emerald Queen's Double Deck (the six-deck games are on Bally's Chicago table, the defaults). */
const DOUBLE_DECK: SettingsPatch = {
  ...TABLE_PRESETS.find(table => table.id === 'emerald-queen-2d')!.changes,
  'table.preset': 'emerald-queen-2d',
};

/** Alone with the dealer, and Crackjack's Single-Hand betting strategy, with no wonging. */
const HEADS_UP: SettingsPatch = {
  'table.seatCount': 1,
  'table.computerSeats': [false, false, false, false, false, false],
  'game.betting.ramp': { minCount: 0, rows: [1, 2, 4, 6, 12, 16].map(chips => ({ chips, hands: 1 })) },
  'game.betting.wonging': false,
  'game.betting.strategy': 'single-hand',
};

export const GAME_PRESETS: readonly PresetSpec[] = [
  { id: 'heads-up-6d', name: "Crackjack's Heads-Up 6D,H17,LS,DAS", changes: HEADS_UP },
  {
    id: 'heads-up-2d',
    name: "Crackjack's Heads-Up 2D,H17,LS,DAS",
    changes: { ...HEADS_UP, ...DOUBLE_DECK },
  },
  { id: 'table-2d', name: "Crackjack's 2D,H17,LS,DAS", changes: DOUBLE_DECK },
  { id: 'table-6d', name: "Crackjack's 6D,H17,LS,DAS", changes: {} },
];
