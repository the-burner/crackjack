// Playing strategy, strategy tables, import, true count, betting and the
// casino database, driven through the UI.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Opens the settings hub on a clean install. */
async function openHub(page) {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
}

async function openScreen(page, button, screen) {
  await page.locator('[data-screen="settings"]').getByRole('button', { name: button, exact: true }).click();
  const el = page.locator(`[data-screen="${screen}"]`);
  await expect(el).toBeVisible();
  return el;
}

/**
 * Answers the next dialog with `text` (or just OK when text is null) and waits
 * for that dialog to go away — a dialog may be replaced by another one.
 */
async function answerDialog(page, text = null) {
  const overlay = page.locator('.dialog-overlay').first();
  await expect(overlay).toBeVisible();
  const handle = await overlay.elementHandle();
  if (text !== null) await overlay.locator('.dialog__input').fill(text);
  await overlay.getByRole('button').first().click();
  await page.waitForFunction(el => !el.isConnected, handle);
}

const setting = (page, key) => page.evaluate(k => window.app.settings.get(k), key);

test.describe('Playing Strategy', () => {
  test('changes the strategy, the index set, the range and the rules', async ({ page }) => {
    await openHub(page);
    const el = await openScreen(page, 'Playing Strategies', 'settings.strategy');

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

  test('offers to delete an imported strategy, and only then', async ({ page }) => {
    await openHub(page);
    const el = await openScreen(page, 'Playing Strategies', 'settings.strategy');
    const deleteButton = el.getByRole('button', { name: 'Delete Imported Strategy' });
    await expect(deleteButton).toBeHidden();

    // Add an imported strategy the way the import screen does.
    await page.evaluate(() => {
      const text = window.app.strategies.text(30).replace('Basic High-Low', 'My Strategy');
      window.app.settings.set('strategy.system', window.app.strategies.add(text));
    });
    await el.getByRole('button', { name: 'Back' }).click();
    await openScreen(page, 'Playing Strategies', 'settings.strategy');
    await expect(el.locator('select').first()).toHaveValue('My Strategy');
    await expect(deleteButton).toBeVisible();

    await deleteButton.click();
    await answerDialog(page);
    await answerDialog(page);
    expect(await page.evaluate(() => window.app.strategies.custom().length)).toBe(0);
    expect(await setting(page, 'strategy.system')).toBe(30);
  });
});

test.describe('Strategy tables', () => {
  test('shows the selected strategy and switches between the views', async ({ page }) => {
    await openHub(page);
    const strategy = await openScreen(page, 'Playing Strategies', 'settings.strategy');
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
    await expect(el.locator('.tables__legend-box')).toHaveText(['Split', 'No Split', 'Split >= Value', 'Split < Value']);

    await el.locator('select').selectOption('Insurance/Counts');
    await expect(el.locator('.tables__counts')).toContainText('Card Point Values');
    await expect(el.locator('.tables__below')).toBeHidden();
  });

  test('picks custom index cells and uses them for the Custom index set', async ({ page }) => {
    await openHub(page);
    const strategy = await openScreen(page, 'Playing Strategies', 'settings.strategy');
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
    await page.evaluate(() => { window.app.errorTallies.record('hardStand', 1, 8); });
    const strategy = await openScreen(page, 'Playing Strategies', 'settings.strategy');
    await strategy.getByRole('button', { name: 'Display Tables' }).click();

    const el = page.locator('[data-screen="strategy.tables"]');
    await el.getByRole('checkbox', { name: 'Shade error counts' }).check();
    await expect(el.locator('.tables__grid td[data-row="1"][data-col="8"]')).toHaveText('1');
    await expect(el.locator('.tables__grid td[data-row="1"][data-col="7"]')).toHaveText('');
    await expect(el.locator('.tables__legend')).toBeHidden();
  });
});

test.describe('Import Strategy', () => {
  test('stores a downloaded strategy and selects it', async ({ page }) => {
    await openHub(page);
    const strategy = await openScreen(page, 'Playing Strategies', 'settings.strategy');
    await strategy.getByRole('button', { name: 'Import Strategy' }).click();
    const el = page.locator('[data-screen="strategy.import"]');
    await expect(el).toBeVisible();

    const file = await page.evaluate(() => window.app.strategies.text(32).replace('Halves', 'Imported Halves'));
    await page.route('**/Apps/z777.php', route => route.fulfill({ body: file.replace('Imported Halves', 'Imported%20Halves') }));

    await el.locator('[data-action="code"]').click();
    await answerDialog(page, '777');
    await expect(el.locator('[data-action="code"]')).toHaveText('777');
    await el.locator('[data-action="import"]').click();
    await answerDialog(page);

    await expect(strategy).toBeVisible();
    await expect(strategy.locator('select').first()).toHaveValue('Imported Halves');
    expect(await setting(page, 'strategy.system')).toBe(1001);
  });

  test('reports a bad code', async ({ page }) => {
    await openHub(page);
    const strategy = await openScreen(page, 'Playing Strategies', 'settings.strategy');
    await strategy.getByRole('button', { name: 'Import Strategy' }).click();
    const el = page.locator('[data-screen="strategy.import"]');

    await page.route('**/Apps/z1.php', route => route.fulfill({ status: 500, body: 'error' }));
    await el.locator('[data-action="code"]').click();
    await answerDialog(page, '1');
    await el.locator('[data-action="import"]').click();
    await expect(page.locator('.dialog__body')).toHaveText('File could not be read: 500');
    await answerDialog(page);
    expect(await page.evaluate(() => window.app.strategies.custom().length)).toBe(0);
  });
});

test('True Count Calcs writes every control', async ({ page }) => {
  await openHub(page);
  const el = await openScreen(page, 'True Count Calcs', 'settings.trueCount');

  await el.locator('select').nth(0).selectOption('Quarter Deck');
  await el.locator('select').nth(2).selectOption('Floor');
  await el.locator('select').nth(3).selectOption('Cards dealt');
  await el.getByRole('checkbox', { name: 'Ace side count' }).check();
  await el.getByRole('button', { name: '0' }).click();
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
    const el = await openScreen(page, 'Betting Strategies', 'settings.betting');
    await expect(el.locator('.bet-table tbody td').first()).toHaveText('-');

    await el.getByRole('checkbox', { name: 'Warning on Betting Error' }).check();
    await expect(el.locator('.bet-table tbody td').first()).toHaveText('<=0');
    await expect(el.getByText('Minimum bet count:')).toBeVisible();
  });

  test('resizes the table and edits a row', async ({ page }) => {
    await openHub(page);
    const el = await openScreen(page, 'Betting Strategies', 'settings.betting');
    await expect(el.locator('.bet-table tbody tr')).toHaveCount(5);

    await el.getByRole('button', { name: '5', exact: true }).click();
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
      rows: [{ chips: 1, hands: 1 }, { chips: 2, hands: 1 }, { chips: 25, hands: 3 }],
    });
  });

  test('takes a custom bet', async ({ page }) => {
    await openHub(page);
    const el = await openScreen(page, 'Betting Strategies', 'settings.betting');
    await el.locator('.bet-table tbody tr').first().click();
    const pad = page.locator('[data-screen="settings.betting.select"]');
    await pad.locator('[data-action="custom-bet"]').click();
    await answerDialog(page, '400');
    // Clamped to the 200 chip limit.
    await expect(el.locator('.bet-table tbody tr').first().locator('td').nth(1)).toHaveText('200');
  });

  test('sets the chip value', async ({ page }) => {
    await openHub(page);
    const el = await openScreen(page, 'Betting Strategies', 'settings.betting');
    await el.locator('select').selectOption('$25');
    expect(await setting(page, 'betting.chipValue')).toBe(25);
  });
});

const CBJN_ID = '8997783';
const RECORDS = [
  'Aliante (Boyd)^U.S.^Nevada^Aliante (Boyd), 7300 Aliante Pkwy.^7^40^Las Vegas^h17,ds,nm,sc,pv^15^1000^2^9',
  'Aria (MGM)^U.S.^Nevada^Aria (MGM), 3730 S. Las Vegas Blvd.^15^26^Las Vegas^s17,ds,ls,rsa,pv^500^10000^6^4',
];
const CBJN_BODY = `              ${CBJN_ID}~10/1/2026|\r\n              ${RECORDS.join('|\r\n              ')}|   `;

test.describe('Casino Database', () => {
  test('updates, searches and loads a casino\'s rules', async ({ page }) => {
    await openHub(page);
    await page.route('**/apps/cbjn7.php**', route => route.fulfill({ body: CBJN_BODY }));
    const el = await openScreen(page, 'Casino Database', 'settings.casinoDb');
    await expect(el.locator('.casino__note')).toBeVisible();
    await expect(el.locator('[data-action="last-update"]')).toHaveText('Last Update: Never');

    await el.locator('[data-action="cbjn-id"]').click();
    await answerDialog(page, CBJN_ID);
    await el.locator('[data-action="update"]').click();
    await answerDialog(page);
    await expect(el.locator('[data-action="last-update"]')).toHaveText('Last Update: 10/1/2026');
    await expect(el.locator('.casino__note')).toBeHidden();

    await el.locator('[data-action="search"]').click();
    await answerDialog(page, 'aria');
    await expect(el.locator('.casino__item')).toHaveCount(1);

    await el.locator('.casino__item').click();
    const detail = page.locator('[data-screen="settings.casinoDetail"]');
    await expect(detail).toBeVisible();
    await expect(detail.locator('tr').first()).toContainText('Aria (MGM)');

    await detail.locator('[data-action="load-rules"]').click();
    await answerDialog(page);
    expect(await setting(page, 'table.decks')).toBe(6);
    expect(await setting(page, 'table.cardsBehindCutCard')).toBe(78);
    expect(await setting(page, 'rules.dealerHitsSoft17')).toBe(false);
    expect(await setting(page, 'rules.surrender')).toBe('late');
    expect(await setting(page, 'rules.resplitAces')).toBe(true);
  });

  test('rejects a CBJN id the database does not match', async ({ page }) => {
    await openHub(page);
    await page.route('**/apps/cbjn7.php**', route => route.fulfill({ body: CBJN_BODY }));
    const el = await openScreen(page, 'Casino Database', 'settings.casinoDb');
    await el.locator('[data-action="cbjn-id"]').click();
    await answerDialog(page, '1234');
    await el.locator('[data-action="update"]').click();
    await expect(page.locator('.dialog__body')).toHaveText('Incorrect CBJN id.');
    await answerDialog(page);
    await expect(el.locator('[data-action="last-update"]')).toHaveText('Last Update: Never');
  });
});
