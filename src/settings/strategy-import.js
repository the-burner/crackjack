// Importing a playing strategy exported by Casino Verite Blackjack on a PC.
// The user types the code the PC program showed; the app downloads
// /Apps/z<code>.php from qfit.com and stores the strategy file it returns.

import { parseStrategyFile } from '../core/strategy/strategy-file.js';

/** The download URL for an export code, relative to the site root. */
export const strategyCodeUrl = code => `/Apps/z${encodeURIComponent(String(code).trim().toLowerCase())}.php`;

/** The server escapes spaces in strategy names. */
export const normalizeImportedText = text => String(text).replaceAll('%20', ' ');

/**
 * True when `text` really is a strategy file: "|<name>|<encoded tables>" that
 * parses into card values and a deck count. Checked so that a server error
 * page is never stored as an unusable "strategy".
 */
export function isStrategyFileText(text) {
  if (typeof text !== 'string' || !text.startsWith('|')) return false;
  const nameEnd = text.indexOf('|', 1);
  if (nameEnd < 2) return false;
  try {
    const file = parseStrategyFile(text);
    return file.name.length > 0
      && file.decks >= 0 && file.decks <= 8
      && file.countValues.slice(1, 11).every(Number.isFinite)
      && file.initialRunningCount.length === 8 && file.initialRunningCount.every(Number.isFinite)
      && file.insuranceByDecks.slice(1).every(Number.isFinite)
      && file.groups.every(row => row.every(Number.isFinite));
  } catch {
    return false;
  }
}
