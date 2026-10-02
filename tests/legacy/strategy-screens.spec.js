// Proves tests/fixtures/strategy-screens-tables.json.gz still describes how the
// original game draws its strategy tables.
import { test, expect } from '@playwright/test';
import { openLegacy } from '../support/legacy.js';
import { loadFixture } from '../support/fixtures.js';
import * as cap from './captures-strategy-screens.js';

test.use({ serviceWorkers: 'block' });

test('legacy game strategy tables', async ({ context, baseURL }) => {
  const page = await openLegacy(context, baseURL, 'game');
  const actual = await page.evaluate(cap.captureTableViewsInPage, { configs: cap.VIEW_CONFIGS, tableNumbers: cap.TABLE_NUMBERS });
  expect(actual).toEqual(loadFixture('strategy-screens-tables'));
  expect(page.legacyErrors).toEqual([]);
});
