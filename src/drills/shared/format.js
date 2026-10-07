// Number formatting shared by the drills.

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/**
 * Formats a multiple of a quarter as a mixed number: 1.25 -> "1¼", 0.5 -> "½".
 * Zero becomes "0".
 */
export function mixedNumber(value) {
  const whole = Math.trunc(value);
  const fraction = Math.round((Math.abs(value) - Math.abs(whole)) * 100) / 100;
  const symbol = FRACTIONS[fraction] ?? '';
  if (!symbol) return String(whole);
  const sign = value < 0 ? '-' : '';
  return whole === 0 ? `${sign}${symbol}` : `${sign}${Math.abs(whole)}${symbol}`;
}

/** Formats whole seconds as hours:minutes:seconds, e.g. 65 -> "00:01:05". Never negative. */
export function clockTime(seconds) {
  const total = Math.max(0, Math.trunc(seconds));
  const pad = n => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/** Formats a signed count for display: "+3", "0", "-2". */
export const signedCount = value => (value > 0 ? `+${value}` : String(value));
