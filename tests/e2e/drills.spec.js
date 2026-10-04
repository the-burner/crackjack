// The four drills, driven through the running app: launch, answer right and
// wrong, watch the stats, pause, restart and go back.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Boolean grids shaped like the strategy tables. */
const emptyMask = () => Object.fromEntries(
  ['split', 'hardStand', 'softDouble', 'hardDouble', 'softStand', 'surrender']
    .map(name => [name, Array.from({ length: 10 }, () => new Array(10).fill(false))]),
);

/** Opens the app with the given settings already saved. */
async function open(page, settings = {}) {
  await page.addInitScript(values => {
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(values));
  }, settings);
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

const DRILLS = [
  { button: 'Flash Drills', options: 'drills.flash.options', play: 'drills.flash', title: 'Flash Options' },
  { button: 'Depth Drills', options: 'drills.depth.options', play: 'drills.depth', title: 'Depth Options' },
  { button: 'Count Drills', options: 'drills.count.options', play: 'drills.count', title: 'Count Options' },
  { button: 'Full Table Drills', options: 'drills.full.options', play: 'drills.full', title: 'Full Table Options' },
];

/** Launches a drill and waits out the "2, 1" countdown. */
async function launch(page, drill) {
  await page.getByRole('button', { name: drill.button }).click();
  const options = page.locator(`[data-screen="${drill.options}"]`);
  await expect(options).toBeVisible();
  await options.locator('[data-action="launch"]').click();
  const screen = page.locator(`[data-screen="${drill.play}"]`);
  await expect(screen).toBeVisible();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  return screen;
}

const statsText = screen => screen.locator('.drill__stats').innerText();

/** How many near-white pixels a canvas holds, i.e. whether cards are on it. */
const whitePixels = canvas => canvas.evaluate(el => {
  const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height);
  let white = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
  }
  return white;
});

/** Taps the cell at (row, column) of an answer grid. */
async function tapCell(screen, { row, column, rows, columns }) {
  const canvas = screen.locator('canvas.drill__answers');
  const box = await canvas.boundingBox();
  await canvas.click({
    position: { x: (box.width / columns) * (column + 0.5), y: (box.height / rows) * (row + 0.5) },
  });
}

/**
 * Taps cells of a 3 x 6 count grid until the test moves on, so the right answer
 * is certainly among them.
 */
async function tapEveryCell(page, screen, grid) {
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      if (!(await grid.isVisible())) return;
      await tapCell(screen, { row, column, rows: 3, columns: 6 });
      await page.waitForTimeout(120);
      if (!(await statsText(screen)).includes('Tests: 1')) return;
    }
  }
}

test('the home screen opens every drill options screen', async ({ page }) => {
  await open(page);
  for (const drill of DRILLS) {
    await page.getByRole('button', { name: drill.button }).click();
    const screen = page.locator(`[data-screen="${drill.options}"]`);
    await expect(screen).toBeVisible();
    await expect(screen.getByRole('heading')).toHaveText(drill.title);
    await expect(screen.getByRole('button', { name: 'Launch the Drill' })).toBeVisible();
    // Strategy and true count are shared settings, set only from Settings.
    await expect(screen.getByRole('button', { name: 'Playing Strategy' })).toHaveCount(0);
    await expect(screen.getByRole('button', { name: 'True Count Calcs' })).toHaveCount(0);
    await screen.locator('[data-action="back"]').click();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
  }
});

test.describe('flash drill', () => {
  /** Every hand is 16 against a ten at a count of zero, so Stand is right. */
  const FIXED_16_V_TEN = () => {
    const mask = emptyMask();
    mask.hardStand[1][8] = true;
    return {
      'drills.flash.hands': 'custom',
      'drills.flash.customHands': mask,
      'drills.flash.situations': { hardStand: true, softStand: false, hardDouble: false, softDouble: false, split: false, surrender: false },
      'drills.flash.countMode': 'fixed',
      'drills.flash.fixedCount': 0,
      'drills.flash.maxCards': 2,
      'drills.flash.seconds': 60,
      'drills.flash.handsPerDrill': 3,
      'strategy.system': 30,
    };
  };

  test('counts every hand and ends after the last one', async ({ page }) => {
    // Ten hands is the smallest a drill may be.
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd', 'drills.flash.handsPerDrill': 10 });
    const screen = await launch(page, DRILLS[0]);
    await expect(screen.locator('.drill__stats')).toContainText('Hands: 1');

    await screen.locator('[data-action="hit"]').click();
    expect(await statsText(screen)).toContain('Hands: 2');
    // "Errors at end" keeps the accuracy hidden while the drill runs.
    expect(await statsText(screen)).toContain('Displayed at end');

    for (let hand = 2; hand < 10; hand++) await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 10');

    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 10');
    // The closing accuracy is painted over the cards.
    expect(await whitePixels(screen.locator('canvas.drill__cards'))).toBeGreaterThan(0);
  });

  test('explains a wrong answer and keeps the hand until it is right', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS[0]);

    await screen.locator('[data-action="hit"]').click();
    const dialog = page.locator('.dialog');
    await expect(dialog).toContainText('Action: Hit; Correct: Stand');
    await expect(dialog).toContainText('Dealer: T');
    await dialog.getByRole('button', { name: 'OK' }).click();

    // The same hand is still on screen, and Stand is marked as the right answer.
    expect(await statsText(screen)).toContain('Hands: 1');
    expect(await statsText(screen)).toContain('Accuracy: 0%');
    await expect(screen.locator('[data-action="stand"]')).toHaveClass(/is-correct/);

    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 2');
    // The second hand starts clean, and a right answer keeps the accuracy.
    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Accuracy: 66%');
  });

  test('shows the strategy table for a wrong answer', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS[0]);
    await screen.locator('[data-action="hit"]').click();
    await page.locator('.dialog').getByRole('button', { name: 'Table' }).click();
    const tables = page.locator('[data-screen="strategy.tables"]');
    await expect(tables).toBeVisible();
    // It opens on the table that decided, with the offending cell marked.
    await expect(tables.getByRole('heading')).toHaveText('Hard H/S');
    await expect(tables.locator('.tables__grid td.grid__cell--marked')).toHaveCount(1);
    await page.locator('[data-screen="strategy.tables"] [data-action="back"]').click();
    await expect(screen).toBeVisible();
  });

  test('pauses, restarts and goes back', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.handsPerDrill': 50, 'drills.flash.testMode': 'errorsAtEnd' });
    const screen = await launch(page, DRILLS[0]);
    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 2');

    const pause = screen.getByRole('button', { name: 'Pause' });
    await pause.click();
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    // The thrown-away hand does not count.
    expect(await statsText(screen)).toContain('Hands: 1');
    await screen.getByRole('button', { name: 'Continue' }).click();
    await expect(pause).toBeVisible();
    expect(await statsText(screen)).toContain('Hands: 2');

    await screen.getByRole('button', { name: 'Restart' }).click();
    expect(await statsText(screen)).toContain('Hands: 1');

    await screen.locator('[data-action="back"], .drill__bar button').first().click();
    await expect(page.locator('[data-screen="drills.flash.options"]')).toBeVisible();
  });

  test('refuses to launch without a situation, and with no tests on a clock', async ({ page }) => {
    await open(page, {
      'drills.flash.situations': { hardStand: false, softStand: false, hardDouble: false, softDouble: false, split: false, surrender: false },
    });
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    await page.locator('[data-action="launch"]').click();
    await expect(page.locator('.dialog')).toContainText('No situations have been selected');
    await page.locator('.dialog').getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('[data-screen="drills.flash"]')).toHaveCount(0);
  });

  test('asks for an index instead of a play in the index test', async ({ page }) => {
    await open(page, {
      'drills.flash.hands': 'illustrious18',
      'drills.flash.countMode': 'indexTest',
      'drills.flash.seconds': 60,
    });
    const screen = await launch(page, DRILLS[0]);
    await expect(screen.locator('canvas.drill__answers')).toBeVisible();
    await expect(screen.locator('[data-action="stand"]')).toBeHidden();
    await expect(screen.locator('.drill__count')).not.toBeEmpty();
  });
});

test.describe('depth drill', () => {
  test('grades taps on the depth grid and counts the errors', async ({ page }) => {
    await open(page, { 'drills.depth.decks': 2, 'drills.depth.resolution': 'full', 'drills.depth.seconds': 60, 'drills.depth.accuracy': 0 });
    const screen = await launch(page, DRILLS[1]);
    expect(await statsText(screen)).toContain('Tests: 1');

    // Two decks at full resolution offer one answer: "1".
    await tapCell(screen, { row: 0, column: 1, rows: 1, columns: 2 });
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
    expect(await statsText(screen)).toContain('Accuracy: 100%');
  });

  test('counts a wrong tap as an error', async ({ page }) => {
    await open(page, { 'drills.depth.decks': 6, 'drills.depth.resolution': 'full', 'drills.depth.seconds': 60, 'drills.depth.accuracy': 0 });
    const screen = await launch(page, DRILLS[1]);
    // Six decks at full resolution offer 1..5. Tapping each in turn reaches the
    // right one, and every tap before it is an error. The answer is random, so
    // the first tap may happen to be right; keep going until a test has had a
    // wrong tap (five tests in a row answered first time is a 1-in-3125 chance).
    for (let test = 1; test <= 5; test++) {
      for (let column = 1; column < 6; column++) {
        await tapCell(screen, { row: 0, column, rows: 1, columns: 6 });
        await page.waitForTimeout(200);
        if ((await statsText(screen)).includes(`Tests: ${test + 1}`)) break;
      }
      if (!(await statsText(screen)).includes('Accuracy: 100%')) break;
    }
    expect(await statsText(screen)).not.toContain('Accuracy: 100%');
  });

  test('restarts and goes back', async ({ page }) => {
    await open(page, { 'drills.depth.seconds': 60 });
    const screen = await launch(page, DRILLS[1]);
    await screen.getByRole('button', { name: 'Restart' }).click();
    expect(await statsText(screen)).toContain('Tests: 1');
    await screen.locator('.drill__bar button').first().click();
    await expect(page.locator('[data-screen="drills.depth.options"]')).toBeVisible();
  });

  test('moves the tray style up when it cannot hold the decks in play', async ({ page }) => {
    await open(page, { 'drills.depth.decks': 6, 'drills.depth.trayStyle': 'doubleDeckFront' });
    await page.getByRole('button', { name: 'Depth Drills' }).click();
    const options = page.locator('[data-screen="drills.depth.options"]');
    await options.locator('[data-action="launch"]').click();
    await expect(page.locator('.dialog')).toContainText('only holds 2 decks');
    await page.locator('.dialog').getByRole('button', { name: 'OK' }).click();
    await expect(options.locator('select[name="drills.depth.trayStyle"]')).toHaveValue('Six-deck tray, front');
  });
});

test.describe('count drill', () => {
  test('deals flashes, asks for the count and grades the answer', async ({ page }) => {
    await open(page, {
      'drills.count.testEvery': 'everyCard',
      'drills.count.dealTenths': 2,
      'drills.count.testSeconds': 15,
      'drills.count.accuracy': 0,
      'strategy.system': 30,
    });
    const screen = await launch(page, DRILLS[2]);
    const grid = screen.locator('canvas.drill__answers');
    await expect(grid).toBeVisible({ timeout: 5000 });
    expect(await statsText(screen)).toContain('Tests: 1');

    // Every cell of the grid, so the right answer is certainly among them.
    await tapEveryCell(page, screen, grid);
    // The right answer was among them, so dealing resumed and a second test came.
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
    expect(await statsText(screen)).not.toContain('Accuracy: 100%');
  });

  test('lets the player deal by hand in the count-down modes', async ({ page }) => {
    await open(page, { 'drills.count.timerMode': 'countDown', 'drills.count.alarmSeconds': 300, 'drills.count.testEvery': 'never' });
    const screen = await launch(page, DRILLS[2]);
    const next = screen.getByRole('button', { name: 'Next' });
    const cards = screen.locator('canvas.drill__cards');
    await expect(next).toBeVisible();
    expect(await whitePixels(cards)).toBe(0);
    await next.click();
    expect(await whitePixels(cards)).toBeGreaterThan(0);
  });
});

test.describe('full table drill', () => {
  test('asks for a wide screen while the device is upright', async ({ page }) => {
    await open(page);
    const screen = await launch(page, DRILLS[3]);
    await expect(screen.locator('.drill__cover')).toBeVisible();
    await expect(screen.locator('.drill__cover')).toContainText('Turn the device sideways');
    // The title bar stays usable over the cover.
    await screen.locator('.drill__bar button').first().click();
    await expect(page.locator('[data-screen="drills.full.options"]')).toBeVisible();
  });

  test('deals a table and grades the count in landscape', async ({ page }) => {
    await open(page, { 'drills.full.testSeconds': 40, 'drills.full.accuracy': 0 });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS[3]);
    await expect(screen.locator('.drill__cover')).toBeHidden();
    const grid = screen.locator('canvas.drill__answers');
    await expect(grid).toBeVisible();
    expect(await statsText(screen)).toContain('Tests: 1');

    await tapEveryCell(page, screen, grid);
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
  });

  test('refuses scattered cards with the Two Tables drill', async ({ page }) => {
    await open(page, { 'drills.full.drill': 'twoTables', 'drills.full.handStyle': 'scattered' });
    await page.getByRole('button', { name: 'Full Table Drills' }).click();
    await page.locator('[data-action="launch"]').click();
    await expect(page.locator('.dialog')).toContainText('Scattered Cards is not supported');
  });
});

test('the drills record errors that the Flash options screen can clear', async ({ page }) => {
  const mask = emptyMask();
  mask.hardStand[1][8] = true;
  await open(page, {
    'drills.flash.hands': 'custom',
    'drills.flash.customHands': mask,
    'drills.flash.situations': { hardStand: true, softStand: false, hardDouble: false, softDouble: false, split: false, surrender: false },
    'drills.flash.countMode': 'fixed',
    'drills.flash.maxCards': 2,
    'drills.flash.seconds': 60,
    'drills.flash.testMode': 'errorsAtEnd',
    'strategy.system': 30,
  });
  const screen = await launch(page, DRILLS[0]);
  await screen.locator('[data-action="hit"]').click();
  await screen.locator('.drill__bar button').first().click();

  const options = page.locator('[data-screen="drills.flash.options"]');
  await options.locator('select[name="drills.flash.hands"]').selectOption({ label: 'Hands: Drill Errors' });
  await expect(options.locator('.drill-options__note')).toContainText('Hard H/S 16 v T');

  await options.getByRole('button', { name: 'Clear error history' }).click();
  await page.locator('.dialog').getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('.toast')).toHaveText('Error history cleared');
  await expect(options.locator('.drill-options__note')).toContainText('No errors have been recorded');
});
