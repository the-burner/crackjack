// Proves the recorded fixtures still describe the original apps: re-runs every
// capture against legacy/ and compares with tests/fixtures/.
import { test, expect } from '@playwright/test';
import { openLegacy } from '../support/legacy.js';
import { loadFixture } from '../support/fixtures.js';
import * as cap from './captures.js';

test.use({ serviceWorkers: 'block' });

for (const app of ['game', 'drill']) {
  test.describe(`legacy ${app}`, () => {
    const ids = app === 'game' ? cap.STRATEGY_IDS : cap.DRILL_STRATEGY_IDS;

    test('fresh-install storage', async ({ context, baseURL }) => {
      const page = await openLegacy(context, baseURL, app);
      expect(await page.evaluate(cap.captureFreshStorageInPage)).toEqual(loadFixture(`fresh-storage.${app}`));
    });

    test('strategy tables', async ({ context, baseURL }) => {
      const page = await openLegacy(context, baseURL, app);
      const actual = await page.evaluate(cap.captureStrategyTablesInPage, { app, configs: cap.strategyConfigs(ids) });
      expect(actual).toEqual(loadFixture(`strategy-tables.${app}`));
    });

    test('play advisor', async ({ context, baseURL }) => {
      const page = await openLegacy(context, baseURL, app);
      const configs = cap.ADVISOR_CONFIGS.filter(c => ids.includes(c.system));
      const actual = await page.evaluate(cap.captureAdvisorInPage, { app, configs, permissions: cap.ADVISOR_PERMISSIONS, counts: cap.ADVISOR_COUNTS });
      expect(actual).toEqual(loadFixture(`advisor.${app}`));
    });

    test('counting', async ({ context, baseURL }) => {
      const page = await openLegacy(context, baseURL, app);
      const actual = await page.evaluate(cap.captureCountingInPage, { app, configs: cap.countingConfigs(ids), cardsPerConfig: 300 });
      expect(actual).toEqual(loadFixture(`counting.${app}`));
    });
  });
}

test('drills and game load identical strategy tables', () => {
  const game = new Map(loadFixture('strategy-tables.game').map(r => [JSON.stringify(r.config), r]));
  for (const r of loadFixture('strategy-tables.drill')) {
    const g = game.get(JSON.stringify(r.config));
    expect({ ...r, flags: null }).toEqual({ ...g, flags: null });
  }
});
