// Flash drill regressions: what the index test may ask, where the random count
// sits, and what the clock, the Pause button and the grid do once a drill is
// over or has no tests to grade.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openWithSettings as open } from './support/app';
import { DRILLS, countdownOf, emptyMask, launchDrill, statsText } from './support/drills';

test.use({ serviceWorkers: 'block' });

const ONLY_HARD_STAND = {
  hardStand: true,
  softStand: false,
  hardDouble: false,
  softDouble: false,
  split: false,
  surrender: false,
};

const launch = (page: Page) => launchDrill(page, DRILLS.flash);

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
  await expect(screen.getByRole('status')).toContainText('no tests configured');
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
  const hit = screen.getByRole('button', { name: 'Hit', exact: true });
  const counts: number[] = [];
  for (let hand = 0; hand < 40; hand++) {
    counts.push(Number((await screen.locator('[data-slot="count-panel"]').innerText()).replace('Count: ', '')));
    await hit.click();
  }
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  expect(Math.abs(mean)).toBeLessThan(1.5);
});

test('pause is off once the drill has finished', async ({ page }) => {
  await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd' });
  const screen = await launch(page);
  for (let hand = 0; hand < 10; hand++) await screen.getByRole('button', { name: 'Stand', exact: true }).click();
  expect(await statsText(screen)).toContain('Hands: 10');

  await expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
  // Restart brings it back with the new run.
  await screen.getByRole('button', { name: 'Restart' }).click();
  await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled({ timeout: 5000 });
});

test('the clock stops while the strategy table covers the drill', async ({ page }) => {
  await page.clock.install();
  await open(page, {
    ...FIXED_16_V_TEN(),
    'drills.flash.testMode': 'warn',
    'drills.flash.timerMode': 'infinite',
    'drills.flash.timePerHand': false,
  });
  const screen = await launch(page);
  await screen.getByRole('button', { name: 'Hit', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Table' }).click();
  await expect(page.locator('[data-screen="strategy.tables"]')).toBeVisible();
  await page.clock.runFor(4000);
  await page.locator('[data-screen="strategy.tables"] [data-action="back"]').click();
  await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
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
  const grid = screen.getByRole('img', { name: 'Answer grid' });
  const box = (await grid.boundingBox())!;
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
    const display = (await screen.locator('[data-slot="drill-display"]').boundingBox())!;
    // Half a pixel for rounding at the iPad's devicePixelRatio of 2.5.
    expect(display.y + display.height, `${size.width}x${size.height}`).toBeLessThanOrEqual(size.height + 0.5);
  }
});

test('the closing text is set in the app font', async ({ page }) => {
  await page.addInitScript(() => {
    const { get, set } = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font')!;
    window.canvasFonts = [];
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
      get(this: CanvasRenderingContext2D) {
        return get!.call(this);
      },
      set(this: CanvasRenderingContext2D, value: string) {
        window.canvasFonts.push(value);
        set!.call(this, value);
      },
    });
  });
  await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd' });
  const screen = await launch(page);
  for (let hand = 0; hand < 10; hand++) await screen.getByRole('button', { name: 'Stand', exact: true }).click();

  const font = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--font').trim());
  const used = await page.evaluate(() => window.canvasFonts.filter(f => f.startsWith('40px')));
  expect(used).toContain(`40px ${font}`);
});
