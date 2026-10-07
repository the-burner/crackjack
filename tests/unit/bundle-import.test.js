import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  EXPORT_HOST,
  addSideBetGame,
  addStrategy,
  isSideBetDefinition,
  isStrategyFileText,
  normalizeDownload,
  sideBetUrl,
  strategyUrl,
} from '../../tools/bundle-import.mjs';
import { STRATEGY_FILES } from '../../src/data/strategy-files.ts';
import { SIDE_BET_GAME_DEFINITIONS } from '../../src/data/side-bet-games.ts';

const read = file => fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const sources = () => ({ files: read('src/data/strategy-files.ts'), catalog: read('src/settings/strategies.ts') });
/** Loads an import-free TypeScript module from source. */
const load = async src => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cj-bundle-')), 'module.ts');
  fs.writeFileSync(file, src);
  return import(file);
};

describe('download URLs', () => {
  it('trims and lowercases a strategy code, as the original did', () => {
    expect(strategyUrl('  12AB ')).toBe(`${EXPORT_HOST}/Apps/z12ab.php`);
  });

  it('trims a side-bet code', () => {
    expect(sideBetUrl(' 45 ')).toBe(`${EXPORT_HOST}/Apps/u45.php`);
  });
});

describe('normalizeDownload', () => {
  it('turns escaped spaces back into spaces', () => {
    expect(normalizeDownload('|My%20Strategy|0|')).toBe('|My Strategy|0|');
  });
});

describe('isStrategyFileText', () => {
  it('accepts a real strategy file', () => {
    expect(isStrategyFileText(STRATEGY_FILES[30])).toBe(true);
  });

  it('rejects a server error page, non-strategy text and a truncated file', () => {
    expect(isStrategyFileText('The page cannot be displayed because an internal server error has occurred.')).toBe(
      false,
    );
    for (const bad of ['', '|', '|name|', null, 42]) expect(isStrategyFileText(bad)).toBe(false);
    expect(isStrategyFileText(STRATEGY_FILES[30].slice(0, 400))).toBe(false);
  });
});

describe('addStrategy', () => {
  const text = STRATEGY_FILES[32].replace('Halves', 'My Halves');

  it('adds the file under the next id and lists it last', async () => {
    const { id, name, files, catalog } = addStrategy(sources(), text);
    expect([id, name]).toEqual([101, 'My Halves']);
    expect((await load(files)).STRATEGY_FILES[101]).toBe(text);
    expect(catalog).toContain("\n  [101, 'My Halves'],\n].map(");
  });

  it('takes a display name, escaping quotes', () => {
    expect(addStrategy(sources(), text, "Ethan's Halves").catalog).toContain("[101, 'Ethan\\'s Halves'],");
  });

  it('rejects a bad download and a strategy that is already bundled', () => {
    expect(() => addStrategy(sources(), 'error')).toThrow(/not a strategy file/);
    expect(() => addStrategy(sources(), STRATEGY_FILES[30])).toThrow(/already bundled/);
  });
});

describe('addSideBetGame', () => {
  const definition = SIDE_BET_GAME_DEFINITIONS[8].replace('Lucky Ladies', 'Lucky Gents');

  it('adds the definition under the next id and lists it last', async () => {
    const { id, name, games } = addSideBetGame(read('src/data/side-bet-games.ts'), definition);
    expect([id, name]).toEqual([20, 'Lucky Gents']);
    const mod = await load(games);
    expect(mod.SIDE_BET_GAME_DEFINITIONS[20]).toBe(definition);
    expect(mod.BUILTIN_SIDE_BET_GAMES.at(-1)).toEqual({ id: 20, name: 'Lucky Gents' });
  });

  it('rejects a bad download and a game that is already bundled', () => {
    expect(isSideBetDefinition('error')).toBe(false);
    expect(() => addSideBetGame(read('src/data/side-bet-games.ts'), 'error')).toThrow(/not a side-bet game/);
    expect(() => addSideBetGame(read('src/data/side-bet-games.ts'), SIDE_BET_GAME_DEFINITIONS[8])).toThrow(
      /already bundled/,
    );
  });
});
