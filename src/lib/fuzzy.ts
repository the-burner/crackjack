// Fuzzy matching of names as the player types: each word typed must appear in the text in order, letters
// may be skipped ("bel6d" finds "Bellagio 6D"), and case and punctuation are ignored.

const CONSECUTIVE = 5;
const WORD_START = 3;

const isWordChar = (c: string) => /[a-z0-9]/.test(c);

/** Where a word starts in `text`: after a space or punctuation, or between letters and digits. */
const startsWord = (text: string, i: number) =>
  i === 0 || !isWordChar(text[i - 1]) || /\d/.test(text[i - 1]) !== /\d/.test(text[i]);

/** The best score of `word` as a subsequence of `text` (both lower case), or null when it is not one. */
function wordScore(word: string, text: string): number | null {
  let best: number | null = null;
  // Each place the first letter appears may start the best match.
  for (let start = text.indexOf(word[0]); start >= 0; start = text.indexOf(word[0], start + 1)) {
    let score = 0;
    let last = start - 1;
    let found = true;
    for (const c of word) {
      const at = text.indexOf(c, last + 1);
      if (at < 0) {
        found = false;
        break;
      }
      score += 1 + (at === last + 1 ? CONSECUTIVE : 0) + (startsWord(text, at) ? WORD_START : 0);
      last = at;
    }
    if (found && (best === null || score > best)) best = score;
  }
  return best;
}

/** How well `query` matches `text`, higher is better; null when it does not. An empty query matches everything at 0. */
export function fuzzyScore(query: string, text: string): number | null {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map(word => [...word].filter(isWordChar).join(''))
    .filter(Boolean);
  const lower = text.toLowerCase();
  let total = 0;
  for (const word of words) {
    const score = wordScore(word, lower);
    if (score === null) return null;
    total += score;
  }
  return total;
}

/** The items whose text matches `query`, best first; ties, and an empty query, keep their order. */
export function fuzzyFilter<T>(items: readonly T[], query: string, textOf: (item: T) => string): T[] {
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, textOf(item)) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
}
