// The installed app must work with no network once the service worker has
// cached it.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

// Playwright's WebKit build crashes on reload while offline, so this one only
// runs in Chromium; the service worker itself is engine-independent.
test.skip(({ browserName }) => browserName === 'webkit', 'offline reload is unsupported in Playwright WebKit');

test('runs offline after the first visit', async ({ page, context }) => {
  await page.goto('/index.html');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    // Wait for the precache to finish installing and take control.
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
    return registration.active?.state;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();

  // A drill (canvas, card images, tray photos) and the table both work offline.
  await page.locator('[data-screen="home"] button', { hasText: 'Depth Drills' }).click();
  await page.locator('[data-screen="drills.depth.options"] button', { hasText: 'Launch the Drill' }).click();
  await expect(page.locator('[data-screen="drills.depth"]')).toBeVisible();
  await page.evaluate(() => window.app.router.home());
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('.bet-overlay')).toBeVisible();

  const failed = [];
  page.on('requestfailed', request => failed.push(request.url()));
  await page.reload();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  expect(failed).toEqual([]);
});
