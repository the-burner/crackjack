// Bugs found on the settings and strategy screens, each driven through the UI.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SavedSettings } from './support/app.ts';
import { answerDialog, openFromHub, setting } from './support/settings.ts';

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

  await el.getByRole('checkbox', { name: 'No hole card' }).check();
  expect(await setting(page, 'rules.dealerPeeksTen')).toBe(false);
  expect(await setting(page, 'rules.dealerPeeksAce')).toBe(false);

  await el.getByRole('checkbox', { name: 'Double any number of cards' }).check();
  expect(await setting(page, 'rules.doubleOnThreeCards')).toBe(true);
});

test('the Index Range cannot be turned the wrong way round', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Playing Strategies', 'settings.strategy');

  await el.getByRole('button', { name: '99', exact: true }).click();
  await answerDialog(page, '-4');
  expect(await setting(page, 'strategy.indexRangeMax')).toBe(-4);

  await el.getByRole('button', { name: '-99', exact: true }).click();
  await answerDialog(page, '50');
  expect(await setting(page, 'strategy.indexRangeMin')).toBe(-4);
  await expect(el.getByRole('button', { name: '-4', exact: true })).toHaveCount(2);
});

test('tapping a dealer-total column of an extended strategy keeps the picked indices', async ({ page }) => {
  await openHub(page, { 'strategy.system': 92 });
  const strategy = await openFromHub(page, 'Playing Strategies', 'settings.strategy');
  await strategy.locator('[data-action="select-indices"]').click();

  const el = page.locator('[data-screen="strategy.tables"]');
  const hint = el.locator('.tables__hint');
  await expect(hint).toHaveText('0 of 100 cells selected');
  await el.locator('.tables__grid td[data-row="0"][data-col="9"]').click();
  await expect(hint).toHaveText('1 of 100 cells selected');

  // The extra columns hold dealer totals, which have no index to pick.
  await el.locator('.tables__grid td[data-row="0"][data-col="13"]').click();
  await expect(hint).toHaveText('1 of 100 cells selected');
  const grids = await page.evaluate(() => window.app.settings.get('strategy.customIndexMask'));
  expect(grids.hardStand[0]).toHaveLength(10);
  expect(grids.hardStand[0][9]).toBe(true);
});

test('the Peeking rows fill their group and keep their labels inside it', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Peeking', 'settings.peeking');

  // The peek modes are list rows, so their separators cross the whole card.
  const modes = el.locator('.settings-group').first();
  const checks = modes.locator('.checklist');
  const card = await modes.boundingBox();
  const list = await checks.boundingBox();
  expect(Math.round(list!.width)).toBe(Math.round(card!.width));

  // The trailing label is inset, so the rounded corner cannot clip it.
  const strategies = el.locator('.settings-group').nth(1);
  const label = strategies.getByText('HC High');
  const group = await strategies.boundingBox();
  const text = await label.boundingBox();
  expect(group!.x + group!.width - (text!.x + text!.width)).toBeGreaterThanOrEqual(10);
});

test('the TC Calcs rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');
  await expect(el.locator('.settings-group')).toHaveCount(1);
  await expect(el.locator('.settings-group .tc-row')).toHaveCount(5);
});

test('the Allowed Bets rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
  await expect(el.locator('.settings-group')).toHaveCount(1);
  await expect(el.locator('.settings-group .tc-row')).toHaveCount(3);
  await expect(el.locator('.settings-group').getByRole('checkbox', { name: 'Warning on Betting Error' })).toBeVisible();
});

test('Allowed Bets saves the bet ramp it brought back into range', async ({ page }) => {
  await openHub(page, { 'betting.ramp': { minCount: 1.5, rows: [{ chips: 999, hands: 9 }] } });
  await openFromHub(page, 'Betting Strategies', 'settings.betting');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').values['betting.ramp'],
  );
  expect(saved).toEqual({ minCount: 2, rows: [{ chips: 33, hands: 6 }] });
});

test('the Settings hub uses both columns in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  const sections = page.locator('[data-screen="settings"] .section');
  const first = await sections.nth(0).boundingBox();
  const second = await sections.nth(1).boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x + first!.width / 2);
  expect(Math.round(second!.y)).toBe(Math.round(first!.y));
});
