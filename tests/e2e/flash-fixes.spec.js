// Flash drill regressions: what the index test may ask, where the random count
// sits, and what the clock, the Pause button and the grid do once a drill is
// over or has no tests to grade.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Boolean grids shaped like the strategy tables. */
const emptyMask = () =>
  Object.fromEntries(
    ['split', 'hardStand', 'softDouble', 'hardDouble', 'softStand', 'surrender'].map(name => [
      name,
      Array.from({ length: 10 }, () => new Array(10).fill(false)),
    ]),
  );

const ONLY_HARD_STAND = {
  hardStand: true,
  softStand: false,
  hardDouble: false,
  softDouble: false,
  split: false,
  surrender: false,
};

/** Opens the app with the given settings already saved. */
async function open(page, settings = {}) {
  await page.addInitScript(values => {
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(values));
  }, settings);
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

/** Launches the Flash drill and waits out the "2, 1" countdown. */
async function launch(page) {
  await page.getByRole('button', { name: 'Flash Drills' }).click();
  await page.locator('[data-screen="drills.flash.options"] [data-action="launch"]').click();
  const screen = page.locator('[data-screen="drills.flash"]');
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  return screen;
}

const statsText = screen => screen.locator('.drill__stats').innerText();

/** Every hand is 16 against a ten at a count of zero, so Stand is right. */
const FIXED_16_V_TEN = () => {
  const mask = emptyMask();
  mask.hardStand[1][8] = true;
  return {
    'drills.flash.hands': 'custom',
    'drills.flash.customHands': mask,
    'drills.flash.situations': ONLY_HARD_STAND,
    'drills.flash.countMode': 'fixed',
    'drills.flash.fixedCount': 0,
    'drills.flash.maxCards': 2,
    'drills.flash.timerMode': 'auto',
    'drills.flash.seconds': 60,
    'drills.flash.handsPerDrill': 10,
    'strategy.system': 30,
  };
};

test('the index test refuses a hand that has no index of its own', async ({ page }) => {
  // Hard 17 against a six is always Stand, so there is no index to be asked for.
  const mask = emptyMask();
  mask.hardStand[0][4] = true;
  await open(page, {
    'drills.flash.hands': 'custom',
    'drills.flash.customHands': mask,
    'drills.flash.situations': ONLY_HARD_STAND,
    'drills.flash.countMode': 'indexTest',
    'drills.flash.maxCards': 2,
    'drills.flash.timerMode': 'infinite',
    'drills.flash.timePerHand': false,
    'strategy.system': 30,
  });
  const screen = await launch(page);
  await expect(screen.locator('.drill__message')).toContainText('no tests configured');
  expect(await statsText(screen)).toContain('Hands: 0');
});

test('the random count straddles zero for a balanced system', async ({ page }) => {
  await open(page, {
    'drills.flash.countMode': 'random',
    'drills.flash.maxCards': 2,
    'drills.flash.timerMode': 'infinite',
    'drills.flash.timePerHand': false,
    'drills.flash.testMode': 'errorsAtEnd',
  });
  const screen = await launch(page);
  const hit = screen.locator('[data-action="hit"]');
  const counts = [];
  for (let hand = 0; hand < 40; hand++) {
    counts.push(Number((await screen.locator('.drill__count').innerText()).replace('Count: ', '')));
    await hit.click();
  }
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  expect(Math.abs(mean)).toBeLessThan(1.5);
});

test('pause does nothing once the drill has finished', async ({ page }) => {
  await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd' });
  const screen = await launch(page);
  for (let hand = 0; hand < 10; hand++) await screen.locator('[data-action="stand"]').click();
  expect(await statsText(screen)).toContain('Hands: 10');

  await screen.getByRole('button', { name: 'Pause' }).click();
  await screen.getByRole('button', { name: 'Continue' }).click();
  await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled({ timeout: 5000 });
  expect(await statsText(screen)).toContain('Hands: 10');
});

test('the clock stops while the strategy table covers the drill', async ({ page }) => {
  await open(page, {
    ...FIXED_16_V_TEN(),
    'drills.flash.testMode': 'warn',
    'drills.flash.timerMode': 'infinite',
    'drills.flash.timePerHand': false,
  });
  const screen = await launch(page);
  await screen.locator('[data-action="hit"]').click();
  await page.locator('.dialog').getByRole('button', { name: 'Table' }).click();
  await expect(page.locator('[data-screen="strategy.tables"]')).toBeVisible();
  await page.waitForTimeout(4000);
  await page.locator('[data-screen="strategy.tables"] [data-action="back"]').click();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  expect(await statsText(screen)).toMatch(/Time: 00:00:0[0-2]/);
});

test('no tests mode neither grades the index test nor records an error', async ({ page }) => {
  await open(page, {
    'drills.flash.hands': 'illustrious18',
    'drills.flash.countMode': 'indexTest',
    'drills.flash.testMode': 'none',
    'drills.flash.timerMode': 'infinite',
    'drills.flash.seconds': 60,
  });
  const screen = await launch(page);
  const grid = screen.locator('canvas.drill__answers');
  const box = await grid.boundingBox();
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      await grid.click({ position: { x: (box.width / 6) * (column + 0.5), y: (box.height / 3) * (row + 0.5) } });
    }
  }
  expect(await statsText(screen)).toContain('Hands: 19');
  expect(await statsText(screen)).toContain('No Tests');
  expect(await page.evaluate(() => localStorage.getItem('cj.errorTallies'))).toBe(null);
});

test('an unanswered hand is not scored when the clock halts', async ({ page }) => {
  await open(page, {
    ...FIXED_16_V_TEN(),
    'drills.flash.testMode': 'warn',
    'drills.flash.timerMode': 'countDownHalt',
    'drills.flash.drillSeconds': 10,
  });
  const screen = await launch(page);
  expect(await statsText(screen)).toContain('Hands: 1');
  await expect.poll(() => statsText(screen), { timeout: 20000 }).toContain('Hands: 0');
  expect(await statsText(screen)).toContain('Accuracy: 0%');
});

test('the index test grid leaves the cards on screen in landscape', async ({ page }) => {
  await open(page, {
    'drills.flash.hands': 'illustrious18',
    'drills.flash.countMode': 'indexTest',
    'drills.flash.timerMode': 'infinite',
    'drills.flash.timePerHand': false,
  });
  for (const size of [
    { width: 844, height: 390 },
    { width: 568, height: 320 },
    { width: 926, height: 428 },
  ]) {
    await page.setViewportSize(size);
    const screen = page.locator('[data-screen="drills.flash"]');
    if (!(await screen.count())) await launch(page);
    const display = await screen.locator('.drill__display').boundingBox();
    expect(display.y + display.height, `${size.width}x${size.height}`).toBeLessThanOrEqual(size.height);
  }
});

test('the closing text is set in the app font', async ({ page }) => {
  await page.addInitScript(() => {
    const { get, set } = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
    window.canvasFonts = [];
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
      get() {
        return get.call(this);
      },
      set(value) {
        window.canvasFonts.push(value);
        set.call(this, value);
      },
    });
  });
  await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd' });
  const screen = await launch(page);
  for (let hand = 0; hand < 10; hand++) await screen.locator('[data-action="stand"]').click();

  const font = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font').trim());
  const used = await page.evaluate(() => window.canvasFonts.filter(f => f.startsWith('40px')));
  expect(used).toContain(`40px ${font}`);
});
