// Regenerates the precache list and version in sw.js from the files the app
// serves. Usage: node tools/update-precache.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVED = ['index.html', 'manifest.webmanifest', 'src', 'assets'];

function walk(rel) {
  const abs = path.join(ROOT, rel);
  if (fs.statSync(abs).isDirectory()) return fs.readdirSync(abs).sort().flatMap(name => (name.startsWith('.') ? [] : walk(path.join(rel, name))));
  return [rel.split(path.sep).join('/')];
}

export function precacheBlock() {
  const files = SERVED.flatMap(walk);
  const hash = crypto.createHash('sha256');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(ROOT, f)));
  const version = hash.digest('hex').slice(0, 12);
  const list = ['./', ...files.map(f => `./${f}`)];
  return `// <precache>\nconst VERSION = '${version}';\nconst FILES = [\n${list.map(f => `  '${f}',`).join('\n')}\n];\n// </precache>`;
}

const swPath = path.join(ROOT, 'sw.js');
const current = fs.readFileSync(swPath, 'utf8');
const updated = current.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, precacheBlock());
if (process.argv.includes('--check')) {
  if (updated !== current) {
    console.error('sw.js precache list is out of date: run `npm run precache`.');
    process.exit(1);
  }
} else if (updated !== current) {
  fs.writeFileSync(swPath, updated);
  console.log('sw.js updated');
}
