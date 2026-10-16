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

describe('the chevron (arrow-r)', () => {
  /** Every use of it, each a control that opens another screen; a new one is added here once checked. */
  const OPENS_A_SCREEN: Record<string, number> = {
    'src/components/ui/settings-group.tsx': 1, // ListRow, unless chevron={false}
    'src/components/ui/card-button.tsx': 1, // the home screen's modules
    'src/screens/strategy/playing-strategy.tsx': 1, // Select indices
    'src/drills/flash/options.tsx': 1, // Select custom hands
    'src/game/table/bet-overlay.tsx': 2, // Side Bet, Customize
  };

  it('marks only what opens another screen', () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
      .filter(file => /\.tsx?$/.test(file) && file !== 'components/ui/icon.tsx')
      .map(file => `src/${file}`);
    const uses = Object.fromEntries(
      files
        .map(file => [file, (readFileSync(file, 'utf8').match(/arrow-r/g) ?? []).length] as const)
        .filter(([, n]) => n > 0),
    );
    expect(uses).toEqual(OPENS_A_SCREEN);
  });
});
