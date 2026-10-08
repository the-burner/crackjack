// Screens are built from the component library (src/components/ui), so a
// control looks and behaves the same everywhere.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const SCREENS = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter(file => file.endsWith('.tsx') && !file.startsWith('components/ui/'))
  .map(file => `src/${file}`);

/** Raw controls a screen may keep: only ones no one sees. */
const ALLOWED = [/className="sr-only"/];

describe('screens', () => {
  it('use the library for every control, not raw elements', () => {
    const raw = SCREENS.flatMap(file =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => [line, i + 1] as const)
        .filter(([line]) => /<(button|select|input|label|textarea)\b/.test(line))
        .filter(([line]) => !ALLOWED.some(rule => rule.test(line)))
        .map(([line, n]) => `${file}:${n}: ${line.trim()}`),
    );
    expect(raw).toEqual([]);
  });

  it('give row labels no trailing colon', () => {
    const colons = SCREENS.flatMap(file =>
      [...readFileSync(file, 'utf8').matchAll(/\blabel="([^"]*:)"/g)].map(m => `${file}: ${m[1]}`),
    );
    expect(colons).toEqual([]);
  });
});
