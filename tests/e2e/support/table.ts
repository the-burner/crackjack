import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Taps a tile of the bet grid (0 is the smallest bet) and waits for the deal to start. */
export async function tapBetTile(page: Page, index = 0): Promise<void> {
  const grid = page.locator('.bet-overlay__grid');
  const box = await grid.boundingBox();
  await grid.click({ position: { x: 25 + (index * (box?.width ?? 0)) / 6, y: 25 } });
  await expect(page.locator('.bet-overlay')).toBeHidden();
}

/** The running count the Statistics screen reports: the session's own. */
export async function statsRunningCount(page: Page): Promise<string> {
  await page.locator('.table__bar [data-action="stats"]').click();
  await expect(page.locator('[data-screen="game.stats"]')).toBeVisible();
  const row = page.locator('tr', { has: page.getByText('Running Count', { exact: true }) });
  const value = ((await row.locator('td').last().textContent()) ?? '').trim();
  await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
  await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
  return value;
}

/** The running count the table's readout shows. */
export const readoutRunningCount = async (page: Page): Promise<string | undefined> =>
  ((await page.locator('.table__counts').textContent()) ?? '').match(/RC: (-?[\d.]+)/)?.[1];
