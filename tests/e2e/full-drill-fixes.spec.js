// Fixes to the Full Table drill that only show up in the running app: the
// crash at the end of a Two Tables run, double taps, pausing, the portrait
// cover, Two Counts and the test left on screen when time runs out.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const LANDSCAPE = { width: 844, height: 390 };

/** Opens the app with the given settings already saved. */
async function open(page, settings = {}) {
  await page.addInitScript(values => {
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(values));
  }, settings);
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

/** Launches the Full Table drill and waits out the "2, 1" countdown. */
async function launch(page) {
  await page.getByRole('button', { name: 'Full Table Drills' }).click();
  const options = page.locator('[data-screen="drills.full.options"]');
  await expect(options).toBeVisible();
  await options.locator('[data-action="launch"]').click();
  const screen = page.locator('[data-screen="drills.full"]');
  await expect(screen).toBeVisible();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  return screen;
}

const testsCount = async screen => {
  const text = await screen.locator('.drill__stats').innerText();
  return Number(/Tests: (\d+)/.exec(text)[1]);
};

/** How many near-white pixels a canvas holds, i.e. whether cards are on it. */
const whitePixels = canvas =>
  canvas.evaluate(el => {
    const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height);
    let white = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white += 1;
    }
    return white;
  });

const cellPosition = (box, row, column) => ({ x: (box.width / 6) * (column + 0.5), y: (box.height / 3) * (row + 0.5) });

async function tapCell(screen, row, column, { twice = false } = {}) {
  const canvas = screen.locator('canvas.drill__answers');
  const box = await canvas.boundingBox();
  const options = { position: cellPosition(box, row, column), timeout: 3000 };
  if (twice) await canvas.dblclick(options);
  else await canvas.click(options);
}

/** Taps cells until the test count moves on, since the right answer is unknown. */
async function answerUntilNextTest(page, screen, taps = 18) {
  const grid = screen.locator('canvas.drill__answers');
  const before = await testsCount(screen);
  for (let i = 0; i < taps; i++) {
    if (!(await grid.isVisible())) return;
    try {
      await tapCell(screen, i % 3, Math.floor(i / 3) % 6);
    } catch {
      // The shoe can run out between the check and the tap, taking the grid away.
      return;
    }
    await page.waitForTimeout(80);
    if ((await testsCount(screen)) !== before) return;
  }
}

test('Two Tables runs its shoe out without crashing', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, {
    'drills.full.drill': 'twoTables',
    'drills.full.decks': 1,
    'drills.full.players': 6,
    'drills.full.timerMode': 'auto',
    'drills.full.testSeconds': 40,
    'drills.full.flashSpeed': 30,
    'drills.full.accuracy': 0,
  });
  await page.setViewportSize(LANDSCAPE);
  const screen = await launch(page);
  const grid = screen.locator('canvas.drill__answers');
  await expect(grid).toBeVisible();
  for (let question = 0; question < 16; question++) {
    if (!(await grid.isVisible())) break;
    await answerUntilNextTest(page, screen, 36);
  }
  expect(errors).toEqual([]);
  await expect(grid).toBeHidden();
});

test('a double tap on the right answer moves on by one test, not two', async ({ page }) => {
  await open(page, {
    'drills.full.timerMode': 'auto',
    'drills.full.testSeconds': 40,
    'drills.full.flashSpeed': 30,
    'drills.full.accuracy': 0,
  });
  await page.setViewportSize(LANDSCAPE);
  const screen = await launch(page);
  await expect(screen.locator('canvas.drill__answers')).toBeVisible();
  for (let i = 0; i < 18 && (await testsCount(screen)) === 1; i++) {
    await tapCell(screen, i % 3, Math.floor(i / 3), { twice: true });
    await page.waitForTimeout(150);
  }
  expect(await testsCount(screen)).toBe(2);
});

test('resuming after a pause gives back only the time that was left', async ({ page }) => {
  await open(page, { 'drills.full.timerMode': 'auto', 'drills.full.testSeconds': 40, 'drills.full.flashSpeed': 8 });
  await page.setViewportSize(LANDSCAPE);
  const screen = await launch(page);
  const cards = screen.locator('canvas.drill__cards');
  expect(await whitePixels(cards)).toBeGreaterThan(0);

  // Pause with about two seconds of the flash left.
  await page.waitForTimeout(6000);
  await screen.getByRole('button', { name: 'Pause' }).click();
  expect(await whitePixels(cards)).toBe(0);
  await screen.getByRole('button', { name: 'Continue' }).click();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  expect(await whitePixels(cards)).toBeGreaterThan(0);
  await page.waitForTimeout(3500);
  expect(await whitePixels(cards)).toBe(0);
});

test('nothing is dealt or timed while the turn-sideways cover is up', async ({ page }) => {
  await open(page, { 'drills.full.timerMode': 'auto', 'drills.full.testSeconds': 1, 'drills.full.flashSpeed': 1 });
  const screen = await launch(page);
  await expect(screen.locator('.drill__cover')).toBeVisible();
  await page.waitForTimeout(4000);
  expect(await testsCount(screen)).toBe(0);

  await page.setViewportSize(LANDSCAPE);
  await expect(screen.locator('.drill__cover')).toBeHidden();
  await expect(screen.locator('.drill__stats')).toContainText('Tests: 1');
});

test('Two Counts asks two answers for one test, flashed once', async ({ page }) => {
  test.setTimeout(90000);
  await open(page, {
    'drills.full.twoCounts': true,
    'drills.full.drill': 'acesDealt',
    'drills.full.timerMode': 'auto',
    'drills.full.testSeconds': 40,
    'drills.full.flashSpeed': 3,
    'drills.full.accuracy': 0,
  });
  await page.setViewportSize(LANDSCAPE);
  const screen = await launch(page);
  const cards = screen.locator('canvas.drill__cards');
  // Once the flash is over, a second test can only mean a second table.
  await expect.poll(() => whitePixels(cards), { timeout: 8000 }).toBe(0);
  await answerUntilNextTest(page, screen, 72);
  expect(await testsCount(screen)).toBe(2);
  expect(await whitePixels(cards)).toBeGreaterThan(0);
});

test('an unanswered test is not scored when the drill time runs out', async ({ page }) => {
  await open(page, {
    'drills.full.timerMode': 'countDownHalt',
    'drills.full.alarmSeconds': 10,
    'drills.full.flashSpeed': 30,
  });
  await page.setViewportSize(LANDSCAPE);
  const screen = await launch(page);
  const stats = screen.locator('.drill__stats');
  await expect(stats).toContainText('Tests: 1');
  await expect(screen.locator('canvas.drill__answers')).toBeHidden({ timeout: 20000 });
  await expect(stats).toContainText('Tests: 0');
  await expect(stats).toContainText('Accuracy: 0%');
});

test('the options screen hides Two Counts for the Running Count drill', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Full Table Drills' }).click();
  const options = page.locator('[data-screen="drills.full.options"]');
  const twoCounts = options.getByRole('checkbox', { name: 'Two Counts' });
  const drill = options.locator('select[name="drills.full.drill"]');
  // Running Count is the saved default.
  await expect(twoCounts).toBeHidden();

  await drill.selectOption({ label: 'Drill: Aces Left' });
  await expect(twoCounts).toBeVisible();
  await drill.selectOption({ label: 'Drill: Running Count' });
  await expect(twoCounts).toBeHidden();
});
