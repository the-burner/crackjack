// What the game keeps between visits: the bankroll and the statistics.

/** Fresh statistics for a session. */
export const emptyStats = () => ({
  rounds: 0,
  totalBet: 0,
  highBet: 0,
  lowBet: 0,
  highBankroll: 0,
  lowBankroll: 0,
  bankrollSum: 0,
  playDecisions: 0,
  playErrors: 0,
  betDecisions: 0,
  betErrors: 0,
  foulDecisions: 0,
  foulErrors: 0,
});
export type GameStats = ReturnType<typeof emptyStats>;

/** Saved statistics, with any missing or damaged figure at zero (older saves lack some). */
export function readStats(saved: unknown): GameStats {
  const stats = emptyStats();
  if (typeof saved !== 'object' || saved === null) return stats;
  for (const key of Object.keys(stats) as (keyof GameStats)[]) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) stats[key] = value;
  }
  return stats;
}

/** A saved bankroll, or null when there is none (the table then starts afresh). */
export const readBankroll = (saved: unknown): number | null =>
  typeof saved === 'number' && Number.isFinite(saved) ? saved : null;
