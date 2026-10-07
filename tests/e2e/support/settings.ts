import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { SettingKey, SettingValues } from '../../../src/settings/schema.ts';

/** Opens one option screen from the settings hub, which must be showing. */
export async function openFromHub(page: Page, button: string, screen: string): Promise<Locator> {
  await page.locator('[data-screen="settings"]').getByRole('button', { name: button, exact: true }).click();
  const el = page.locator(`[data-screen="${screen}"]`);
  await expect(el).toBeVisible();
  return el;
}

/**
 * Answers the open dialog with `text` (or just OK when text is null) and waits
 * for that dialog to go away; another may take its place.
 */
export async function answerDialog(page: Page, text: string | null = null): Promise<void> {
  const overlay = page.locator('.dialog-overlay').first();
  await expect(overlay).toBeVisible();
  const handle = await overlay.elementHandle();
  if (text !== null) await overlay.locator('.dialog__input').fill(text);
  await overlay.getByRole('button').first().click();
  await page.waitForFunction(el => !el?.isConnected, handle);
}

export const setting = <K extends SettingKey>(page: Page, key: K) =>
  page.evaluate(k => window.app.settings.get(k), key) as Promise<SettingValues[K]>;
