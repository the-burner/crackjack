// Records how the original game draws the strategy tables into
// tests/fixtures/strategy-screens-tables.json.gz.
// Usage: node tools/capture-strategy-screen-fixtures.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium, devices } from '@playwright/test';
import { startServer } from '../tests/support/static-server.js';
import { openLegacy } from '../tests/support/legacy.js';
import * as cap from '../tests/legacy/captures-strategy-screens.js';

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const page = await openLegacy(context, base, 'game');

const data = await page.evaluate(cap.captureTableViewsInPage, { configs: cap.VIEW_CONFIGS, tableNumbers: cap.TABLE_NUMBERS });
const file = 'tests/fixtures/strategy-screens-tables.json.gz';
fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(data), { level: 9 }));
console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
if (page.legacyErrors.length) console.warn('page errors:', page.legacyErrors);

await browser.close();
server.close();
