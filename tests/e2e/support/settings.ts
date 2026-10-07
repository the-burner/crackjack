import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { SettingKey, SettingValues } from '@/settings/schema';

/** The hub an option screen is opened from: Game Options for the game's own screens, Settings otherwise. */
export const hubOf = (screen: string) => (screen.startsWith('game.') ? 'game.options' : 'settings');

/** Opens a hub from the home screen, which must be showing. */
export async function openHubFromHome(page: Page, hub: 'settings' | 'game.options'): Promise<Locator> {
  const home = page.locator('[data-screen="home"]');
  if (hub === 'settings') await home.getByRole('button', { name: 'Settings', exact: true }).click();
  else await home.locator('[data-action="play"]').click();
  const el = page.locator(`[data-screen="${hub}"]`);
  await expect(el).toBeVisible();
  return el;
}

/** Opens one option screen from its hub (hubOf), going there through the home screen if another is showing. */
export async function openFromHub(page: Page, button: string, screen: string): Promise<Locator> {
  const hub = page.locator(`[data-screen="${hubOf(screen)}"]`);
  if (!(await hub.isVisible())) {
    await page.evaluate(() => window.app.router.navigate('/'));
    await openHubFromHome(page, hubOf(screen));
  }
  await hub.getByRole('button', { name: button, exact: true }).click();
  const el = page.locator(`[data-screen="${screen}"]`);
  await expect(el).toBeVisible();
  return el;
}

/**
 * Answers the open dialog with `text` (or just its confirming button when text
 * is null) and waits for that dialog to go away; another may take its place.
 */
export async function answerDialog(page: Page, text: string | null = null): Promise<void> {
  const dialog = page.getByRole('alertdialog').first();
  await expect(dialog).toBeVisible();
  const handle = await dialog.elementHandle();
  if (text !== null) await dialog.getByRole('spinbutton').or(dialog.getByRole('textbox')).fill(text);
  // The confirming button comes first.
  await dialog.getByRole('button').first().click();
  await page.waitForFunction(el => !el?.isConnected, handle);
}

export const setting = <K extends SettingKey>(page: Page, key: K) =>
  page.evaluate(k => window.app.settings.get(k), key) as Promise<SettingValues[K]>;
