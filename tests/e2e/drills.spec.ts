// The four drills, driven through the running app: launch, answer right and
// wrong, watch the stats, pause, restart and go back, and what the canvases,
// covers and real timers show.
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openWithSettings as open, seedRandom } from './support/app';
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

/** The number of tests in the stats panel. */
const testsCount = async (screen: Locator) => Number(/Tests: (\d+)/.exec(await statsText(screen))?.[1]);

/** How many pixels of a canvas are not the felt it was filled with. */
const nonFeltPixels = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - data[0]) > 8 || Math.abs(data[i + 1] - data[1]) > 8 || Math.abs(data[i + 2] - data[2]) > 8)
        count += 1;
    }
    return count;
  });

/**
 * The percentage of a small box at the middle of a canvas that is felt (the
 * corner is felt). The box is a fixed size, smaller than the warning's plate on
 * any screen.
 */
const feltAtCentre = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const scale = el.width / el.clientWidth;
    const box = { width: Math.round(60 * scale), height: Math.round(16 * scale) };
    const { data } = ctx.getImageData(
      Math.round((el.width - box.width) / 2),
      Math.round((el.height - box.height) / 2),
      box.width,
      box.height,
    );
    let felt = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) <= 8 && Math.abs(data[i + 1] - g) <= 8 && Math.abs(data[i + 2] - b) <= 8) felt += 1;
    }
    return Math.round((100 * felt) / (data.length / 4));
  });

/** Picks `option` in an options screen's (native) select labelled `label`. */
async function choose(screen: Locator, label: string, option: string) {
  await screen.getByRole('combobox', { name: label }).selectOption({ label: option });
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

  test('non-blocking pop-ups say what was wrong and let play continue @layout', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn', 'drills.flash.nonBlockingErrors': true });
    const screen = await launch(page, DRILLS.flash);

    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    const toast = page.locator('[data-slot="toast"]');
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
    await choose(options, 'Test mode', 'Test Mode: Number of errors only at end');
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

  test('plays the gestures as Settings → Gestures maps them', async ({ page }) => {
    // Swipe down and the double tap swapped, held either way.
    const swapped = { down: 'surrender', left: 'stand', up: 'double', right: 'split', doubleTap: 'hit' };
    await open(page, {
      ...FIXED_16_V_TEN(),
      'drills.flash.testMode': 'warn',
      'gestures.portrait': swapped,
      'gestures.landscape': swapped,
    });
    const screen = await launch(page, DRILLS.flash);
    const cards = screen.getByRole('img', { name: 'Cards' });
    const box = (await cards.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 80, { steps: 5 });
    await page.mouse.up();
    // Swipe down is Surrender now, which these situations refuse.
    await expect(screen.getByRole('status')).toContainText('Surrender situations were not selected');
  });

  test('plays the arrow keys and / as the swipes and the double tap they stand for', async ({ page }) => {
    const swapped = { down: 'surrender', left: 'stand', up: 'double', right: 'split', doubleTap: 'hit' };
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn', 'gestures.portrait': swapped });
    const screen = await launch(page, DRILLS.flash);
    await expect(screen.getByRole('img', { name: 'Cards' })).toBeVisible();
    // Down is Surrender in this mapping, which these situations refuse.
    await page.keyboard.press('ArrowDown');
    await expect(screen.getByRole('status')).toContainText('Surrender situations were not selected');
  });

  test('plays the keys chosen in Settings → Gestures', async ({ page }) => {
    await open(page, {
      ...FIXED_16_V_TEN(),
      'drills.flash.testMode': 'warn',
      'gestures.keys': { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', doubleTap: 'k' },
    });
    const screen = await launch(page, DRILLS.flash);
    await expect(screen.getByRole('img', { name: 'Cards' })).toBeVisible();
    await page.keyboard.press('/');
    await expect(screen.getByRole('status')).toHaveText('');
    await page.keyboard.press('k');
    await expect(screen.getByRole('status')).toContainText('Surrender situations were not selected');
  });

  test('/ is the double tap: Surrender in the standard mapping', async ({ page }) => {
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'warn' });
    const screen = await launch(page, DRILLS.flash);
    await expect(screen.getByRole('img', { name: 'Cards' })).toBeVisible();
    await page.keyboard.press('/');
    await expect(screen.getByRole('status')).toContainText('Surrender situations were not selected');
  });

  test('shows the timing options each timer mode uses', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Flash Drills' }).click();
    const options = page.locator('[data-screen="drills.flash.options"]');
    const toggle = options.getByRole('switch', { name: 'Time limit per hand' });
    const perHand = options.getByRole('button', { name: 'Time per hand', exact: true });

    await choose(options, 'Timer mode', 'Timer Mode: Infinite');
    await expect(toggle).toBeVisible();
    await expect(perHand).toBeVisible();
    await expect(options.getByRole('button', { name: 'Drill time', exact: true })).toBeHidden();
    await expect(options.getByRole('button', { name: 'Rounds: 50', exact: true })).toBeHidden();

    // Turning the limit off hides the time and Progressive Speed, which shortens it.
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(perHand).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Progressive Speed' })).toBeHidden();

    await choose(options, 'Timer mode', 'Timer Mode: Count Down & Halt');
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

  test('Infinite with Pause every interval pauses after each interval of drill time, once the hand is answered', async ({
    page,
  }) => {
    await page.clock.install();
    await open(page, {
      ...FIXED_16_V_TEN(),
      'drills.flash.testMode': 'errorsAtEnd',
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
      'drills.flash.autoPause': true,
      'drills.flash.autoPauseSeconds': 10,
    });
    const screen = await launch(page, DRILLS.flash);
    const hit = screen.getByRole('button', { name: 'Hit', exact: true });
    const pause = screen.getByRole('button', { name: 'Pause' });
    const resume = screen.getByRole('button', { name: 'Continue' });
    // Time counts the interval down.
    expect(await statsText(screen)).toMatch(/Time: 00:00:(09|10)/);
    await hit.click();
    await hit.click();
    await page.clock.runFor(12000);
    // The interval is up, but the hand on screen still waits for its answer.
    await expect(pause).toBeVisible();
    await hit.click();
    await expect(resume).toBeVisible();
    await expect(screen.getByRole('status')).toHaveText(/^0:10 done: 3 hands, \d+%$/);
    // Time stays at 0 until play resumes and the next interval begins.
    expect(await statsText(screen)).toMatch(/Time: 00:00:00/);

    // Time spent paused does not count towards the next interval.
    await page.clock.runFor(60000);
    await resume.click();
    // The next interval shows as soon as Continue is tapped, through the countdown.
    expect(await statsText(screen)).toMatch(/Time: 00:00:10/);
    await page.clock.runFor(2500);
    await expect(pause).toBeEnabled();
    await expect(screen.getByRole('status')).toHaveText('');
    expect(await statsText(screen)).toMatch(/Hands: 4/);
    expect(await statsText(screen)).toMatch(/Time: 00:00:(09|10)/);

    await hit.click();
    await page.clock.runFor(11000);
    await hit.click();
    await expect(resume).toBeVisible();
    await expect(screen.getByRole('status')).toHaveText(/^0:10 done: 2 hands, \d+%$/);
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
    await expect(countdownOf(screen)).toBeVisible();
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
    await expect(page.locator('[data-slot="toast"][data-tone="good"]')).toHaveText('Round 1 done');
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

  test('the clock stops while the strategy table covers the drill', async ({ page }) => {
    await page.clock.install();
    await open(page, {
      ...FIXED_16_V_TEN(),
      'drills.flash.testMode': 'warn',
      'drills.flash.timerMode': 'infinite',
      'drills.flash.timePerHand': false,
    });
    const screen = await launch(page, DRILLS.flash);
    await screen.getByRole('button', { name: 'Hit', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('[data-screen="strategy.tables"]')).toBeVisible();
    await page.clock.runFor(4000);
    await page.locator('[data-screen="strategy.tables"] [data-action="back"]').click();
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    expect(await statsText(screen)).toMatch(/Time: 00:00:0[0-2]/);
  });

  test('the index test grid leaves the cards on screen in landscape @layout', async ({ page }) => {
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
      if (!(await screen.count())) await launch(page, DRILLS.flash);
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
    await open(page, { ...FIXED_16_V_TEN(), 'drills.flash.testMode': 'errorsAtEnd', 'drills.flash.handsPerDrill': 10 });
    const screen = await launch(page, DRILLS.flash);
    for (let hand = 0; hand < 10; hand++) await screen.getByRole('button', { name: 'Stand', exact: true }).click();

    const font = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--font').trim(),
    );
    const used = await page.evaluate(() => window.canvasFonts.filter(f => f.startsWith('40px')));
    expect(used).toContain(`40px ${font}`);
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

    await choose(options, 'Timer mode', 'Timer Mode: Rounds');
    await expect(button('Time per test')).toBeVisible();
    await expect(button('Drill time')).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Progressive Speed' })).toBeVisible();

    // The count range is for the TC drills; "in tray" for the others.
    const minimum = options.getByRole('button', { name: /^Minimum count: / });
    await expect(minimum).toBeHidden();
    await expect(options.getByRole('switch', { name: 'Decks or Aces in Tray' })).toBeVisible();
    await choose(options, 'Drill', 'Drill: TC Conversion');
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

test('sets the Flash drill time with the duration wheels', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Flash Drills' }).click();
  const options = page.locator('[data-screen="drills.flash.options"]');
  const row = options.getByRole('button', { name: 'Drill time' });
  await expect(row).toHaveText('00:03:00');
  await row.click();

  const dialog = page.getByRole('dialog', { name: 'Drill time' });
  await expect(dialog).toBeVisible();
  const minutes = dialog.getByRole('spinbutton', { name: 'Minutes' });
  await expect(minutes).toHaveAttribute('aria-valuenow', '3');
  await minutes.press('ArrowDown');
  await minutes.press('ArrowDown');
  await dialog.getByRole('spinbutton', { name: 'Seconds' }).press('ArrowDown');
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
  await minutes.press('ArrowDown');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveText('00:05:01');
  await row.click();
  await minutes.press('ArrowDown');
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

    await choose(options, 'Timer mode', 'Timer Mode: Shoe');
    await expect(button('Time per test')).toBeVisible();
    await expect(button('Drill time')).toBeHidden();

    await check('Deal by hand').click();
    await expect(check('Deal by hand')).toBeChecked();
    await expect(button('Deal speed')).toBeHidden();
    await expect(check('Progressive Speed')).toBeHidden();

    await choose(options, 'Test', 'Test: No Tests');
    await expect(options.getByRole('combobox', { name: 'Accuracy' })).toBeHidden();
    await expect(button('Time per test')).toBeHidden();
    await expect(check('Two Counts')).toBeHidden();

    await expect(options.getByRole('combobox', { name: 'Positions' })).toBeVisible();
    await choose(options, 'Cards', 'Cards: One');
    await expect(options.getByRole('combobox', { name: 'Positions' })).toBeHidden();
  });

  test('pauses with the cards covered, and counts down before continuing @layout', async ({ page }) => {
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

  test('covers the cards for a test too deep for a tray photo', async ({ page }) => {
    // A shoe whose last test comes in its last quarter deck, past the last photo
    // (unseeded, one shoe in five or so tests last at a depth that has a photo).
    await seedRandom(page, 7);
    await open(page, {
      'drills.count.decks': 8,
      'drills.count.trayStyle': 'eightDeckFront',
      'drills.count.cardsPerFlash': '4',
      'drills.count.testEvery': 'about16',
      'drills.count.dealByHand': true,
      'drills.count.accuracy': 0,
      'drills.count.alarmSeconds': 1799,
      'strategy.system': 30,
    });
    const screen = await launch(page, DRILLS.count);

    // The deepest test of the shoe is past the last tray photo, so nothing can
    // be shown with it - least of all the cards it is about.
    const run = await screen.evaluate(async el => {
      const next = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Next')!;
      const answers = el.querySelector('canvas[aria-label="Answer grid"]')!;
      const wrap = el.querySelector<HTMLElement>('[data-slot="answer-grid"]')!;
      const cards = el.querySelector<HTMLCanvasElement>('canvas[aria-label="Cards"]')!;
      const sleep = (ms: number) =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        });
      const nonFelt = () => {
        const { data } = cards.getContext('2d')!.getImageData(0, 0, cards.width, cards.height);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (
            Math.abs(data[i] - data[0]) > 8 ||
            Math.abs(data[i + 1] - data[1]) > 8 ||
            Math.abs(data[i + 2] - data[2]) > 8
          )
            count += 1;
        }
        return count;
      };
      let tests = 0;
      let last: number | null = null;
      for (let step = 0; step < 2000; step++) {
        if (wrap.hidden) {
          if (next.hidden) break;
          next.click();
          // The screen shows the deal once React has rendered it.
          await sleep(0);
          continue;
        }
        tests += 1;
        last = nonFelt();
        // Every cell of the grid, so the right answer is certainly among them.
        const box = answers.getBoundingClientRect();
        for (let row = 0; row < 3; row++) {
          for (let column = 0; column < 6; column++) {
            answers.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                clientX: box.left + (box.width / 6) * (column + 0.5),
                clientY: box.top + (box.height / 3) * (row + 0.5),
              }),
            );
          }
        }
        for (let wait = 0; wait < 50 && !wrap.hidden; wait++) await sleep(20);
      }
      return { tests, last };
    });

    expect(run.tests).toBeGreaterThan(5);
    expect(run.last).toBe(0);
  });

  test('shows the last cards of a shoe before it is done', async ({ page }) => {
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.trayStyle': 'sixDeckFront',
      'drills.count.cardsPerFlash': '3',
      'drills.count.testEvery': 'never',
      'drills.count.dealByHand': true,
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, DRILLS.count);
    const next = screen.getByRole('button', { name: 'Next' });
    const cards = screen.getByRole('img', { name: 'Cards' });

    // Seventeen flashes of three leave one card of the deck to come.
    for (let flash = 0; flash < 17; flash++) await next.click();
    const three = await nonFeltPixels(cards);
    expect(three).toBeGreaterThan(0);

    await next.click();
    await expect(next).toBeVisible();
    expect(await nonFeltPixels(cards)).toBeGreaterThan(three / 4);

    // The shoe is only done once that card has been seen.
    await next.click();
    await expect(next).toBeHidden();
  });

  test('keeps the end warning readable over the cards @layout', async ({ page }) => {
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.trayStyle': 'sixDeckFront',
      'drills.count.cardsPerFlash': '2',
      'drills.count.testEvery': 'never',
      'drills.count.endWarning': 'twoCardsLeft',
      'drills.count.positions': 'vertical',
      'drills.count.dealTenths': 1,
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, DRILLS.count);
    const cards = screen.getByRole('img', { name: 'Cards' });

    // The flashed cards cover the middle of the felt, where the warning goes.
    await expect.poll(() => feltAtCentre(cards)).toBeLessThan(10);
    // So the warning needs felt of its own to be read on.
    await expect.poll(() => feltAtCentre(cards), { timeout: 7000 }).toBeGreaterThan(50);
  });

  test("Restart takes the last round's Done off the screen at once", async ({ page }) => {
    await page.clock.install();
    // Count Down & Halt over ten seconds, a card every three, and no tests of its own.
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.cardsPerFlash': '1',
      'drills.count.testEvery': 'never',
      'drills.count.accuracy': 0,
      'drills.count.dealTenths': 30,
      'drills.count.timerMode': 'countDownHalt',
      'drills.count.alarmSeconds': 10,
    });
    const screen = await launch(page, DRILLS.count);
    const cards = screen.getByRole('img', { name: 'Cards' });
    const grid = screen.getByRole('img', { name: 'Answer grid' });
    // The last test, asked once the time is up.
    await page.clock.runFor(12000);
    await tapEveryCell(page, screen, grid);
    await page.clock.runFor(2000);
    await expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(await feltAtCentre(cards)).toBeLessThan(100);
    await screen.getByRole('button', { name: 'Restart' }).click();
    await expect(countdownOf(screen)).toBeVisible();
    await expect.poll(() => feltAtCentre(cards)).toBe(100);
  });
});

test.describe('full table drill', () => {
  test('asks for a wide screen while the device is upright @layout', async ({ page }) => {
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

    await choose(options, 'Timer mode', 'Timer Mode: Shoe');
    await expect(button('Time per test')).toBeVisible();
    await expect(select('End warning')).toBeVisible();

    // Two Tables deals its own hands and asks only running counts.
    await choose(options, 'Drill', 'Drill: Two Tables');
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

  test('resuming after a pause gives back only the time that was left', async ({ page }) => {
    await page.clock.install();
    await open(page, { 'drills.full.timerMode': 'auto', 'drills.full.testSeconds': 40, 'drills.full.flashSpeed': 8 });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    const cards = screen.getByRole('img', { name: 'Cards' });
    expect(await whitePixels(cards)).toBeGreaterThan(0);

    // Pause with about two seconds of the flash left.
    await page.clock.runFor(6000);
    await screen.getByRole('button', { name: 'Pause' }).click();
    expect(await whitePixels(cards)).toBe(0);
    await screen.getByRole('button', { name: 'Continue' }).click();
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    expect(await whitePixels(cards)).toBeGreaterThan(0);
    await page.clock.runFor(3500);
    expect(await whitePixels(cards)).toBe(0);
  });

  test('nothing is dealt or timed while the turn-sideways cover is up @layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await open(page, { 'drills.full.timerMode': 'auto', 'drills.full.testSeconds': 1, 'drills.full.flashSpeed': 1 });
    const screen = await launch(page, DRILLS.full);
    await expect(screen.getByRole('alert')).toBeVisible();
    await page.clock.runFor(4000);
    expect(await testsCount(screen)).toBe(0);

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(screen.getByRole('alert')).toBeHidden();
    await expect(statsOf(screen)).toContainText('Tests: 1');
  });

  test('Two Counts asks two answers for one test, flashed once', async ({ page }) => {
    test.setTimeout(90000);
    await page.clock.install();
    await open(page, {
      'drills.full.twoCounts': true,
      'drills.full.drill': 'acesDealt',
      'drills.full.timerMode': 'auto',
      'drills.full.testSeconds': 40,
      'drills.full.flashSpeed': 3,
      'drills.full.accuracy': 0,
    });
    await page.setViewportSize({ width: 844, height: 390 });
    const screen = await launch(page, DRILLS.full);
    const cards = screen.getByRole('img', { name: 'Cards' });
    const grid = screen.getByRole('img', { name: 'Answer grid' });
    // Once the flash is over, a second test can only mean a second table.
    await expect.poll(() => whitePixels(cards), { timeout: 8000 }).toBe(0);
    // Both answers, so the right one of each is among the taps.
    for (let i = 0; i < 72 && (await testsCount(screen)) === 1 && (await grid.isVisible()); i++) {
      await tapCell(screen, { row: i % 3, column: Math.floor(i / 3) % 6, rows: 3, columns: 6 });
      // Past the pause after a right answer, so the test has moved on if it was.
      await page.clock.runFor(120);
    }
    expect(await testsCount(screen)).toBe(2);
    expect(await whitePixels(cards)).toBeGreaterThan(0);
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
  const toasts = page.locator('[data-slot="toast"]');
  await choose(options, 'Hands', 'Hands: Drill Errors');
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
  await choose(options, 'Hands', 'Hands: Default Hands');
  await choose(options, 'Hands', 'Hands: Drill Errors');
  await expect(toasts.getByText('No errors have been recorded yet.', { exact: true })).toBeVisible();
});
