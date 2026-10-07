// Bugs found on the settings and strategy screens, each driven through the UI.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SavedSettings } from './support/app';
import { answerDialog, openFromHub, setting } from './support/settings';

test.use({ serviceWorkers: 'block' });

/** Opens the settings hub on a clean install, with `saved` settings in place. */
async function openHub(page: Page, saved: SavedSettings | null = null) {
  await page.addInitScript(values => {
    localStorage.clear();
    if (values) localStorage.setItem('cj.settings', JSON.stringify(values));
  }, saved);
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
}

test('a rule ticked on the Playing Strategy screen applies the rules it implies', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Playing Strategies', 'settings.strategy');

  await el.getByRole('switch', { name: 'No hole card' }).check();
  expect(await setting(page, 'rules.dealerPeeksTen')).toBe(false);
  expect(await setting(page, 'rules.dealerPeeksAce')).toBe(false);

  await el.getByRole('switch', { name: 'Double any number of cards' }).check();
  expect(await setting(page, 'rules.doubleOnThreeCards')).toBe(true);
});

test('the Index Range cannot be turned the wrong way round', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Playing Strategies', 'settings.strategy');

  await el.getByRole('button', { name: 'Index range maximum: 99' }).click();
  await answerDialog(page, '-4');
  expect(await setting(page, 'strategy.indexRangeMax')).toBe(-4);

  await el.getByRole('button', { name: 'Index range minimum: -99' }).click();
  await answerDialog(page, '50');
  expect(await setting(page, 'strategy.indexRangeMin')).toBe(-4);
  await expect(el.getByRole('button', { name: 'Index range minimum: -4' })).toBeVisible();
  await expect(el.getByRole('button', { name: 'Index range maximum: -4' })).toBeVisible();
});

test('tapping a dealer-total column of an extended strategy keeps the picked indices', async ({ page }) => {
  await openHub(page, { 'strategy.system': 92 });
  const strategy = await openFromHub(page, 'Playing Strategies', 'settings.strategy');
  await strategy.locator('[data-action="select-indices"]').click();

  const el = page.locator('[data-screen="strategy.tables"]');
  const grid = el.getByRole('table', { name: 'Hard Hit/Stand' });
  /** A grid cell; the first cell of each body row is its label. */
  const cell = (row: number, column: number) =>
    grid
      .locator('tbody tr')
      .nth(row)
      .getByRole('cell')
      .nth(column + 1);
  await expect(el.getByText('0 of 100 cells selected')).toBeVisible();
  await cell(0, 9).click();
  await expect(el.getByText('1 of 100 cells selected')).toBeVisible();

  // The extra columns hold dealer totals, which have no index to pick.
  await cell(0, 13).click();
  await expect(el.getByText('1 of 100 cells selected')).toBeVisible();
  const grids = await page.evaluate(() => window.app.settings.get('strategy.customIndexMask'));
  expect(grids.hardStand[0]).toHaveLength(10);
  expect(grids.hardStand[0][9]).toBe(true);
});

test('the Peeking rows fill their group and keep their labels inside it', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Peeking', 'settings.peeking');

  // The peek modes are list rows, so their separators cross the whole card.
  // Relative locators, for `has`.
  const mode = page.getByRole('switch', { name: 'Peek at dealer down card' });
  const modes = el.locator('section').filter({ has: mode });
  const card = await modes.boundingBox();
  const row = await el.locator('div').filter({ has: mode }).last().boundingBox();
  // Inside the card's 1px border.
  expect(Math.round(row!.width)).toBe(Math.round(card!.width) - 2);

  // The strategy labels are inset, so the rounded corners cannot clip them.
  const label = page.getByText('HC High', { exact: true });
  const strategies = el.locator('section').filter({ has: label });
  const group = await strategies.boundingBox();
  const text = await label.boundingBox();
  expect(text!.x - group!.x).toBeGreaterThanOrEqual(10);
  await expect(el.getByRole('combobox', { name: 'HC High' })).toBeVisible();
  await expect(el.getByRole('combobox', { name: 'HC Low' })).toBeVisible();
});

test('the TC Calcs rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');
  const groups = el.locator('section');
  await expect(groups).toHaveCount(1);
  await expect(groups.getByRole('combobox')).toHaveCount(4);
  await expect(groups.getByRole('button', { name: /^Allowed estimation error: / })).toBeVisible();
});

test('the Allowed Bets rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
  const groups = el.locator('section');
  await expect(groups).toHaveCount(1);
  await expect(groups.getByRole('switch', { name: 'Warning on Betting Error' })).toBeVisible();
  await expect(groups.getByRole('combobox', { name: 'Chip Value' })).toBeVisible();
  await expect(groups.getByRole('button', { name: /^Number of bets: / })).toBeVisible();
  await expect(groups.getByRole('button', { name: /^Minimum bet count: / })).toBeVisible();
});

test('Allowed Bets saves the bet ramp it brought back into range', async ({ page }) => {
  await openHub(page, { 'betting.ramp': { minCount: 1.5, rows: [{ chips: 999, hands: 9 }] } });
  await openFromHub(page, 'Betting Strategies', 'settings.betting');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state.values['betting.ramp'],
  );
  expect(saved).toEqual({ minCount: 2, rows: [{ chips: 33, hands: 6 }] });
});

test('the Settings hub uses both columns in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  const sections = page.locator('[data-screen="settings"]').getByRole('heading', { level: 2 });
  const first = await sections.nth(0).boundingBox();
  const second = await sections.nth(1).boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x + first!.width / 2);
  expect(Math.round(second!.y)).toBe(Math.round(first!.y));
});
