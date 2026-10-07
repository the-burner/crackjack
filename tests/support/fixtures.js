// Loads gzipped JSON fixtures from tests/fixtures/.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const cache = new Map();

export function loadFixture(name) {
  if (!cache.has(name))
    cache.set(name, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `${name}.json.gz`)))));
  return cache.get(name);
}
