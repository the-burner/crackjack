// Boot and dialog behaviour that only a real browser can show: damaged or
// unavailable storage, and dialogs against Back.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('boots with a settings value that is not an object', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cj.settings', 'null'));
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Defaults' })).toBeVisible();
});

test('boots without localStorage, saying that settings will not be saved', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
  });
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByText('Storage is blocked: settings will not be saved.')).toBeVisible();
});

test('Escape closes a dialog as its cancelling button would', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Reset Defaults' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});

test('going back with a dialog open closes the dialog with its screen', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html');
  await page.locator('[data-screen="home"] [data-action="play"]').click();
  await page.getByRole('button', { name: 'Basic Setup' }).click();
  await page.getByRole('button', { name: /^Burn Cards: / }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-screen="game.options"]')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test.describe('the installed app offline', { tag: '@build' }, () => {
  test.use({ serviceWorkers: 'allow' });

  test('opens a deep link at the app base instead of serving the shell under it', async ({ page, context }) => {
    await page.goto('/index.html');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });

    await context.setOffline(true);
    await page.goto('/some/deep/link');
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/index.html');
  });
});

test('a dialog dismissed by its own button leaves the back button working', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Screen Info' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});
