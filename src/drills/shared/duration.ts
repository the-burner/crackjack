// Durations split into hours, minutes and seconds (or seconds and tenths), for
// the duration picker.

/** One part of a duration: `size` is its unit in the smallest part's units; `count` its values. */
export type DurationColumn = { unit: string; label: string; size: number; count: number };

/**
 * The parts needed for durations up to `max` seconds, largest first: hours only
 * when `max` reaches two hours, minutes only when it reaches two minutes. The
 * largest part runs to the most `max` allows; the others wrap at 59.
 */
export function durationColumns(max: number): DurationColumn[] {
  const columns: Omit<DurationColumn, 'count'>[] = [];
  // A part earns its place only once two of its units fit: with one, the parts
  // below it would run past `max` (a 60 s limit offering 1:59).
  if (max >= 7200) columns.push({ unit: 'h', label: 'Hours', size: 3600 });
  if (max >= 120) columns.push({ unit: 'min', label: 'Minutes', size: 60 });
  columns.push({ unit: 's', label: 'Seconds', size: 1 });
  return columns.map((c, i) => ({ ...c, count: i === 0 ? Math.floor(max / c.size) + 1 : 60 }));
}

/** The parts of a value in tenths of a second, up to `max` tenths: seconds and tenths. */
export function tenthsColumns(max: number): DurationColumn[] {
  return [
    { unit: '.', label: 'Seconds', size: 10, count: Math.floor(max / 10) + 1 },
    { unit: 's', label: 'Tenths', size: 1, count: 10 },
  ];
}

/** A value (in the smallest part's units) as one number per part. */
export function splitDuration(seconds: number, columns: readonly DurationColumn[]): number[] {
  let rest = Math.max(0, Math.round(seconds));
  return columns.map((c, i) => {
    const n = i === 0 ? Math.floor(rest / c.size) : Math.floor(rest / c.size) % c.count;
    rest -= n * c.size;
    return Math.min(n, c.count - 1);
  });
}

/** Part values back to seconds, kept within [min, max]. */
export function joinDuration(
  values: readonly number[],
  columns: readonly DurationColumn[],
  { min = 0, max = Infinity }: { min?: number; max?: number } = {},
): number {
  const total = values.reduce((sum, n, i) => sum + n * columns[i].size, 0);
  return Math.min(max, Math.max(min, total));
}
