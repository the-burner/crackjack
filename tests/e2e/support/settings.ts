import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { SettingKey, SettingValues } from '@/settings/schema';

/** Opens one option screen from the settings hub, which must be showing. */
export async function openFromHub(page: Page, button: string, screen: string): Promise<Locator> {
  await page.locator('[data-screen="settings"]').getByRole('button', { name: button, exact: true }).click();
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
  // The confirming button comes last.
  await dialog.getByRole('button').last().click();
  await page.waitForFunction(el => !el?.isConnected, handle);
}

export const setting = <K extends SettingKey>(page: Page, key: K) =>
  page.evaluate(k => window.app.settings.get(k), key) as Promise<SettingValues[K]>;
