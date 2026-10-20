// Every setting that drives the game must actually reach the engine.
//
// The engine's own tests pass `rules` and `table` objects straight in, so a
// setting wired to nothing would still let them all pass. These walk the schema
// instead: change a setting, and something the engine reads has to change with
// it. That is what caught the settings that used to be read nowhere at all.

import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { rulesFrom } from '@/game/engine/rules';
import { Settings } from '@/settings/store';
import { SETTINGS_SCHEMA, type SettingKey, type SettingsPatch } from '@/settings/schema';
import { SCOPES } from '@/settings/scopes';
import type { Sound } from '@/services/sound';
import { Storage } from '@/services/storage';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const keysUnder = (prefix: string) =>
  (Object.keys(SETTINGS_SCHEMA) as SettingKey[]).filter(key => key.startsWith(prefix));

/** A value for this setting that is not its default. */
function otherValue(key: SettingKey) {
  const spec = SETTINGS_SCHEMA[key];
  switch (spec.type) {
    case 'bool':
      return !spec.default;
    case 'enum':
      return spec.values.find(value => value !== spec.default);
    case 'int': {
      const max = spec.max ?? spec.default + 1;
      return spec.default < max ? spec.default + 1 : spec.default - 1;
    }
    default:
      return undefined;
  }
}

const settingsWith = (overrides: SettingsPatch = {}) => {
  const settings = new Settings(SETTINGS_SCHEMA, new Storage(new MemoryBackend()));
  settings.update(overrides);
  return settings;
};

function makeApp() {
  const app = createServices({ backend: new MemoryBackend() });
  // A silent stand-in: only play() is called.
  app.sound = { play() {} } as unknown as Sound;
  return app;
}

/** The table object a session hands the engine, with these settings applied. */
function tableFor(overrides: SettingsPatch = {}) {
  const app = makeApp();
  app.settings.update(overrides);
  return new GameSession(app).table;
}

/**
 * Settings that deliberately do not reach the engine, with the reason. Anything
 * else under these groups must change what the engine is given.
 */
const NOT_THE_ENGINES: Partial<Record<SettingKey, string>> = {
  'table.startingBankroll': 'sets the opening bankroll, not a table rule',
  'table.refreshBankrollOnStart': 'decides whether the saved bankroll is reused',
  'table.seatCount': 'carried through, but as the seat list the screen draws',
  'table.computerSeats': 'turned into the computerSeats list, checked on its own below',
  'peeking.strategyHigh': 'picks a hole-card strategy, which is not implemented',
  'peeking.strategyLow': 'picks a hole-card strategy, which is not implemented',
};

/**
 * Settings nothing reads yet, with what is missing. A setting that is only read
 * by the screen that edits it does nothing at all, which is how several of these
 * sat unnoticed. Implement one and take it off this list.
 */
const NOT_IMPLEMENTED_YET: Partial<Record<SettingKey, string>> = {
  'dealerErrors.dealingBias': 'kept deliberately: it never had any effect in the original either',
  'peeking.strategyHigh': 'needs the original hole-card strategy tables, which are not bundled',
  'peeking.strategyLow': 'needs the original hole-card strategy tables, which are not bundled',
};

/** Settings that only change what their own screen shows, so that screen is what reads them. */
const SHOWN_ON_ITS_SCREEN: Partial<Record<SettingKey, string>> = {
  'charts.table': 'src/screens/strategy/tables.tsx',
  'charts.compare.on': 'src/screens/strategy/tables.tsx',
};

describe('rules reaching the engine', () => {
  // The unusual-game picker rewrites other rule settings instead of being read
  // as a rule itself; it is checked on its own below.
  const keys = [...keysUnder('rules.'), ...keysUnder('bonuses.')].filter(key => key !== 'bonuses.game');

  it('covers every rule and bonus setting', () => {
    expect(keys.length).toBeGreaterThan(40);
  });

  for (const key of keys) {
    const other = otherValue(key);
    if (other === undefined) continue;
    it(`changes the rules when ${key} changes`, () => {
      const base = JSON.stringify(rulesFrom(settingsWith()));
      const changed = JSON.stringify(rulesFrom(settingsWith({ [key]: other } as SettingsPatch)));
      expect(changed).not.toBe(base);
    });
  }
});

describe('table settings reaching the engine', () => {
  const keys: SettingKey[] = [...keysUnder('table.'), ...keysUnder('peeking.'), 'mechanics.dealerMakesObviousPlays'];

  for (const key of keys) {
    const other = otherValue(key);
    if (other === undefined || NOT_THE_ENGINES[key]) continue;
    it(`changes the table when ${key} changes`, () => {
      expect(JSON.stringify(tableFor({ [key]: other } as SettingsPatch))).not.toBe(JSON.stringify(tableFor()));
    });
  }

  it('turns the seat switches into the list of computer seats', () => {
    const table = tableFor({ 'table.seatCount': 4, 'table.computerSeats': [false, true, false, true, false, false] });
    expect(table.computerSeats).toEqual([2, 4]);
  });

  it('drops computer seats beyond the seats in play', () => {
    const table = tableFor({ 'table.seatCount': 2, 'table.computerSeats': [false, true, true, true, false, false] });
    expect(table.computerSeats).toEqual([2]);
  });

  it('leaves out the settings that are not the engine’s business', () => {
    for (const [key, why] of Object.entries(NOT_THE_ENGINES)) {
      expect(typeof why).toBe('string');
      expect(SETTINGS_SCHEMA[key as SettingKey]).toBeDefined();
    }
  });
});

describe('the unusual-game picker', () => {
  it('loads the side-bet game it names', () => {
    const app = makeApp();
    app.settings.update({ 'bonuses.game': 8 });
    expect(new GameSession(app).sideBetGame?.name).toBe('Lucky Ladies');
  });

  it('leaves the side bet alone when no game is picked', () => {
    expect(new GameSession(makeApp()).sideBetGame).toBe(null);
  });
});

describe('speeds reaching the table', () => {
  for (const key of ['mechanics.dealerSpeed', 'mechanics.otherPlayerSpeed', 'mechanics.payoffSpeed'] as const) {
    it(`${key} changes how long the table waits`, async () => {
      const { pauseForSpeed } = await import('@/game/table/animator');
      const settings = settingsWith();
      const slow = pauseForSpeed(settings.get(key));
      const fast = pauseForSpeed(otherValue(key) as number);
      expect(slow).not.toBe(fast);
    });
  }
});

describe('true count settings reaching the counter', () => {
  // These two reach the engine by other routes than the counter's settings.
  const elsewhere = [
    'game.trueCount.tenSideCount',
    'game.trueCount.remainingCards',
    'game.trueCount.allowedErrorCards',
  ];

  for (const key of keysUnder('trueCount.').filter(key => !elsewhere.includes(key))) {
    const other = otherValue(key);
    if (other === undefined) continue;
    it(`changes how the true count is worked out when ${key} changes`, () => {
      const app = makeApp();
      app.settings.update({ [key]: other } as SettingsPatch);
      const changed = JSON.stringify(new GameSession(app).trueCountSettings());
      const base = JSON.stringify(new GameSession(makeApp()).trueCountSettings());
      expect(changed).not.toBe(base);
    });
  }

  it('side counts the tens for the insurance advice when that is on', () => {
    const app = makeApp();
    app.settings.update({ 'game.trueCount.tenSideCount': true, 'display.showTrueCount': true });
    const session = new GameSession(app);
    session.startRound({ betPerHand: 10, hands: 1 });
    expect(session.counts.tens).toBeTypeOf('number');
  });
});

describe('every setting does something', () => {
  const sourceFiles: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) sourceFiles.push(full);
    }
  })('src');

  /** Files that only define or edit settings, so reading one there proves nothing. */
  const isEditor = (file: string) =>
    file.includes('settings/schema.ts') ||
    file.includes('data/help.ts') ||
    file.includes('screens/settings/') ||
    file.includes('screens/strategy/') ||
    (file.includes('drills/') && /options\.tsx?$/.test(file)) ||
    file.includes('drills/shared/options-screen.ts');

  const consumers = new Map<string, boolean>();
  const sources = sourceFiles.filter(file => !isEditor(file)).map(file => readFileSync(file, 'utf8'));
  /** A module's own copy of a setting is read by the shared name its screens use (settings/scopes.ts). */
  const names = (key: string) => {
    const scope = Object.values(SCOPES).find(prefix => key.startsWith(`${prefix}.`));
    return scope ? [key, key.slice(scope.length + 1)] : [key];
  };
  for (const key of Object.keys(SETTINGS_SCHEMA)) {
    consumers.set(
      key,
      names(key).some(name => sources.some(text => text.includes(`'${name}'`))),
    );
  }

  it('is read by something other than the screen that edits it', () => {
    const dead = [...consumers]
      .filter(([key, used]) => !used && !(key in SHOWN_ON_ITS_SCREEN))
      .map(([key]) => key)
      .sort();
    expect(dead).toEqual(Object.keys(NOT_IMPLEMENTED_YET).sort());
    for (const [key, screen] of Object.entries(SHOWN_ON_ITS_SCREEN)) {
      expect(readFileSync(screen, 'utf8'), key).toContain(`'${key}'`);
    }
  });

  it('keeps a reason for each setting nothing reads yet', () => {
    for (const [key, why] of Object.entries(NOT_IMPLEMENTED_YET)) {
      expect(SETTINGS_SCHEMA[key as SettingKey], `${key} is no longer in the schema`).toBeDefined();
      expect(why.length).toBeGreaterThan(10);
    }
  });
});
