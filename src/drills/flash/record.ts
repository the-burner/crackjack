// Flash Cards' record across runs: every hand answered, how many were right, and the latest results.

/** `recent` holds the latest results, oldest first: '1' right, '0' wrong. */
export type FlashRecord = { hands: number; correct: number; recent: string };

export const RECENT_HANDS = 1000;

export const emptyRecord = (): FlashRecord => ({ hands: 0, correct: 0, recent: '' });

export function readRecord(saved: unknown): FlashRecord {
  const s = (typeof saved === 'object' && saved !== null ? saved : {}) as Record<string, unknown>;
  const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
  const hands = count(s.hands);
  const recent = typeof s.recent === 'string' && /^[01]*$/.test(s.recent) ? s.recent.slice(-RECENT_HANDS) : '';
  return { hands, correct: Math.min(count(s.correct), hands), recent };
}

export function addResult(record: FlashRecord, right: boolean): FlashRecord {
  return {
    hands: record.hands + 1,
    correct: record.correct + (right ? 1 : 0),
    recent: (record.recent + (right ? '1' : '0')).slice(-RECENT_HANDS),
  };
}

/** The share right of the last `last` hands (all of them without), rounded down as a run's is; null until there are that many. */
export function accuracy(record: FlashRecord, last?: number): number | null {
  if (last === undefined) return record.hands > 0 ? Math.floor((100 * record.correct) / record.hands) : null;
  if (record.recent.length < last) return null;
  const right = record.recent.slice(-last).split('1').length - 1;
  return Math.floor((100 * right) / last);
}
