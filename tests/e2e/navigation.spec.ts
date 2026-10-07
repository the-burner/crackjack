// The browser's back and forward moves (the phone's edge swipes) through the
// screens' URLs.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Opens Game Options, then Basic Setup, so three screens are stacked. */
async function stackThree(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html');
  await page.locator('[data-screen="home"] [data-action="play"]').click();
  await page.getByRole('button', { name: 'Basic Setup' }).click();
  await expect(page.locator('[data-screen="game.setup"]')).toBeVisible();
}

const showing = (page: Page) =>
  page.evaluate(() => {
    const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')];
    return screens
      .filter(el => !el.hidden)
      .map(el => el.dataset.screen)
      .join(',');
  });

test('going back closes one screen at a time and never leaves the app', async ({ page }) => {
  await stackThree(page);

  await page.goBack();
  await expect(page.locator('[data-screen="game.options"]')).toBeVisible();
  expect(await showing(page)).toBe('game.options');

  await page.goBack();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  expect(await showing(page)).toBe('home');
  // The app is still the page it was, not a reload or a different document.
  expect(await page.evaluate(() => typeof window.app?.router?.navigate)).toBe('function');
});

test('going forward reopens the screen that was closed', async ({ page }) => {
  await stackThree(page);
  await page.goBack();
  await expect(page.locator('[data-screen="game.options"]')).toBeVisible();

  // The entry says Basic Setup was open, so going forward brings it back rather
  // than walking the user off to the home screen.
  await page.goForward();
  await expect(page.locator('[data-screen="game.setup"]')).toBeVisible();
  expect(await showing(page)).toBe('game.setup');

  // Back and forward keep agreeing with each other however often they are used.
  for (let i = 0; i < 3; i++) {
    await page.goBack();
    await expect(page.locator('[data-screen="game.options"]')).toBeVisible();
    await page.goForward();
    await expect(page.locator('[data-screen="game.setup"]')).toBeVisible();
  }
  expect(await showing(page)).toBe('game.setup');
});

test('a link to a screen opens it, and Back goes up to the screen above it', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html#/game/setup');
  await expect(page.locator('[data-screen="game.setup"]')).toBeVisible();
  // Opened straight here, there is no history to go back through.
  await page.locator('[data-screen="game.setup"]').getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-screen="game.options"]')).toBeVisible();
});

test('an unknown link goes home', async ({ page }) => {
  await page.goto('/index.html#/no/such/screen');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});
