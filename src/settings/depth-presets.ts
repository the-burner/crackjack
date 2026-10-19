// Crackjack's built-in Deck Estimation and TC Conversion configurations: Decks Left and TC Bet & Decks, each
// for six decks and for two. A fresh install drills the six-deck Decks Left, so the settings schema's
// defaults are its settings (settings/schema.ts).

import type { PresetSpec } from './game-presets';

const DOUBLE_DECK = { 'drills.depth.decks': 2 } as const;
const BET_AND_DECKS = { 'drills.depth.drill': 'betAndDecks' } as const;

export const DEPTH_PRESETS: readonly PresetSpec[] = [
  { id: 'decks-left-6d', name: "Crackjack's Decks Left 6D", changes: {} },
  { id: 'decks-left-2d', name: "Crackjack's Decks Left 2D", changes: DOUBLE_DECK },
  { id: 'bet-and-decks-6d', name: "Crackjack's TC Bet & Decks 6D", changes: BET_AND_DECKS },
  { id: 'bet-and-decks-2d', name: "Crackjack's TC Bet & Decks 2D", changes: { ...BET_AND_DECKS, ...DOUBLE_DECK } },
];
