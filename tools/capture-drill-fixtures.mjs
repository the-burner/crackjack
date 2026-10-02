// Records reference behavior of the original Drills app into tests/fixtures/.
// Usage: node tools/capture-drill-fixtures.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium, devices } from '@playwright/test';
import { startServer } from '../tests/support/static-server.js';
import { openLegacy } from '../tests/support/legacy.js';
import * as cap from '../tests/legacy/captures-drills.js';

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const save = (name, data) => {
  const file = `tests/fixtures/${name}.json.gz`;
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(data), { level: 9 }));
  console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
};

// Each capture gets a fresh page: they stub globals and leave state behind.
const run = async (name, fn, args) => {
  const page = await openLegacy(context, base, 'drill');
  const data = await page.evaluate(fn, args);
  if (page.legacyErrors.length) console.warn(name, 'page errors:', page.legacyErrors);
  await page.close();
  save(name, data);
};

await run('drills-hand-lists', cap.captureFlashHandListsInPage, { configs: cap.HAND_LIST_CONFIGS });
await run('drills-flash-play', cap.captureFlashPlayInPage, {
  configs: cap.PLAY_CONFIGS, hands: cap.PLAY_HANDS, upcards: cap.PLAY_UPCARDS, counts: cap.PLAY_COUNTS,
});
await run('drills-depth-grids', cap.captureDepthGridsInPage, { configs: cap.DEPTH_GRID_CONFIGS });
await run('drills-depth-trays', cap.captureDepthTraysInPage, { configs: cap.TRAY_CONFIGS });
await run('drills-count-answers', cap.captureCountAnswersInPage, { configs: cap.COUNT_ANSWER_CONFIGS, cards: cap.COUNT_CARDS });

await browser.close();
server.close();
