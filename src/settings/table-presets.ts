// The built-in tables: Crackjack's own (one for each of its Blackjack configurations) and the casino games
// bundled from Current Blackjack News (data/casino-tables.ts).

import { CASINO_TABLES } from '@/data/casino-tables';
import { cbjnTable } from './cbjn';
import type { PresetSpec } from './game-presets';
import type { SettingsPatch } from './schema';

/** Two decks: 42 cards behind the cut card (0.8 of a deck), dealt face down as a pitch game is. */
export const DOUBLE_DECK: SettingsPatch = {
  'table.decks': 2,
  'table.cardsBehindCutCard': 42,
  'table.cardsFaceDown': true,
};

/** What a fresh install plays: the settings' defaults. */
export const DEFAULT_TABLE = 'crackjack-6d';

export const TABLE_PRESETS: readonly PresetSpec[] = [
  { id: DEFAULT_TABLE, name: "Crackjack's 6D,H17,LS,DAS", changes: {} },
  { id: 'crackjack-2d', name: "Crackjack's 2D,H17,LS,DAS", changes: DOUBLE_DECK },
  // Heads up, the double deck is dealt face up.
  {
    id: 'crackjack-2d-face-up',
    name: "Crackjack's 2D,H17,LS,DAS Face Up",
    changes: { ...DOUBLE_DECK, 'table.cardsFaceDown': false },
  },
  ...CASINO_TABLES.map(({ id, name, place, ...game }) => ({ id, name, place, changes: cbjnTable(game).values })),
];
