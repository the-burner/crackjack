// Crackjack's built-in Blackjack configurations, each the settings a fresh install has with the
// changes that make it what it is. A fresh install plays the 6D table game, so the settings
// schema's defaults are its settings (settings/schema.ts).

import type { SettingsPatch } from './schema';
import { DOUBLE_DECK as DOUBLE_DECK_TABLE } from './table-presets';

export interface PresetSpec {
  id: string;
  name: string;
  /** Where it is played, for a casino's table ("Tacoma, WA"). */
  place?: string;
  /** What it changes from a fresh install's settings. */
  changes: SettingsPatch;
}

/** Two decks, on Crackjack's two-deck table. */
const DOUBLE_DECK: SettingsPatch = { ...DOUBLE_DECK_TABLE, 'table.preset': 'crackjack-2d' };

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
  // Heads up, the double deck is dealt face up.
  {
    id: 'heads-up-2d',
    name: "Crackjack's Heads-Up 2D,H17,LS,DAS",
    changes: { ...HEADS_UP, ...DOUBLE_DECK, 'table.cardsFaceDown': false, 'table.preset': 'crackjack-2d-face-up' },
  },
  { id: 'table-2d', name: "Crackjack's 2D,H17,LS,DAS", changes: DOUBLE_DECK },
  { id: 'table-6d', name: "Crackjack's 6D,H17,LS,DAS", changes: {} },
];
