// The strategies the player can pick, in display order. Kept apart from the library that builds
// them, as the settings schema names them and the library reads the settings.

/** A strategy the player can pick. */
export interface StrategyEntry {
  id: number;
  name: string;
}

/** Built-in strategies in display order. The first is the default (see settings/schema.ts). */
export const BUILTIN_STRATEGIES = [
  [30, 'High-Low'],
  [5, 'Basic Strategy'],
  [31, 'Complete High-Low'],
  [32, 'Halves'],
  [73, 'KO Rookie'],
  [74, 'KO Preferred'],
  [75, 'KO Full 1-2 Decks'],
  [76, 'KO Full 6 Decks'],
  [77, 'KO Full 8 Decks'],
  [6, 'Basic Omega II'],
  [7, 'Advanced Omega II'],
  [80, 'Red7, 1&2 Deck'],
  [81, 'Red7, Shoes'],
  [2, 'Basic Zen Count'],
  [3, 'Complete Zen Count'],
  [92, 'Double Exposure'],
  [82, 'Hi-Lo Lite'],
  [83, '1998 Zen Count'],
  [20, 'Hi-Opt I Count'],
  [22, 'Hi-Opt II Count'],
  [96, 'REKO'],
  [24, 'REKO-F Single-Deck'],
  [25, 'REKO-F Double-Deck'],
  [26, 'REKO-F Six-Deck'],
  [27, 'REKO-F Eight-Deck'],
  [97, 'REKO-T'],
  [28, 'FELT'],
  [29, 'FELT-F'],
  [50, 'KISS Stage I'],
  [51, 'KISS Stage II'],
  [52, 'KISS Stage III'],
  [90, 'Spanish 21'],
  [91, 'Super Fun 21'],
  [40, 'Expert Count'],
  [70, 'Silver Fox Single Deck'],
  [71, 'Silver Fox Multiple Deck'],
  [60, 'UBZ11 Composite'],
  [61, 'UBZ11 Single Deck'],
  [42, 'Blackjack Apprenticeship'],
].map(([id, name]): StrategyEntry => ({ id: Number(id), name: String(name) }));

/** The built-in hole-carding strategy offered on the Peeking screen. */
export const HOLE_CARD_STRATEGY: StrategyEntry = { id: 99, name: 'Hole-Carding' };
