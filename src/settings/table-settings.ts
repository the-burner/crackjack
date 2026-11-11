// The table's rules: what the player does not control, as Table Rules shows it.

import { SETTINGS_SCHEMA } from './schema';
import type { SettingKey } from './schema';

/** Kept under `table.` but on other screens: the player's bankroll, and the seats and players at the table (Seats). */
const PLAYERS: readonly SettingKey[] = [
  'table.startingBankroll',
  'table.refreshBankrollOnStart',
  'table.seatCount',
  'table.computerSeats',
  'table.playersComeAndGo',
  // Which table is chosen, not part of one.
  'table.preset',
];

/** Kept under `display.`, but the casino's choice: whether the discards and the shoe can be seen. */
const HIDDEN_BY_THE_CASINO: readonly SettingKey[] = ['display.hideDiscardTray', 'display.hideShoe'];

/** Every setting of the table: its limits, shoe, rules, payouts and bonuses, and its unusual game. */
export const TABLE_SETTINGS: readonly SettingKey[] = (Object.keys(SETTINGS_SCHEMA) as SettingKey[]).filter(
  key => (/^(table|rules|bonuses)\./.test(key) && !PLAYERS.includes(key)) || HIDDEN_BY_THE_CASINO.includes(key),
);
