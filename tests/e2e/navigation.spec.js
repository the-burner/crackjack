// The browser's back and forward moves (the phone's edge swipes) against the
// screen stack, in both engines.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Opens Settings, then Basic Setup, so three screens are stacked. */
async function stackThree(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Basic Setup' }).click();
  await expect(page.locator('[data-screen="settings.setup"]')).toBeVisible();
}

const showing = page =>
  page.evaluate(() => {
    const screens = [...document.querySelectorAll('[data-screen]')];
    return screens
      .filter(el => !el.hidden)
      .map(el => el.dataset.screen)
      .join(',');
  });

test('going back closes one screen at a time and never leaves the app', async ({ page }) => {
  await stackThree(page);

  await page.goBack();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  expect(await showing(page)).toBe('settings');

  await page.goBack();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  expect(await showing(page)).toBe('home');
  // The app is still the page it was, not a reload or a different document.
  expect(await page.evaluate(() => typeof window.app?.router?.open)).toBe('function');
});

test('going forward reopens the screen that was closed', async ({ page }) => {
  await stackThree(page);
  await page.goBack();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();

  // The entry says Basic Setup was open, so going forward brings it back rather
  // than walking the user off to the home screen.
  await page.goForward();
  await expect(page.locator('[data-screen="settings.setup"]')).toBeVisible();
  expect(await showing(page)).toBe('settings.setup');

  // Back and forward keep agreeing with each other however often they are used.
  for (let i = 0; i < 3; i++) {
    await page.goBack();
    await expect(page.locator('[data-screen="settings"]')).toBeVisible();
    await page.goForward();
    await expect(page.locator('[data-screen="settings.setup"]')).toBeVisible();
  }
  expect(await showing(page)).toBe('settings.setup');
});

test("a history entry that is not the app's own is left alone", async ({ page }) => {
  await stackThree(page);
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate', { state: null })));
  await page.waitForTimeout(150);
  expect(await showing(page)).toBe('settings.setup');
});
