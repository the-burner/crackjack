// The built-in tables: the casino games bundled from Current Blackjack News (data/casino-tables.ts).

import { CASINO_TABLES } from '@/data/casino-tables';
import { cbjnTable } from './cbjn';
import type { PresetSpec } from './game-presets';

export const TABLE_PRESETS: readonly PresetSpec[] = CASINO_TABLES.map(({ id, name, place, ...game }) => ({
  id,
  name,
  place,
  changes: cbjnTable(game).values,
}));
