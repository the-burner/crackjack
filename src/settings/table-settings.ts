// The table's rules and conditions: what the player does not control, as Table Rules and Conditions shows it.

import { SETTINGS_SCHEMA } from './schema';
import type { SettingKey } from './schema';

/** The player's own, though kept under `table.`. */
const PLAYERS: readonly SettingKey[] = ['table.startingBankroll', 'table.refreshBankrollOnStart'];

/** Kept under `display.`, but the casino's choice: whether the discards and the shoe can be seen. */
const HIDDEN_BY_THE_CASINO: readonly SettingKey[] = ['display.hideDiscardTray', 'display.hideShoe'];

/** Every setting of the table: its seats, shoe, rules, payouts and bonuses, and its unusual game. */
export const TABLE_SETTINGS: readonly SettingKey[] = (Object.keys(SETTINGS_SCHEMA) as SettingKey[]).filter(
  key => (/^(table|rules|bonuses)\./.test(key) && !PLAYERS.includes(key)) || HIDDEN_BY_THE_CASINO.includes(key),
);
