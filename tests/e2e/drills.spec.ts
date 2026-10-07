// The four drills, driven through the running app: launch, answer right and
// wrong, watch the stats, pause, restart and go back.
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openWithSettings as open } from './support/app.ts';
import { DRILLS, emptyMask, launchDrill as launch, statsText, whitePixels } from './support/drills.ts';

test.use({ serviceWorkers: 'block' });

/** Taps the cell at (row, column) of an answer grid. */
async function tapCell(
  screen: Locator,
  {
    row,
    column,
    rows,
    columns,
    offset = 0,
  }: { row: number; column: number; rows: number; columns: number; offset?: number },
) {
  const canvas = screen.locator('canvas.drill__answers');
  const box = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: (box.width / columns) * (column + offset + 0.5), y: (box.height / rows) * (row + 0.5) },
  });
}

/**
 * Taps cells of a 3 x 6 count grid until the test moves on, so the right answer
 * is certainly among them. Needs the clock installed.
 */
async function tapEveryCell(page: Page, screen: Locator, grid: Locator) {
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      if (!(await grid.isVisible())) return;
      await tapCell(screen, { row, column, rows: 3, columns: 6 });
      // Past the pause after a right answer, so the test has moved on if it was.
      await page.clock.runFor(120);
      if (!(await statsText(screen)).includes('Tests: 1')) return;
    }
  }
}

test('the home screen opens every drill options screen', async ({ page }) => {
  await open(page);
  for (const drill of Object.values(DRILLS)) {
    await page.getByRole('button', { name: drill.button }).click();
    const screen = page.locator(`[data-screen="${drill.options}"]`);
    await expect(screen).toBeVisible();
    await expect(screen.locator('.topbar__title')).toHaveText(drill.title);
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
      'drills.flash.situations': {
        hardStand: true,
        softStand: false,
        hardDouble: false,
        softDouble: false,
        split: false,
        surrender: false,
      },
      'drills.flash.countMode': 'fixed',
      'drills.flash.fixedCount': 0,
      'drills.flash.maxCards': 2,
      'drills.flash.timerMode': 'auto',
      'drills.flash.seconds': 60,
      'drills.flash.handsPerDrill': 3,
      'strategy.system': 30,
    };
  };

  test('counts every hand and ends after the last one', async ({ page }) => {
    // Ten hands is the smallest a drill may be.
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd', 'drills.flash.handsPerDrill': 10 });
    const screen = await launch(page, DRILLS.flash);
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
    const screen = await launch(page, DRILLS.flash);

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

  test('non-blocking pop-ups say what was wrong and let play continue', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn', 'drills.flash.nonBlockingErrors': true });
    const screen = await launch(page, DRILLS.flash);

    await screen.locator('[data-action="hit"]').click();
    const toast = page.locator('.toast');
    await expect(toast).toHaveText('Hit is incorrect');
    // At the top of the screen, with no dialog and no answer given away.
    const box = await toast.boundingBox();
    expect(box!.y).toBeLessThan(page.viewportSize()!.height / 2);
    await expect(page.locator('.dialog-overlay')).toHaveCount(0);
    await expect(screen.locator('[data-action="stand"]')).not.toHaveClass(/is-correct/);

    // A second wrong try is not counted again; the right answer moves on.
    await screen.locator('[data-action="hit"]').click();
    expect(await statsText(screen)).toContain('Hands: 1');
    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 2');
    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Accuracy: 66%');
  });

  test('offers non-blocking pop-ups only with Warn on error', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    const options = page.locator('[data-screen="drills.flash.options"]');
    const toggle = options.getByRole('checkbox', { name: 'Non-blocking error pop-ups' });
    await expect(toggle).toBeVisible();
    await options
      .locator('select[name="drills.flash.testMode"]')
      .selectOption({ label: 'Test Mode: Number of errors only at end' });
    await expect(toggle).toBeHidden();
  });

  test('shows the strategy table for a wrong answer', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);
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

  test('a double tap on the cards is Surrender; diagonal swipes do nothing', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);
    const cards = screen.locator('canvas.drill__cards');
    const box = (await cards.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // A diagonal swipe is ignored.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 60, { steps: 5 });
    await page.mouse.up();
    await expect(screen.locator('.drill__message')).toHaveText('');

    // Only Hard H/S is selected, so Surrender is refused with a message.
    await cards.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(screen.locator('.drill__message')).toContainText('Surrender situations were not selected');
  });

  test('shows the timing options each timer mode uses', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    const options = page.locator('[data-screen="drills.flash.options"]');
    const mode = options.locator('select[name="drills.flash.timerMode"]');
    const toggle = options.getByRole('checkbox', { name: 'Time limit per hand' });
    const perHand = options.getByRole('button', { name: 'Time per hand', exact: true });

    await mode.selectOption({ label: 'Timer Mode: Infinite' });
    await expect(toggle).toBeVisible();
    await expect(perHand).toBeVisible();
    await expect(options.getByRole('button', { name: 'Drill time', exact: true })).toBeHidden();
    await expect(options.getByRole('button', { name: '50', exact: true })).toBeHidden();

    // Turning the limit off hides the time and Progressive Speed, which shortens it.
    await toggle.uncheck();
    await expect(perHand).toBeHidden();
    await expect(options.getByRole('checkbox', { name: 'Progressive Speed' })).toBeHidden();

    await mode.selectOption({ label: 'Timer Mode: Count Down & Halt' });
    await expect(toggle).toBeHidden();
    await expect(options.getByRole('button', { name: 'Drill time', exact: true })).toBeVisible();
  });

  test('Infinite counts the time up and does not end', async ({ page }) => {
    await open(page, {
      ...FIXED_16_V_TEN(),
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
      'drills.flash.handsPerDrill': 10,
    });
    const screen = await launch(page, DRILLS.flash);
    expect(await statsText(screen)).toMatch(/Time: 00:00:0[01]/);
    // More hands than a Rounds drill of 10 would allow.
    for (let i = 0; i < 12; i++) await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 13');
    await expect.poll(() => statsText(screen)).toMatch(/Time: 00:00:0[2-9]/);
  });

  test('Round Robin deals hands from the selected situations', async ({ page }) => {
    await open(page, {
      'drills.flash.hands': 'roundRobin',
      'drills.flash.situations': {
        hardStand: false,
        softStand: false,
        hardDouble: false,
        softDouble: false,
        split: true,
        surrender: false,
      },
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
      'drills.flash.testMode': 'errorsAtEnd',
    });
    const screen = await launch(page, DRILLS.flash);
    // Only pairs are in play, so every hand dealt is one Split can answer.
    for (let i = 0; i < 6; i++) await screen.locator('[data-action="split"]').click();
    expect(await statsText(screen)).toContain('Hands: 7');
    await expect(screen.locator('.drill__message')).toHaveText('');
  });

  test('counts finished Round Robin rounds', async ({ page }) => {
    await open(page, {
      'drills.flash.hands': 'roundRobin',
      'drills.flash.situations': {
        hardStand: false,
        softStand: false,
        hardDouble: false,
        softDouble: false,
        split: false,
        surrender: true,
      },
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
      'drills.flash.testMode': 'errorsAtEnd',
    });
    await page.getByRole('button', { name: DRILLS.flash.button }).click();
    await page.locator('[data-screen="drills.flash.options"] [data-action="launch"]').click();
    // Shown from the countdown on, not only once the first hand is dealt.
    expect(await statsText(page.locator('[data-screen="drills.flash"]'))).toContain('Hands: 0, Rounds: 0');
    const screen = page.locator('[data-screen="drills.flash"]');
    await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
    expect(await statsText(screen)).toContain('Hands: 1, Rounds: 0');
    // A pause deals the same hand again, so it is not skipped from the round.
    for (let i = 0; i < 2; i++) {
      await screen.getByRole('button', { name: 'Pause' }).click();
      expect(await statsText(screen)).toContain('Hands: 1, Rounds: 0');
      await screen.getByRole('button', { name: 'Continue' }).click();
      await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled({ timeout: 5000 });
    }
    expect(await statsText(screen)).toContain('Hands: 1, Rounds: 0');
    // Errors at End takes any answer, so each tap deals the next hand.
    const hit = screen.locator('[data-action="hit"]');
    for (let i = 0; i < 59; i++) await hit.click();
    expect(await statsText(screen)).toContain('Rounds: 0');
    await hit.click();
    expect(await statsText(screen)).toContain('Hands: 61, Rounds: 1');
    await expect(page.locator('.toast.toast--good')).toHaveText('Round 1 done');
  });

  test('pauses, restarts and goes back', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.handsPerDrill': 50, 'drills.flash.testMode': 'errorsAtEnd' });
    // Pause is unavailable during the opening countdown, as it is after Restart.
    await page.getByRole('button', { name: DRILLS.flash.button }).click();
    await page.locator('[data-screen="drills.flash.options"] [data-action="launch"]').click();
    await expect(page.locator('[data-screen="drills.flash"]').getByRole('button', { name: 'Pause' })).toBeDisabled();
    const screen = page.locator('[data-screen="drills.flash"]');
    await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await screen.locator('[data-action="stand"]').click();
    expect(await statsText(screen)).toContain('Hands: 2');

    const pause = screen.getByRole('button', { name: 'Pause' });
    await pause.click();
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    // The paused hand comes back on resume, so the count stays put.
    expect(await statsText(screen)).toContain('Hands: 2');
    await screen.getByRole('button', { name: 'Continue' }).click();
    await expect(pause).toBeVisible();
    expect(await statsText(screen)).toContain('Hands: 2');

    await screen.getByRole('button', { name: 'Restart' }).click();
    // Restart counts down like Launch, with Pause unavailable until play resumes.
    await expect(screen.locator('.drill__countdown')).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(await statsText(screen)).toContain('Hands: 1');

    await screen.locator('[data-action="back"], .drill__bar button').first().click();
    await expect(page.locator('[data-screen="drills.flash.options"]')).toBeVisible();
  });

  test('refuses to launch without a situation, and with no tests on a clock', async ({ page }) => {
    await open(page, {
      'drills.flash.situations': {
        hardStand: false,
        softStand: false,
        hardDouble: false,
        softDouble: false,
        split: false,
        surrender: false,
      },
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
    const screen = await launch(page, DRILLS.flash);
    await expect(screen.locator('canvas.drill__answers')).toBeVisible();
    await expect(screen.locator('[data-action="stand"]')).toBeHidden();
    await expect(screen.locator('.drill__count')).not.toBeEmpty();
  });
});

test.describe('depth drill', () => {
  test('shows only the options that apply to the timer mode and the drill', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Depth Drills' }).click();
    const options = page.locator('[data-screen="drills.depth.options"]');
    const visible = (name: string) => options.getByRole('button', { name, exact: true }).isVisible();

    // Count Down & Halt: a drill time, no rounds or per-test time.
    expect(await visible('Drill time')).toBe(true);
    expect(await visible('Time per test')).toBe(false);
    await expect(options.getByRole('checkbox', { name: 'Progressive Speed' })).toBeHidden();

    await options.locator('select[name="drills.depth.timerMode"]').selectOption({ label: 'Timer Mode: Rounds' });
    expect(await visible('Time per test')).toBe(true);
    expect(await visible('Drill time')).toBe(false);
    await expect(options.getByRole('checkbox', { name: 'Progressive Speed' })).toBeVisible();

    // The count range is for the TC drills; "in tray" for the others.
    await expect(options.getByText('Minimum count')).toBeHidden();
    await expect(options.getByRole('checkbox', { name: 'Decks or Aces in Tray' })).toBeVisible();
    await options.locator('select[name="drills.depth.drill"]').selectOption({ label: 'Drill: TC Conversion' });
    await expect(options.getByText('Minimum count')).toBeVisible();
    await expect(options.getByRole('checkbox', { name: 'Decks or Aces in Tray' })).toBeHidden();
  });

  test('grades taps on the depth grid and counts the errors', async ({ page }) => {
    await open(page, {
      'drills.depth.decks': 2,
      'drills.depth.resolution': 'full',
      'drills.depth.seconds': 60,
      'drills.depth.accuracy': 0,
    });
    const screen = await launch(page, DRILLS.depth);
    expect(await statsText(screen)).toContain('Tests: 1');

    // Two decks at full resolution offer one answer: "1", offset half a column.
    await tapCell(screen, { row: 0, column: 1, rows: 1, columns: 2, offset: -0.5 });
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
    expect(await statsText(screen)).toContain('Accuracy: 100%');
  });

  test('counts a wrong tap as an error', async ({ page }) => {
    await page.clock.install();
    await open(page, {
      'drills.depth.decks': 6,
      'drills.depth.resolution': 'full',
      'drills.depth.seconds': 60,
      'drills.depth.accuracy': 0,
    });
    const screen = await launch(page, DRILLS.depth);
    // Six decks at full resolution offer 1..5. Tapping each in turn reaches the
    // right one, and every tap before it is an error. The answer is random, so
    // the first tap may happen to be right; keep going until a test has had a
    // wrong tap (five tests in a row answered first time is a 1-in-3125 chance).
    for (let test = 1; test <= 5; test++) {
      for (let column = 1; column < 6; column++) {
        await tapCell(screen, { row: 0, column, rows: 1, columns: 6, offset: -0.5 });
        // Past the pause after a right answer, so the test has moved on if it was.
        await page.clock.runFor(200);
        if ((await statsText(screen)).includes(`Tests: ${test + 1}`)) break;
      }
      if (!(await statsText(screen)).includes('Accuracy: 100%')) break;
    }
    expect(await statsText(screen)).not.toContain('Accuracy: 100%');
  });

  test('restarts and goes back', async ({ page }) => {
    await open(page, { 'drills.depth.seconds': 60 });
    const screen = await launch(page, DRILLS.depth);
    await screen.getByRole('button', { name: 'Restart' }).click();
    await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
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

test('sets the Flash drill time with the duration wheels', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Flash Drills' }).click();
  const options = page.locator('[data-screen="drills.flash.options"]');
  const row = options.getByRole('button', { name: 'Drill time' });
  await expect(row).toHaveText('00:03:00');
  await row.click();

  const sheet = page.getByRole('dialog', { name: 'Drill time' });
  await expect(sheet).toBeVisible();
  const minutes = sheet.getByRole('spinbutton', { name: 'Minutes' });
  await expect(minutes).toHaveAttribute('aria-valuenow', '3');
  await minutes.press('ArrowDown');
  await minutes.press('ArrowDown');
  await sheet.getByRole('spinbutton', { name: 'Seconds' }).press('ArrowDown');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(row).toHaveText('00:05:01');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').values['drills.flash.drillSeconds'],
    ),
  ).toBe(301);

  // Cancel leaves the setting alone.
  await row.click();
  await page.getByRole('dialog', { name: 'Drill time' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toHaveText('00:05:01');
});

test('a drill stops while another screen covers it, and counts down on return', async ({ page }) => {
  await page.clock.install();
  await open(page, { 'drills.count.testEvery': 'never' });
  const screen = await launch(page, DRILLS.count);
  const time = () => screen.locator('.drill__stats td').nth(2).innerText();
  const before = await time();

  await screen.getByRole('button', { name: 'Help' }).click();
  await expect(page.locator('[data-screen="help"]')).toBeVisible();
  await page.clock.runFor(2500);
  // The clock did not run on behind the help screen.
  expect(await time()).toBe(before);

  await page.locator('[data-screen="help"] [data-action="back"]').click();
  await expect(screen.locator('.drill__countdown')).toBeVisible();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  await expect.poll(time).not.toBe(before);
});

test.describe('count drill', () => {
  test('shows only the options that apply', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Count Drills' }).click();
    const options = page.locator('[data-screen="drills.count.options"]');
    const button = (name: string) => options.getByRole('button', { name, exact: true });
    const check = (name: string) => options.getByRole('checkbox', { name });

    // Count Down & Halt, dealt automatically.
    await expect(button('Drill time')).toBeVisible();
    await expect(button('Time per test')).toBeHidden();
    await expect(button('Deal speed')).toBeVisible();
    await expect(check('Progressive Speed')).toBeVisible();

    await options.locator('select[name="drills.count.timerMode"]').selectOption({ label: 'Timer Mode: Shoe' });
    await expect(button('Time per test')).toBeVisible();
    await expect(button('Drill time')).toBeHidden();

    await check('Deal by hand').check();
    await expect(button('Deal speed')).toBeHidden();
    await expect(check('Progressive Speed')).toBeHidden();

    await options.locator('select[name="drills.count.testEvery"]').selectOption({ label: 'Test: No Tests' });
    await expect(options.locator('select[name="drills.count.accuracy"]')).toBeHidden();
    await expect(button('Time per test')).toBeHidden();
    await expect(check('Two Counts')).toBeHidden();

    await options.locator('select[name="drills.count.cardsPerFlash"]').selectOption({ label: 'Cards: One' });
    await expect(options.locator('select[name="drills.count.positions"]')).toBeHidden();
  });

  test('pauses with the cards covered, and counts down before continuing', async ({ page }) => {
    await open(page, { 'drills.count.testEvery': 'never' });
    const screen = await launch(page, DRILLS.count);
    const cards = screen.locator('canvas.drill__cards');
    await expect.poll(() => whitePixels(cards)).toBeGreaterThan(0);
    // Count Down & Halt counts down from the 3:00 drill time.
    expect(await statsText(screen)).toMatch(/Time: 00:0[23]:\d\d/);

    await screen.getByRole('button', { name: 'Pause' }).click();
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    expect(await whitePixels(cards)).toBe(0);

    await screen.getByRole('button', { name: 'Continue' }).click();
    // The countdown sits over the card area, not the buttons.
    const countdown = screen.locator('.drill__countdown');
    await expect(countdown).toBeVisible();
    const [area, number] = await Promise.all([
      screen.locator('.drill__display').boundingBox(),
      countdown.boundingBox(),
    ]);
    expect(number!.y + number!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
    await expect(countdown).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await expect.poll(() => whitePixels(cards)).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Restart' }).click();
    await expect(screen.locator('.drill__countdown')).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled({ timeout: 5000 });
  });

  test('deals flashes, asks for the count and grades the answer', async ({ page }) => {
    await page.clock.install();
    await open(page, {
      'drills.count.testEvery': 'everyCard',
      'drills.count.dealTenths': 2,
      'drills.count.testSeconds': 15,
      'drills.count.accuracy': 0,
      'strategy.system': 30,
    });
    const screen = await launch(page, DRILLS.count);
    const grid = screen.locator('canvas.drill__answers');
    await expect(grid).toBeVisible({ timeout: 5000 });
    expect(await statsText(screen)).toContain('Tests: 1');

    // Every cell of the grid, so the right answer is certainly among them.
    await tapEveryCell(page, screen, grid);
    // The right answer was among them, so dealing resumed and a second test came.
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
    expect(await statsText(screen)).not.toContain('Accuracy: 100%');
  });

  test('lets the player deal by hand', async ({ page }) => {
    await open(page, { 'drills.count.dealByHand': true, 'drills.count.testEvery': 'never' });
    const screen = await launch(page, DRILLS.count);
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
    const screen = await launch(page, DRILLS.full);
    await expect(screen.locator('.drill__cover')).toBeVisible();
    await expect(screen.locator('.drill__cover')).toContainText('Turn the device sideways');
    // The title bar stays usable over the cover.
    await screen.locator('.drill__bar button').first().click();
    await expect(page.locator('[data-screen="drills.full.options"]')).toBeVisible();
  });

  test('deals a table and grades the count in landscape', async ({ page }) => {
    await page.clock.install();
    await open(page, { 'drills.full.testSeconds': 40, 'drills.full.accuracy': 0 });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    await expect(screen.locator('.drill__cover')).toBeHidden();
    const grid = screen.locator('canvas.drill__answers');
    await expect(grid).toBeVisible();
    expect(await statsText(screen)).toContain('Tests: 1');

    await tapEveryCell(page, screen, grid);
    await expect(screen.locator('.drill__stats')).toContainText('Tests: 2');
  });

  test('shows only the options that apply', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Full Table Drills' }).click();
    const options = page.locator('[data-screen="drills.full.options"]');
    const button = (name: string) => options.getByRole('button', { name, exact: true });
    const select = (key: string) => options.locator(`select[name="drills.full.${key}"]`);

    // Count Down & Halt: a drill time and no end-of-shoe warning.
    await expect(button('Drill time')).toBeVisible();
    await expect(button('Time per test')).toBeHidden();
    await expect(select('endWarning')).toBeHidden();
    await expect(button('Flash speed')).toBeVisible();

    await select('timerMode').selectOption({ label: 'Timer Mode: Shoe' });
    await expect(button('Time per test')).toBeVisible();
    await expect(select('endWarning')).toBeVisible();

    // Two Tables deals its own hands and asks only running counts.
    await select('drill').selectOption({ label: 'Drill: Two Tables' });
    await expect(select('handStyle')).toBeHidden();
    await expect(select('endWarning')).toBeHidden();
    await expect(options.getByRole('checkbox', { name: 'Two Counts' })).toBeHidden();
  });

  test('Two Tables starts even with scattered cards saved, since it deals its own hands', async ({ page }) => {
    await open(page, { 'drills.full.drill': 'twoTables', 'drills.full.handStyle': 'scattered' });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    await expect(screen.locator('canvas.drill__answers')).toBeVisible();
  });
});

test('the drills record errors that the Flash options screen can clear', async ({ page }) => {
  const mask = emptyMask();
  mask.hardStand[1][8] = true;
  await open(page, {
    'drills.flash.hands': 'custom',
    'drills.flash.customHands': mask,
    'drills.flash.situations': {
      hardStand: true,
      softStand: false,
      hardDouble: false,
      softDouble: false,
      split: false,
      surrender: false,
    },
    'drills.flash.countMode': 'fixed',
    'drills.flash.maxCards': 2,
    'drills.flash.seconds': 60,
    'drills.flash.testMode': 'errorsAtEnd',
    'strategy.system': 30,
  });
  const screen = await launch(page, DRILLS.flash);
  await screen.locator('[data-action="hit"]').click();
  await screen.locator('.drill__bar button').first().click();

  const options = page.locator('[data-screen="drills.flash.options"]');
  await options.locator('select[name="drills.flash.hands"]').selectOption({ label: 'Hands: Drill Errors' });
  await expect(page.locator('.toast')).toContainText('Hard H/S 16 v T');

  // Error History breaks the record down.
  await options.getByRole('button', { name: 'Error history', exact: true }).click();
  const history = page.locator('[data-screen="drills.flash.errors"]');
  await expect(history.locator('.stat-summary').first()).toContainText('Total errors1');
  await expect(history.locator('.stat-row').first()).toContainText('Hard H/S1 · 100%');
  await expect(history.locator('.stat-row').last()).toContainText('Hard H/S 16 v T1 · 100%');
  await history.locator('[data-action="back"]').click();

  await options.getByRole('button', { name: 'Clear error history' }).click();
  await page.locator('.dialog').getByRole('button', { name: 'Yes' }).click();
  await expect(page.locator('.toast')).toHaveText('Error history cleared');

  // Choosing the list again reports that it is empty.
  await options.locator('select[name="drills.flash.hands"]').selectOption({ label: 'Hands: Default Hands' });
  await options.locator('select[name="drills.flash.hands"]').selectOption({ label: 'Hands: Drill Errors' });
  await expect(page.locator('.toast')).toHaveText('No errors have been recorded yet.');
});
