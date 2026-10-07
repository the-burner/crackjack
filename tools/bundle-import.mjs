// Downloads a strategy or side-bet game by its export code and bundles it into the app.
//
//   node tools/bundle-import.mjs strategy <code> [--name "Display name"]
//   node tools/bundle-import.mjs side-bet <code> [--name "Display name"]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStrategyFile } from '../src/core/strategy/strategy-file.ts';
import { decodeSideBetGame, sideBetGameName } from '../src/settings/side-bet-games.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRATEGY_FILES = 'src/data/strategy-files.ts';
const STRATEGY_CATALOG = 'src/settings/strategies.ts';
const SIDE_BET_GAMES = 'src/data/side-bet-games.ts';

/** Where exports are downloaded from. */
export const EXPORT_HOST = 'https://www.qfit.com';
export const strategyUrl = code => `${EXPORT_HOST}/Apps/z${encodeURIComponent(String(code).trim().toLowerCase())}.php`;
export const sideBetUrl = code => `${EXPORT_HOST}/Apps/u${encodeURIComponent(String(code).trim())}.php`;

/** The export host escapes spaces in names. */
export const normalizeDownload = text => String(text).replaceAll('%20', ' ');

/** True when `text` parses as a strategy file (not, say, a server error page). */
export function isStrategyFileText(text) {
  if (typeof text !== 'string' || !text.startsWith('|')) return false;
  const nameEnd = text.indexOf('|', 1);
  if (nameEnd < 2) return false;
  try {
    const file = parseStrategyFile(text);
    return (
      file.name.length > 0 &&
      file.decks >= 0 &&
      file.decks <= 8 &&
      file.countValues.slice(1, 11).every(Number.isFinite) &&
      file.initialRunningCount.length === 8 &&
      file.initialRunningCount.every(Number.isFinite) &&
      file.insuranceByDecks.slice(1).every(Number.isFinite) &&
      file.groups.every(row => row.every(Number.isFinite))
    );
  } catch {
    return false;
  }
}

/** True when `definition` decodes as a side-bet game. */
export function isSideBetDefinition(definition) {
  if (typeof definition !== 'string' || definition.indexOf('|', 1) === -1) return false;
  try {
    decodeSideBetGame(definition);
    return true;
  } catch {
    return false;
  }
}

const singleQuoted = text => `'${String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

/** Inserts `line` just before the first `closer` after `opener`. */
function insertBefore(src, opener, closer, line) {
  const start = src.indexOf(opener);
  if (start === -1) throw new Error(`Cannot find ${opener}`);
  const end = src.indexOf(closer, start);
  if (end === -1) throw new Error(`Cannot find the end of ${opener}`);
  return src.slice(0, end) + line + src.slice(end);
}

/** Numeric keys of the object literal that starts at `opener`. */
function objectIds(src, opener) {
  const start = src.indexOf(opener);
  const body = src.slice(start, src.indexOf('\n};', start));
  return [...body.matchAll(/^ {2}(\d+): /gm)].map(m => Number(m[1]));
}

/**
 * Adds a strategy file to the bundled sources.
 * @returns {{id: number, name: string, files: string, catalog: string}}
 */
export function addStrategy({ files, catalog }, text, name = text.slice(1, text.indexOf('|', 1)).trim()) {
  if (!isStrategyFileText(text)) throw new Error('That is not a strategy file. Probably an incorrect code.');
  if (files.includes(JSON.stringify(text))) throw new Error('That strategy is already bundled.');
  const id = Math.max(...objectIds(files, 'export const STRATEGY_FILES: Readonly<Record<number, string>> = {')) + 1;
  return {
    id,
    name,
    files: insertBefore(
      files,
      'export const STRATEGY_FILES: Readonly<Record<number, string>> = {',
      '\n};',
      `\n  ${id}: ${JSON.stringify(text)},`,
    ),
    catalog: insertBefore(
      catalog,
      'export const BUILTIN_STRATEGIES = [',
      '\n].map(',
      `\n  [${id}, ${singleQuoted(name)}],`,
    ),
  };
}

/**
 * Adds a side-bet game to the bundled source.
 * @returns {{id: number, name: string, games: string}}
 */
export function addSideBetGame(games, definition, name = sideBetGameName(definition)) {
  if (!isSideBetDefinition(definition)) throw new Error('That is not a side-bet game. Probably an incorrect code.');
  if (games.includes(JSON.stringify(definition))) throw new Error('That game is already bundled.');
  const id =
    Math.max(...objectIds(games, 'export const SIDE_BET_GAME_DEFINITIONS: Readonly<Record<number, string>> = {')) + 1;
  let out = insertBefore(
    games,
    'export const BUILTIN_SIDE_BET_GAMES = [',
    '\n];',
    `\n  { id: ${id}, name: ${JSON.stringify(name)} },`,
  );
  out = insertBefore(
    out,
    'export const SIDE_BET_GAME_DEFINITIONS: Readonly<Record<number, string>> = {',
    '\n};',
    `\n  ${id}: ${JSON.stringify(definition)},`,
  );
  return { id, name, games: out };
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return normalizeDownload(await response.text());
}

const read = file => fs.readFileSync(path.join(REPO, file), 'utf8');
const write = (file, text) => fs.writeFileSync(path.join(REPO, file), text);

async function main([kind, code, ...rest]) {
  const nameAt = rest.indexOf('--name');
  const name = nameAt === -1 ? undefined : rest[nameAt + 1];
  if (!['strategy', 'side-bet'].includes(kind) || !code || (nameAt !== -1 && !name)) {
    throw new Error('usage: node tools/bundle-import.mjs <strategy|side-bet> <code> [--name "Display name"]');
  }
  let added;
  if (kind === 'strategy') {
    added = addStrategy(
      { files: read(STRATEGY_FILES), catalog: read(STRATEGY_CATALOG) },
      await download(strategyUrl(code)),
      name,
    );
    write(STRATEGY_FILES, added.files);
    write(STRATEGY_CATALOG, added.catalog);
  } else {
    added = addSideBetGame(read(SIDE_BET_GAMES), await download(sideBetUrl(code)), name);
    write(SIDE_BET_GAMES, added.games);
  }
  console.log(`Added ${kind} "${added.name}" as id ${added.id}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`error: ${error.message}`);
    process.exit(1);
  });
}
