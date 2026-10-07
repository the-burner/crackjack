// Loads gzipped JSON fixtures from tests/fixtures/.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const cache = new Map<string, unknown>();

// The caller names the recorded shape; fixtures are trusted test data.
export function loadFixture<T = unknown>(name: string): T {
  if (!cache.has(name))
    cache.set(name, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${name}.json.gz`))).toString()));
  return cache.get(name) as T;
}
