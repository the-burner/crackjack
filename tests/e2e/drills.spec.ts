// The four drills, driven through the running app: launch, answer right and
// wrong, watch the stats, pause, restart and go back.
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openWithSettings as open } from './support/app';
import {
  DRILLS,
  countdownOf,
  emptyMask,
  launchDrill as launch,
  statsOf,
  statsText,
  whitePixels,
} from './support/drills';

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
  const canvas = screen.getByRole('img', { name: 'Answer grid' });
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

/** Picks `option` in an options screen's select labelled `label`; the list opens over the page. */
async function choose(screen: Locator, label: string, option: string) {
  await screen.getByRole('combobox', { name: label }).click();
  await screen.page().getByRole('option', { name: option, exact: true }).click();
}

test('the home screen opens every drill options screen', async ({ page }) => {
  await open(page);
  for (const drill of Object.values(DRILLS)) {
    await page.getByRole('button', { name: drill.button }).click();
    const screen = page.locator(`[data-screen="${drill.options}"]`);
    await expect(screen).toBeVisible();
    await expect(screen.getByRole('heading', { level: 1 })).toHaveText(drill.title);
    await expect(screen.getByRole('button', { name: 'Launch the Drill' })).toBeVisible();
    // Strategy and true count are shared settings, set only from Settings.
    await expect(screen.getByRole('button', { name: 'Playing Strategy' })).toHaveCount(0);
    await expect(screen.getByRole('button', { name: 'True Count Calcs' })).toHaveCount(0);
    await screen.getByRole('button', { name: 'Back' }).click();
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
    await expect(statsOf(screen)).toContainText('Hands: 1');

    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 2');
    // "Errors at end" keeps the accuracy hidden while the drill runs.
    expect(await statsText(screen)).toContain('Displayed at end');

    for (let hand = 2; hand < 10; hand++) await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 10');

    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 10');
    // The closing accuracy is painted over the cards.
    expect(await whitePixels(screen.getByRole('img', { name: 'Cards' }))).toBeGreaterThan(0);
  });

  test('explains a wrong answer and keeps the hand until it is right', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);

    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Action: Hit; Correct: Stand');
    await expect(dialog).toContainText('Dealer: T');
    await dialog.getByRole('button', { name: 'OK' }).click();

    // The same hand is still on screen, and Stand is marked as the right answer.
    expect(await statsText(screen)).toContain('Hands: 1');
    expect(await statsText(screen)).toContain('Accuracy: 0%');
    await expect(screen.getByRole('button', { name: 'Stand', exact: true })).toHaveAttribute('data-correct');

    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 2');
    // The second hand starts clean, and a right answer keeps the accuracy.
    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Accuracy: 66%');
  });

  test('non-blocking pop-ups say what was wrong and let play continue', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn', 'drills.flash.nonBlockingErrors': true });
    const screen = await launch(page, DRILLS.flash);

    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toHaveText('Hit is incorrect');
    // At the top of the screen, with no dialog and no answer given away.
    const box = await toast.boundingBox();
    expect(box!.y).toBeLessThan(page.viewportSize()!.height / 2);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(screen.getByRole('button', { name: 'Stand', exact: true })).not.toHaveAttribute('data-correct');

    // A second wrong try is not counted again; the right answer moves on.
    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 1');
    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 2');
    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await statsText(screen)).toContain('Accuracy: 66%');
  });

  test('offers non-blocking pop-ups only with Warn on error', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    const options = page.locator('[data-screen="drills.flash.options"]');
    const toggle = options.getByRole('switch', { name: 'Non-blocking error pop-ups' });
    await expect(toggle).toBeVisible();
    await choose(options, 'Test mode', 'Number of errors only at end');
    await expect(toggle).toBeHidden();
  });

  test('shows the strategy table for a wrong answer', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);
    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Table' }).click();
    const tables = page.locator('[data-screen="strategy.tables"]');
    await expect(tables).toBeVisible();
    // It opens on the table that decided, with the offending cell marked.
    await expect(tables.getByRole('heading')).toHaveText('Hard H/S');
    await expect(tables.locator('td[data-marked]')).toHaveCount(1);
    await page.locator('[data-screen="strategy.tables"] [data-action="back"]').click();
    await expect(screen).toBeVisible();
  });

  test('a double tap on the cards is Surrender; diagonal swipes do nothing', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);
    const cards = screen.getByRole('img', { name: 'Cards' });
    const box = (await cards.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // A diagonal swipe is ignored.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 60, { steps: 5 });
    await page.mouse.up();
    await expect(screen.getByRole('status')).toHaveText('');

    // Only Hard H/S is selected, so Surrender is refused with a message.
    await cards.dblclick({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(screen.getByRole('status')).toContainText('Surrender situations were not selected');
  });

  test('shows the timing options each timer mode uses', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    const options = page.locator('[data-screen="drills.flash.options"]');
    const toggle = options.getByRole('switch', { name: 'Time limit per hand' });
    const perHand = options.getByRole('button', { name: 'Time per hand', exact: true });

    await choose(options, 'Timer mode', 'Infinite');
    await expect(toggle).toBeVisible();
    await expect(perHand).toBeVisible();
    await expect(options.getByRole('button', { name: 'Drill time', exact: true })).toBeHidden();
    await expect(options.getByRole('button', { name: 'Rounds: 50', exact: true })).toBeHidden();

    // Turning the limit off hides the time and Progressive Speed, which shortens it.
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(perHand).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Progressive Speed' })).toBeHidden();

    await choose(options, 'Timer mode', 'Count Down & Halt');
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
    for (let i = 0; i < 12; i++) await screen.getByRole('button', { name: 'Stand', exact: true }).click();
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
    for (let i = 0; i < 6; i++) await screen.getByRole('button', { name: 'Split', exact: true }).click();
    expect(await statsText(screen)).toContain('Hands: 7');
    await expect(screen.getByRole('status')).toHaveText('');
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
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
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
    const hit = screen.getByRole('button', { name: 'Hit', exact: true });
    for (let i = 0; i < 59; i++) await hit.click();
    expect(await statsText(screen)).toContain('Rounds: 0');
    await hit.click();
    expect(await statsText(screen)).toContain('Hands: 61, Rounds: 1');
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toHaveText('Round 1 done');
  });

  test('pauses, restarts and goes back', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.handsPerDrill': 50, 'drills.flash.testMode': 'errorsAtEnd' });
    // Pause is unavailable during the opening countdown, as it is after Restart.
    await page.getByRole('button', { name: DRILLS.flash.button }).click();
    await page.locator('[data-screen="drills.flash.options"] [data-action="launch"]').click();
    await expect(page.locator('[data-screen="drills.flash"]').getByRole('button', { name: 'Pause' })).toBeDisabled();
    const screen = page.locator('[data-screen="drills.flash"]');
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await screen.getByRole('button', { name: 'Stand', exact: true }).click();
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
    await expect(countdownOf(screen)).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    expect(await statsText(screen)).toContain('Hands: 1');

    await screen.getByRole('button', { name: 'Back' }).click();
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
    await page.getByRole('button', { name: 'Launch the Drill' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('No situations have been selected');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('[data-screen="drills.flash"]')).toHaveCount(0);
  });

  test('asks for an index instead of a play in the index test', async ({ page }) => {
    await open(page, {
      'drills.flash.hands': 'illustrious18',
      'drills.flash.countMode': 'indexTest',
      'drills.flash.seconds': 60,
    });
    const screen = await launch(page, DRILLS.flash);
    await expect(screen.getByRole('img', { name: 'Answer grid' })).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Stand', exact: true })).toBeHidden();
    await expect(screen.locator('[data-slot="count-panel"]')).not.toBeEmpty();
  });
});

test.describe('depth drill', () => {
  test('shows only the options that apply to the timer mode and the drill', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Depth Drills' }).click();
    const options = page.locator('[data-screen="drills.depth.options"]');
    const button = (name: string) => options.getByRole('button', { name, exact: true });

    // Count Down & Halt: a drill time, no rounds or per-test time.
    await expect(button('Drill time')).toBeVisible();
    await expect(button('Time per test')).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Progressive Speed' })).toBeHidden();

    await choose(options, 'Timer mode', 'Rounds');
    await expect(button('Time per test')).toBeVisible();
    await expect(button('Drill time')).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Progressive Speed' })).toBeVisible();

    // The count range is for the TC drills; "in tray" for the others.
    const minimum = options.getByRole('button', { name: /^Minimum count: / });
    await expect(minimum).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Decks or Aces in Tray' })).toBeVisible();
    await choose(options, 'Drill', 'TC Conversion');
    await expect(minimum).toBeVisible();
    await expect(options.getByRole('switch', { name: 'Decks or Aces in Tray' })).toBeHidden();
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
    await expect(statsOf(screen)).toContainText('Tests: 2');
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
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    expect(await statsText(screen)).toContain('Tests: 1');
    await screen.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-screen="drills.depth.options"]')).toBeVisible();
  });

  test('moves the tray style up when it cannot hold the decks in play', async ({ page }) => {
    await open(page, { 'drills.depth.decks': 6, 'drills.depth.trayStyle': 'doubleDeckFront' });
    await page.getByRole('button', { name: 'Depth Drills' }).click();
    const options = page.locator('[data-screen="drills.depth.options"]');
    await options.getByRole('button', { name: 'Launch the Drill' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('only holds 2 decks');
    await dialog.getByRole('button', { name: 'OK' }).click();
    await expect(options.getByRole('combobox', { name: 'Tray style' })).toContainText('Six-deck tray, front');
    await expect(page.locator('[data-screen="drills.depth"]')).toHaveCount(0);
  });
});

test('sets the Flash drill time with the duration dialog', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Flash Drills' }).click();
  const options = page.locator('[data-screen="drills.flash.options"]');
  const row = options.getByRole('button', { name: 'Drill time' });
  await expect(row).toHaveText('00:03:00');
  await row.click();

  const dialog = page.getByRole('dialog', { name: 'Drill time' });
  await expect(dialog).toBeVisible();
  const minutes = dialog.getByRole('spinbutton', { name: 'Minutes' });
  await expect(minutes).toHaveValue('3');
  await minutes.fill('5');
  await dialog.getByRole('spinbutton', { name: 'Seconds' }).fill('1');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveText('00:05:01');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state.values['drills.flash.drillSeconds'],
    ),
  ).toBe(301);

  // Cancel, and Escape, leave the setting alone.
  await row.click();
  await minutes.fill('9');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveText('00:05:01');
  await row.click();
  await minutes.fill('9');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(row).toHaveText('00:05:01');
});

test('a drill stops while another screen covers it, and counts down on return', async ({ page }) => {
  await page.clock.install();
  await open(page, { 'drills.count.testEvery': 'never' });
  const screen = await launch(page, DRILLS.count);
  // Read behind the help screen too, while the drill is hidden.
  const time = () => screen.getByRole('cell', { name: /^Time: /, includeHidden: true }).innerText();
  const before = await time();

  await screen.getByRole('button', { name: 'Help' }).click();
  await expect(page.locator('[data-screen="help"]')).toBeVisible();
  await page.clock.runFor(2500);
  // The clock did not run on behind the help screen.
  expect(await time()).toBe(before);

  // Closing the help sheet uncovers the drill.
  await page.keyboard.press('Escape');
  await expect(countdownOf(screen)).toBeVisible();
  await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
  await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  await expect.poll(time).not.toBe(before);
});

test.describe('count drill', () => {
  test('shows only the options that apply', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Count Drills' }).click();
    const options = page.locator('[data-screen="drills.count.options"]');
    const button = (name: string) => options.getByRole('button', { name, exact: true });
    const check = (name: string) => options.getByRole('switch', { name });

    // Count Down & Halt, dealt automatically.
    await expect(button('Drill time')).toBeVisible();
    await expect(button('Time per test')).toBeHidden();
    await expect(button('Deal speed')).toBeVisible();
    await expect(check('Progressive Speed')).toBeVisible();

    await choose(options, 'Timer mode', 'Shoe');
    await expect(button('Time per test')).toBeVisible();
    await expect(button('Drill time')).toBeHidden();

    await check('Deal by hand').click();
    await expect(check('Deal by hand')).toBeChecked();
    await expect(button('Deal speed')).toBeHidden();
    await expect(check('Progressive Speed')).toBeHidden();

    await choose(options, 'Test', 'No Tests');
    await expect(options.getByRole('combobox', { name: 'Accuracy' })).toBeHidden();
    await expect(button('Time per test')).toBeHidden();
    await expect(check('Two Counts')).toBeHidden();

    await expect(options.getByRole('combobox', { name: 'Positions' })).toBeVisible();
    await choose(options, 'Cards', 'One');
    await expect(options.getByRole('combobox', { name: 'Positions' })).toBeHidden();
  });

  test('pauses with the cards covered, and counts down before continuing', async ({ page }) => {
    await open(page, { 'drills.count.testEvery': 'never' });
    const screen = await launch(page, DRILLS.count);
    const cards = screen.getByRole('img', { name: 'Cards' });
    await expect.poll(() => whitePixels(cards)).toBeGreaterThan(0);
    // Count Down & Halt counts down from the 3:00 drill time.
    expect(await statsText(screen)).toMatch(/Time: 00:0[23]:\d\d/);

    await screen.getByRole('button', { name: 'Pause' }).click();
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    expect(await whitePixels(cards)).toBe(0);

    await screen.getByRole('button', { name: 'Continue' }).click();
    // The countdown sits over the card area, not the buttons.
    const countdown = countdownOf(screen);
    await expect(countdown).toBeVisible();
    const [area, number] = await Promise.all([
      screen.locator('[data-slot="drill-display"]').boundingBox(),
      countdown.boundingBox(),
    ]);
    expect(number!.y + number!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
    await expect(countdown).toBeHidden({ timeout: 5000 });
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
    await expect.poll(() => whitePixels(cards)).toBeGreaterThan(0);

    await screen.getByRole('button', { name: 'Restart' }).click();
    await expect(countdownOf(screen)).toBeVisible();
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
    const grid = screen.getByRole('img', { name: 'Answer grid' });
    await expect(grid).toBeVisible({ timeout: 5000 });
    expect(await statsText(screen)).toContain('Tests: 1');

    // Every cell of the grid, so the right answer is certainly among them.
    await tapEveryCell(page, screen, grid);
    // The right answer was among them, so dealing resumed and a second test came.
    await expect(statsOf(screen)).toContainText('Tests: 2');
    expect(await statsText(screen)).not.toContain('Accuracy: 100%');
  });

  test('lets the player deal by hand', async ({ page }) => {
    await open(page, { 'drills.count.dealByHand': true, 'drills.count.testEvery': 'never' });
    const screen = await launch(page, DRILLS.count);
    const next = screen.getByRole('button', { name: 'Next' });
    const cards = screen.getByRole('img', { name: 'Cards' });
    await expect(next).toBeVisible();
    expect(await whitePixels(cards)).toBe(0);
    await next.click();
    expect(await whitePixels(cards)).toBeGreaterThan(0);
  });
});

test.describe('full table drill', () => {
  test('asks for a wide screen while the device is upright', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const screen = await launch(page, DRILLS.full);
    await expect(screen.getByRole('alert')).toBeVisible();
    await expect(screen.getByRole('alert')).toContainText('Turn the device sideways');
    // The title bar stays usable over the cover.
    await screen.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-screen="drills.full.options"]')).toBeVisible();
  });

  test('deals a table and grades the count in landscape', async ({ page }) => {
    await page.clock.install();
    await open(page, { 'drills.full.testSeconds': 40, 'drills.full.accuracy': 0 });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    await expect(screen.getByRole('alert')).toBeHidden();
    const grid = screen.getByRole('img', { name: 'Answer grid' });
    await expect(grid).toBeVisible();
    expect(await statsText(screen)).toContain('Tests: 1');

    await tapEveryCell(page, screen, grid);
    await expect(statsOf(screen)).toContainText('Tests: 2');
  });

  test('shows only the options that apply', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Full Table Drills' }).click();
    const options = page.locator('[data-screen="drills.full.options"]');
    const button = (name: string) => options.getByRole('button', { name, exact: true });
    const select = (label: string) => options.getByRole('combobox', { name: label });

    // Count Down & Halt: a drill time and no end-of-shoe warning.
    await expect(button('Drill time')).toBeVisible();
    await expect(button('Time per test')).toBeHidden();
    await expect(select('End warning')).toBeHidden();
    await expect(button('Flash speed')).toBeVisible();

    await choose(options, 'Timer mode', 'Shoe');
    await expect(button('Time per test')).toBeVisible();
    await expect(select('End warning')).toBeVisible();

    // Two Tables deals its own hands and asks only running counts.
    await choose(options, 'Drill', 'Two Tables');
    await expect(select('Hands')).toBeHidden();
    await expect(select('End warning')).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Two Counts' })).toBeHidden();
  });

  test('Two Tables starts even with scattered cards saved, since it deals its own hands', async ({ page }) => {
    await open(page, { 'drills.full.drill': 'twoTables', 'drills.full.handStyle': 'scattered' });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    await expect(screen.getByRole('img', { name: 'Answer grid' })).toBeVisible();
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
  await screen.getByRole('button', { name: 'Hit', exact: true }).click();
  await screen.getByRole('button', { name: 'Back' }).click();

  const options = page.locator('[data-screen="drills.flash.options"]');
  const toasts = page.getByRole('region', { name: /Notifications/ });
  await choose(options, 'Hands', 'Drill Errors');
  await expect(toasts.getByText(/Hard H\/S 16 v T/)).toBeVisible();

  // Error History breaks the record down.
  await options.getByRole('button', { name: 'Error history', exact: true }).click();
  const history = page.locator('[data-screen="drills.flash.errors"]');
  const section = (title: string) =>
    history.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(section('Summary')).toContainText('Total errors1');
  await expect(section('By situation')).toContainText('Hard H/S1 · 100%');
  await expect(section('Hands')).toContainText('Hard H/S 16 v T1 · 100%');
  await history.getByRole('button', { name: 'Back' }).click();

  await options.getByRole('button', { name: 'Clear error history' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes' }).click();
  await expect(toasts.getByText('Error history cleared', { exact: true })).toBeVisible();

  // Choosing the list again reports that it is empty.
  await choose(options, 'Hands', 'Default Hands');
  await choose(options, 'Hands', 'Drill Errors');
  await expect(toasts.getByText('No errors have been recorded yet.', { exact: true })).toBeVisible();
});
