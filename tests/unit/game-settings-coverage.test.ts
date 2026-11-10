// Every one of Blackjack's settings has a control on some screen, and Table Rules and Conditions holds the table's.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { SETTINGS_SCHEMA } from '@/settings/schema';
import { TABLE_SETTINGS } from '@/settings/table-settings';

const read = (file: string) => readFileSync(`src/${file}`, 'utf8');
const SCREENS = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter(file => file.endsWith('.tsx'))
  .map(read)
  .join('\n');
/** Kept with the table but set by no control: the rules an unusual game overwrote. */
const NO_CONTROL = ['bonuses.savedRules'];
const shows = (source: string, key: string) => source.includes(`'${key}'`) || source.includes(`"${key}"`);

describe("Blackjack's settings", () => {
  it('each have a control on a screen', () => {
    const missing = Object.keys(SETTINGS_SCHEMA).filter(
      key =>
        /^(table|rules|bonuses|dealerErrors|peeking|mechanics|display)\./.test(key) &&
        !NO_CONTROL.includes(key) &&
        !shows(SCREENS, key),
    );
    expect(missing).toEqual([]);
  });

  it('of the table are all on Table Rules and Conditions, and nothing else is', () => {
    const screen = read('screens/settings/table-rules.tsx');
    expect(TABLE_SETTINGS.filter(key => !NO_CONTROL.includes(key) && !shows(screen, key))).toEqual([]);
    const shown = [
      ...screen.matchAll(/'((?:table|rules|bonuses|dealerErrors|peeking|mechanics|display|game)\.[\w.]+)'/g),
    ].map(m => m[1]);
    expect(shown.filter(key => key in SETTINGS_SCHEMA && !TABLE_SETTINGS.includes(key as never))).toEqual([]);
  });
});
