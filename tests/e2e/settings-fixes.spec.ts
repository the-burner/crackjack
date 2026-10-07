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
  const el = await openFromHub(page, 'Peeking', 'game.peeking');

  // The peek modes are list rows, so their separators cross the whole card.
  const modes = el.locator('[data-slot="settings-group"]').first();
  const card = await modes.boundingBox();
  const list = await modes.locator('[data-slot="check-list"]').boundingBox();
  expect(Math.round(list!.width)).toBe(Math.round(card!.width));

  // The trailing label is inset, so the rounded corner cannot clip it.
  const strategies = el.locator('[data-slot="settings-group"]').nth(1);
  const label = strategies.getByText('HC High', { exact: true });
  const group = await strategies.boundingBox();
  const text = await label.boundingBox();
  expect(group!.x + group!.width - (text!.x + text!.width)).toBeGreaterThanOrEqual(10);
  await expect(el.getByRole('combobox', { name: 'HC High' })).toBeVisible();
  await expect(el.getByRole('combobox', { name: 'HC Low' })).toBeVisible();
});

test('the TC Calcs rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');
  const groups = el.locator('[data-slot="settings-group"]');
  await expect(groups).toHaveCount(1);
  await expect(groups.getByRole('combobox')).toHaveCount(4);
  await expect(groups.getByRole('button', { name: /^Allowed estimation error: / })).toBeVisible();
});

test('the Allowed Bets rows sit in one inset group', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Betting Strategies', 'game.betting');
  const groups = el.locator('[data-slot="settings-group"]');
  await expect(groups).toHaveCount(1);
  await expect(groups.getByRole('switch', { name: 'Warning on Betting Error' })).toBeVisible();
  await expect(groups.getByRole('combobox', { name: 'Chip Value' })).toBeVisible();
  await expect(groups.getByRole('button', { name: /^Number of bets: / })).toBeVisible();
  await expect(groups.getByRole('button', { name: /^Minimum bet count: / })).toBeVisible();
});

test('Allowed Bets saves the bet ramp it brought back into range', async ({ page }) => {
  await openHub(page, { 'betting.ramp': { minCount: 1.5, rows: [{ chips: 999, hands: 9 }] } });
  await openFromHub(page, 'Betting Strategies', 'game.betting');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state.values['betting.ramp'],
  );
  expect(saved).toEqual({ minCount: 2, rows: [{ chips: 33, hands: 6 }] });
});

test('Game Options keeps its sections and Play button in one centred column in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openHub(page);
  await page.evaluate(() => window.app.router.navigate('/'));
  const el = page.locator('[data-screen="home"]');
  await el.locator('[data-action="play"]').click();
  const options = page.locator('[data-screen="game.options"]');
  const sections = options.getByRole('heading', { level: 2 });
  await expect(sections).toHaveCount(3);
  const play = (await options.locator('[data-action="play"]').boundingBox())!;
  for (const box of [await sections.nth(0).boundingBox(), await sections.nth(2).boundingBox()]) {
    expect(box!.x).toBeGreaterThanOrEqual(play.x);
    expect(box!.x).toBeLessThan(play.x + 40);
  }
  expect(Math.abs(play.x + play.width / 2 - 844 / 2)).toBeLessThan(40);
});

test('a focused select shows the pressed shade, not a ring its group would clip to two bars', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'Appearance & Sound', 'settings.appearance');
  const select = el.getByRole('combobox', { name: 'Theme' });
  const before = await select.evaluate(e => getComputedStyle(e).backgroundColor);
  await select.focus();
  const focused = await select.evaluate(e => ({
    outline: getComputedStyle(e).outlineStyle,
    bg: getComputedStyle(e).backgroundColor,
  }));
  expect(focused.outline).toBe('none');
  expect(focused.bg).not.toBe(before);
});
