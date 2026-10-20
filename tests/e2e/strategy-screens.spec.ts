// Playing strategy, strategy tables, true count and betting, driven through
// the UI.
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { answerDialog, openFromHub, setting } from './support/settings';

test.use({ serviceWorkers: 'block' });

/** Picks one of a select's options. */
async function choose(screen: Locator, name: string, option: string) {
  await screen.getByRole('combobox', { name, exact: true }).selectOption({ label: option });
}

/** A strategy grid cell; the first cell of each body row is its label. */
const gridCell = (grid: Locator, row: number, column: number) =>
  grid
    .locator('tbody tr')
    .nth(row)
    .getByRole('cell')
    .nth(column + 1);

/** Opens Blackjack's options, which hold the game's own strategy screens, on a clean install. */
async function openHub(page: Page) {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-screen="home"] [data-action="play"]').click();
  await expect(page.locator('[data-screen="game.options"]')).toBeVisible();
}

test.describe('Playing Strategy', () => {
  test('changes the strategy, the index set, the range and the rules', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Playing Strategy', 'game.strategy');

    await choose(el, 'Strategy', 'Halves');
    expect(await setting(page, 'game.strategy.system')).toBe(32);

    await choose(el, 'Indices', 'Illustrious 18');
    expect(await setting(page, 'game.strategy.indexSet')).toBe('illustrious18');

    await el.getByRole('switch', { name: 'No hole card' }).check();
    expect(await setting(page, 'rules.noHoleCard')).toBe(true);

    await el.getByRole('button', { name: 'Index range minimum: -99' }).click();
    await answerDialog(page, '-4');
    expect(await setting(page, 'game.strategy.indexRangeMin')).toBe(-4);
  });
});

test.describe('Strategy tables', () => {
  test('shows the selected strategy and switches between the views', async ({ page }) => {
    await openHub(page);
    await page.evaluate(() => window.app.settings.set('game.strategy.system', 30));
    const strategy = await openFromHub(page, 'Playing Strategy', 'game.strategy');
    await strategy.getByRole('button', { name: 'Display Tables' }).click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await expect(el).toBeVisible();
    await expect(el.getByText('Basic High-Low', { exact: true })).toBeVisible();
    const legend = el.getByRole('list', { name: 'Legend' }).getByRole('listitem');
    // Hard Hit/Stand: 8 rows of 10 cells, 16 vs ten holds the famous index 0.
    const hard = el.getByRole('table', { name: 'Hard Hit/Stand' });
    await expect(hard.locator('tbody tr')).toHaveCount(8);
    await expect(gridCell(hard, 1, 8)).toHaveText('0');
    await expect(legend).toHaveText(['Hit', 'Stand', 'Hit < Value']);

    await choose(el, 'Table', 'Split');
    await expect(el.getByRole('table', { name: 'Split' }).locator('tbody tr')).toHaveCount(10);
    await expect(legend).toHaveText(['Split', 'No Split', 'Split >= Value', 'Split < Value']);

    await choose(el, 'Table', 'Insurance/Counts');
    await expect(el.getByRole('table', { name: 'Card Point Values' })).toBeVisible();
    await expect(el.getByRole('list', { name: 'Legend' })).toBeHidden();
    await expect(el.getByText('Specialty Plays')).toBeHidden();
  });

  test('picks custom index cells and uses them for the Custom index set', async ({ page }) => {
    await openHub(page);
    const strategy = await openFromHub(page, 'Playing Strategy', 'game.strategy');
    await strategy.locator('[data-action="select-indices"]').click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await expect(el.getByText('0 of 80 cells selected')).toBeVisible();
    await gridCell(el.getByRole('table', { name: 'Hard Hit/Stand' }), 1, 8).click();
    await expect(el.getByText('1 of 80 cells selected')).toBeVisible();
    expect(await page.evaluate(() => window.app.settings.get('game.strategy.customIndexMask').hardStand[1][8])).toBe(
      true,
    );

    await el.getByRole('button', { name: 'Back' }).click();
    await choose(strategy, 'Indices', 'Custom');
    // 16 vs ten keeps its index; 16 vs nine reverts to basic strategy (hit).
    const tables = await page.evaluate(() => {
      const t = window.app.strategies.current(window.app.settings, 'game', 6).tables.hardStand;
      return [t[1][8], t[1][7]];
    });
    expect(tables).toEqual([0, 32000]);
  });

  test('shades cells by error count', async ({ page }) => {
    await openHub(page);
    await page.evaluate(() => {
      window.app.errorTallies.record('hardStand', 1, 8);
    });
    const strategy = await openFromHub(page, 'Playing Strategy', 'game.strategy');
    await strategy.getByRole('button', { name: 'Display Tables' }).click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await el.getByRole('switch', { name: 'Shade error counts' }).check();
    const grid = el.getByRole('table', { name: 'Hard Hit/Stand' });
    await expect(gridCell(grid, 1, 8)).toHaveText('1');
    await expect(gridCell(grid, 1, 7)).toHaveText('');
    await expect(el.getByRole('list', { name: 'Legend' })).toBeHidden();
  });
});

test('True Count Calcs writes every control', async ({ page }) => {
  await openHub(page);
  const el = await openFromHub(page, 'True Count Conversion', 'game.trueCount');

  await choose(el, 'True Count Resolution', 'Quarter Deck');
  await choose(el, 'True Count Division', 'Floor');
  await choose(el, 'Remaining Cards', 'Cards dealt');
  await el.getByRole('switch', { name: 'Ace side count' }).check();
  await el.getByRole('button', { name: 'Allowed estimation error: 13' }).click();
  await answerDialog(page, '3');

  expect(await setting(page, 'game.trueCount.resolution')).toBe('quarter');
  expect(await setting(page, 'game.trueCount.rounding')).toBe('floor');
  expect(await setting(page, 'game.trueCount.remainingCards')).toBe('dealt');
  expect(await setting(page, 'game.trueCount.aceSideCount')).toBe(true);
  expect(await setting(page, 'game.trueCount.allowedErrorCards')).toBe(3);
});

const bets = (el: Locator) => el.getByRole('table', { name: 'Bets' });

test.describe('Allowed Bets', () => {
  test('shows the count column only when betting errors are flagged', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategy', 'game.betting');
    // Warning on betting errors is on by default.
    const firstCount = bets(el).locator('tbody tr').first().getByRole('cell').first();
    await expect(firstCount).toHaveText('<=0');
    await expect(el.getByRole('button', { name: /^Minimum bet count: / })).toBeVisible();

    await el.getByRole('switch', { name: 'Warning on Betting Error' }).uncheck();
    await expect(firstCount).toHaveText('-');
    await expect(el.getByRole('button', { name: /^Minimum bet count: / })).toBeHidden();
  });

  test('resizes the table and edits a row', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategy', 'game.betting');
    // The default ramp has six bets: 1, 2, 4, 6, 12 and 16 chips.
    await expect(bets(el).locator('tbody tr')).toHaveCount(6);

    await el.getByRole('button', { name: 'Number of bets: 6' }).click();
    await answerDialog(page, '3');
    await expect(bets(el).locator('tbody tr')).toHaveCount(3);

    await bets(el).locator('tbody tr').nth(2).click();
    const pad = page.locator('[data-screen="game.betting.select"]');
    await expect(pad).toBeVisible();
    await pad.getByRole('button', { name: '3x' }).click();
    // 200 chips on three hands is over the limit, so that button is disabled.
    await expect(pad.getByRole('button', { name: '200', exact: true })).toBeDisabled();
    await pad.getByRole('button', { name: '25', exact: true }).click();

    await expect(el).toBeVisible();
    await expect(bets(el).locator('tbody tr').nth(2).getByRole('cell').nth(1)).toHaveText('3x25');
    expect(await setting(page, 'game.betting.ramp')).toEqual({
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
    const el = await openFromHub(page, 'Betting Strategy', 'game.betting');
    await bets(el).locator('tbody tr').first().click();
    const pad = page.locator('[data-screen="game.betting.select"]');
    await pad.locator('[data-action="custom-bet"]').click();
    await answerDialog(page, '400');
    // Clamped to the 200 chip limit.
    await expect(bets(el).locator('tbody tr').first().getByRole('cell').nth(1)).toHaveText('200');
  });

  test('sets the chip value', async ({ page }) => {
    await openHub(page);
    const el = await openFromHub(page, 'Betting Strategy', 'game.betting');
    await choose(el, 'Chip Value', '$25');
    expect(await setting(page, 'game.betting.chipValue')).toBe(25);
  });
});

test('opens a named table with one cell marked', async ({ page }) => {
  // The viewer's options are its URL's search params.
  await page.goto('/index.html#/strategy/tables?view=split&row=2&column=3&title=Last+Error');
  const screen = page.locator('[data-screen="strategy.tables"]:not([hidden])');
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText('Last Error');
  const grid = screen.getByRole('table', { name: 'Split' });
  await expect(grid.locator('[data-marked]')).toHaveCount(1);
  await expect(gridCell(grid, 2, 3)).toHaveAttribute('data-marked');
});

test('Crack 33, picked on Playing Strategy, is what the game plays', async ({ page }) => {
  await openHub(page);
  await page.evaluate(() => window.app.settings.set('game.strategy.system', 31));
  const el = await openFromHub(page, 'Playing Strategy', 'game.strategy');
  await choose(el, 'Indices', 'Crack 33');
  expect(await setting(page, 'game.strategy.indexSet')).toBe('crack33');
  // 16 v X keeps its index; 12 v 5 is played by basic strategy.
  const cells = await page.evaluate(() => {
    const t = window.app.strategies.current(window.app.settings, 'game', 6).tables.hardStand;
    return [t[1][8], t[5][3]];
  });
  expect(cells).toEqual([0, -32000]);
});
