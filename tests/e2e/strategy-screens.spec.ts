// Playing strategy, strategy tables, true count and betting, driven through
// the UI.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerDialog, openFromHub, setting } from './support/settings';

test.use({ serviceWorkers: 'block' });

/** Opens the settings hub on a clean install. */
async function openHub(page: Page) {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
}

test.describe('Playing Strategy', () => {
  test('changes the strategy, the index set, the range and the rules', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Playing Strategies', 'settings.strategy');

    await el.locator('select').first().selectOption('Halves');
    expect(await setting(page, 'strategy.system')).toBe(32);

    await el.locator('select').nth(1).selectOption('Illustrious 18');
    expect(await setting(page, 'strategy.indexSet')).toBe('illustrious18');

    await el.getByRole('checkbox', { name: 'No hole card' }).check();
    expect(await setting(page, 'rules.noHoleCard')).toBe(true);

    await el.getByRole('button', { name: '-99' }).click();
    await answerDialog(page, '-4');
    expect(await setting(page, 'strategy.indexRangeMin')).toBe(-4);
  });
});

test.describe('Strategy tables', () => {
  test('shows the selected strategy and switches between the views', async ({ page }) => {
    await openHub(page);
    await page.evaluate(() => window.app.settings.set('strategy.system', 30));
    const strategy = await openFromHub(page, 'Playing Strategies', 'settings.strategy');
    await strategy.getByRole('button', { name: 'Display Tables' }).click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await expect(el).toBeVisible();
    await expect(el.locator('.tables__name')).toHaveText('Basic High-Low');
    // Hard Hit/Stand: 8 rows of 10 cells, 16 vs ten holds the famous index 0.
    await expect(el.locator('.tables__grid tbody tr')).toHaveCount(8);
    await expect(el.locator('.tables__grid td[data-row="1"][data-col="8"]')).toHaveText('0');
    await expect(el.locator('.tables__legend-box')).toHaveText(['Hit', 'Stand', 'Hit < Value']);

    await el.locator('select').selectOption('Split');
    await expect(el.locator('.tables__grid tbody tr')).toHaveCount(10);
    await expect(el.locator('.tables__legend-box')).toHaveText([
      'Split',
      'No Split',
      'Split >= Value',
      'Split < Value',
    ]);

    await el.locator('select').selectOption('Insurance/Counts');
    await expect(el.locator('.tables__counts')).toContainText('Card Point Values');
    await expect(el.locator('.tables__below')).toBeHidden();
  });

  test('picks custom index cells and uses them for the Custom index set', async ({ page }) => {
    await openHub(page);
    const strategy = await openFromHub(page, 'Playing Strategies', 'settings.strategy');
    await strategy.locator('[data-action="select-indices"]').click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await expect(el.locator('.tables__hint')).toHaveText('0 of 80 cells selected');
    await el.locator('.tables__grid td[data-row="1"][data-col="8"]').click();
    await expect(el.locator('.tables__hint')).toHaveText('1 of 80 cells selected');
    expect(await page.evaluate(() => window.app.settings.get('strategy.customIndexMask').hardStand[1][8])).toBe(true);

    await el.getByRole('button', { name: 'Back' }).click();
    await strategy.locator('select').nth(1).selectOption('Custom');
    // 16 vs ten keeps its index; 16 vs nine reverts to basic strategy (hit).
    const tables = await page.evaluate(() => {
      const t = window.app.strategies.current(window.app.settings, 6).tables.hardStand;
      return [t[1][8], t[1][7]];
    });
    expect(tables).toEqual([0, 32000]);
  });

  test('shades cells by error count', async ({ page }) => {
    await openHub(page);
    await page.evaluate(() => {
      window.app.errorTallies.record('hardStand', 1, 8);
    });
    const strategy = await openFromHub(page, 'Playing Strategies', 'settings.strategy');
    await strategy.getByRole('button', { name: 'Display Tables' }).click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await el.getByRole('checkbox', { name: 'Shade error counts' }).check();
    await expect(el.locator('.tables__grid td[data-row="1"][data-col="8"]')).toHaveText('1');
    await expect(el.locator('.tables__grid td[data-row="1"][data-col="7"]')).toHaveText('');
    await expect(el.locator('.tables__legend')).toBeHidden();
  });
});

test('True Count Calcs writes every control', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');

  await el.locator('select').nth(0).selectOption('Quarter Deck');
  await el.locator('select').nth(2).selectOption('Floor');
  await el.locator('select').nth(3).selectOption('Cards dealt');
  await el.getByRole('checkbox', { name: 'Ace side count' }).check();
  await el.getByRole('button', { name: '13' }).click();
  await answerDialog(page, '3');

  expect(await setting(page, 'trueCount.resolution')).toBe('quarter');
  expect(await setting(page, 'trueCount.rounding')).toBe('floor');
  expect(await setting(page, 'trueCount.remainingCards')).toBe('dealt');
  expect(await setting(page, 'trueCount.aceSideCount')).toBe(true);
  expect(await setting(page, 'trueCount.allowedErrorCards')).toBe(3);
});

test.describe('Allowed Bets', () => {
  test('shows the count column only when betting errors are flagged', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
    // Warning on betting errors is on by default.
    await expect(el.locator('.bet-table tbody td').first()).toHaveText('<=0');
    await expect(el.getByText('Minimum bet count:')).toBeVisible();

    await el.getByRole('checkbox', { name: 'Warning on Betting Error' }).uncheck();
    await expect(el.locator('.bet-table tbody td').first()).toHaveText('-');
  });

  test('resizes the table and edits a row', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
    // The default ramp has six bets: 1, 2, 4, 6, 12 and 16 chips.
    await expect(el.locator('.bet-table tbody tr')).toHaveCount(6);

    await el.getByRole('button', { name: '6', exact: true }).click();
    await answerDialog(page, '3');
    await expect(el.locator('.bet-table tbody tr')).toHaveCount(3);

    await el.locator('.bet-table tbody tr').nth(2).click();
    const pad = page.locator('[data-screen="settings.betting.select"]');
    await expect(pad).toBeVisible();
    await pad.getByRole('button', { name: '3x' }).click();
    // 200 chips on three hands is over the limit, so that button is disabled.
    await expect(pad.getByRole('button', { name: '200', exact: true })).toBeDisabled();
    await pad.getByRole('button', { name: '25', exact: true }).click();

    await expect(el).toBeVisible();
    await expect(el.locator('.bet-table tbody tr').nth(2).locator('td').nth(1)).toHaveText('3x25');
    expect(await setting(page, 'betting.ramp')).toEqual({
      minCount: 0,
      rows: [
        { chips: 1, hands: 1 },
        { chips: 2, hands: 1 },
        { chips: 25, hands: 3 },
      ],
    });
  });

  test('takes a custom bet', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
    await el.locator('.bet-table tbody tr').first().click();
    const pad = page.locator('[data-screen="settings.betting.select"]');
    await pad.locator('[data-action="custom-bet"]').click();
    await answerDialog(page, '400');
    // Clamped to the 200 chip limit.
    await expect(el.locator('.bet-table tbody tr').first().locator('td').nth(1)).toHaveText('200');
  });

  test('sets the chip value', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
    await el.locator('select').selectOption('$25');
    expect(await setting(page, 'betting.chipValue')).toBe(25);
  });
});

test('opens a named table with one cell marked', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() =>
    window.app.open('strategy.tables', { view: 'split', highlight: { row: 2, column: 3 }, title: 'Last Error' }),
  );
  const screen = page.locator('[data-screen="strategy.tables"]:not([hidden])');
  await expect(screen.locator('.topbar__title')).toHaveText('Last Error');
  await expect(screen.locator('.tables__grid .grid__cell--marked')).toHaveCount(1);
  await expect(screen.locator('.tables__grid tbody tr').nth(2).locator('td').nth(4)).toHaveClass(/marked/);
});
