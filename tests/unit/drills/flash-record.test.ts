import { describe, it, expect } from 'vitest';
import { accuracy, addResult, emptyRecord, readRecord, RECENT_HANDS } from '@/drills/flash/record';

describe('flash record', () => {
  it('counts every hand, keeps only the latest results, and works out each accuracy', () => {
    let record = emptyRecord();
    expect(accuracy(record)).toBeNull();
    for (let i = 0; i < RECENT_HANDS + 100; i++) record = addResult(record, i >= 100 && i % 10 !== 0);
    expect(record.hands).toBe(1100);
    expect(record.correct).toBe(900);
    expect(record.recent).toHaveLength(RECENT_HANDS);
    expect(accuracy(record)).toBe(81);
    expect(accuracy(record, 1000)).toBe(90);
    expect(accuracy(record, 100)).toBe(90);
    expect(accuracy(addResult(emptyRecord(), true), 100)).toBeNull();
  });

  it('reads damaged saves as empty', () => {
    expect(readRecord({ hands: -1, correct: 5, recent: 'x1' })).toEqual(emptyRecord());
    expect(readRecord({ hands: 3, correct: 9, recent: '101' })).toEqual({ hands: 3, correct: 3, recent: '101' });
  });
});
