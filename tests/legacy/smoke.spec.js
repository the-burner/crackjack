// The original apps boot and every top-level screen opens without script errors.
import { test, expect } from '@playwright/test';
import { openLegacy } from '../support/legacy.js';

test.use({ serviceWorkers: 'block' });

const SCREENS = {
  drill: ['frmOptsF', 'frmOptsD', 'frmOptsC', 'frmOptsL', 'frmStrats', 'frmTC'],
  game: ['frmOpts0', 'frmOpts1', 'frmOpts2', 'frmOpts3', 'frmOpts4', 'frmOpts5', 'frmOpts6', 'frmOpts7', 'frmOpts8', 'frmOpts9', 'frmStrats', 'frmTC', 'frmBet', 'frmStats'],
};

for (const [app, screens] of Object.entries(SCREENS)) {
  test(`legacy ${app} opens every options screen`, async ({ context, baseURL }) => {
    const page = await openLegacy(context, baseURL, app);
    for (const id of screens) {
      await page.evaluate(form => window.ChangeForm(window[form]), id);
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    expect(page.legacyErrors).toEqual([]);
  });
}
