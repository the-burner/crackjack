// Records reference behavior of the original apps into tests/fixtures/.
// Usage: node tools/capture-fixtures.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import { chromium, devices } from '@playwright/test';
import { startServer } from '../tests/support/static-server.js';
import { openLegacy } from '../tests/support/legacy.js';
import * as cap from '../tests/legacy/captures.js';

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
const save = (name, data) => {
  const file = `tests/fixtures/${name}.json.gz`;
  fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(data), { level: 9 }));
  console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
};

for (const app of ['game', 'drill']) {
  const page = await openLegacy(context, base, app);
  save(`fresh-storage.${app}`, await page.evaluate(cap.captureFreshStorageInPage));
  const ids = app === 'game' ? cap.STRATEGY_IDS : cap.DRILL_STRATEGY_IDS;
  save(`strategy-tables.${app}`, await page.evaluate(cap.captureStrategyTablesInPage, { app, configs: cap.strategyConfigs(ids) }));
  const advisorConfigs = cap.ADVISOR_CONFIGS.filter(c => ids.includes(c.system));
  save(`advisor.${app}`, await page.evaluate(cap.captureAdvisorInPage, { app, configs: advisorConfigs, permissions: cap.ADVISOR_PERMISSIONS, counts: cap.ADVISOR_COUNTS }));
  save(`counting.${app}`, await page.evaluate(cap.captureCountingInPage, { app, configs: cap.countingConfigs(ids), cardsPerConfig: 300 }));
  if (page.legacyErrors.length) console.warn(app, 'page errors:', page.legacyErrors);
  await page.close();
}
await browser.close();
server.close();
