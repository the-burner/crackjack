// Importing a playing strategy exported by Casino Verite Blackjack on a PC.
// The user types the code the PC program showed; the app downloads
// /Apps/z<code>.php from qfit.com and stores the strategy file it returns.

import { parseStrategyFile } from '../core/strategy/strategy-file.js';

/** The download URL for an export code. Site-root relative, as in the original. */
export const strategyCodeUrl = code => `/Apps/z${encodeURIComponent(String(code).trim().toLowerCase())}.php`;

/** The server escapes spaces in strategy names. */
export const normalizeImportedText = text => String(text).replaceAll('%20', ' ');

/**
 * True when `text` really is a strategy file: "|<name>|<encoded tables>" that
 * parses into card values and a deck count. The original stored whatever the
 * server returned, so a server error page became an unusable "strategy".
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
