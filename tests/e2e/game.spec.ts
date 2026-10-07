// End-to-end tests of the blackjack table: betting, playing out hands, the
// statistics screen, both orientations, and the rule that input is ignored
// while a deal is still being animated.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedRandom, visibleOneOf } from './support/app';
import type { SavedSettings } from './support/app';
import {
  bankroll,
  barButton,
  betGrid as grid,
  betOverlay as overlay,
  betTitle,
  dialog,
  felt,
  overlayButton,
  playButton as action,
  tableCanvas,
  tableScreen,
  tableToast,
  tapBetTile,
} from './support/table';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/**
 * Starts with a clean installation, the fastest animation speeds, and the
 * table the assertions below are written for ($1,000 bankroll, $5 chips, two
 * human seats, no bet-error warnings), whatever the shipped defaults are.
 */
async function openTable(
  page: Page,
  {
    settings = {},
    size = PORTRAIT,
    seed = 7,
  }: { settings?: SavedSettings; size?: typeof PORTRAIT; seed?: number } = {},
) {
  await page.setViewportSize(size);
  // Deal the same cards on every run, so a test never meets an unplanned
  // blackjack or insurance offer.
  await seedRandom(page, seed);
  await page.addInitScript(overrides => {
    localStorage.clear();
    localStorage.setItem(
      'cj.settings',
      JSON.stringify({
        'mechanics.dealerSpeed': 99,
        'mechanics.otherPlayerSpeed': 99,
        'mechanics.payoffSpeed': 99,
        'table.startingBankroll': 1000,
        'table.seatCount': 4,
        'table.computerSeats': [false, false, true, true, true, true],
        'betting.chipValue': 5,
        'betting.warnOnError': false,
        'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 1 })) },
        'rules.surrender': 'none',
        // Hidden by default; most tests play with the buttons.
        'display.hideActionButtons': false,
        ...overrides,
      }),
    );
  }, settings);
  await page.goto('/index.html');
  await page.locator('[data-action="play"]').click();
  await expect(overlay(page)).toBeVisible();
  return tableScreen(page);
}

const statsRows = (page: Page) => page.locator('[data-screen="game.stats"]').getByRole('row');
const yes = (page: Page) => dialog(page).getByRole('button', { name: 'Yes' });
const chips = (page: Page) => page.locator('[data-screen="game.betSelect"]').getByRole('group', { name: 'Chips' });
const chip = (page: Page, n: number) => chips(page).getByRole('button', { name: String(n), exact: true });
const ACTIONS = ['hit', 'stand', 'double', 'split', 'surrender'];

/**
 * Plays the hand in front of the player until the next bet is asked for, and
 * reports which actions the table offered along the way.
 */
async function playRound(page: Page, { prefer = ['stand'], seen = new Set<string>() } = {}) {
  const asked = dialog(page);
  const insure = action(page, 'pass');
  for (let step = 0; step < 60; step++) {
    // Until the table wants something: the cards may still be coming.
    await expect(visibleOneOf(asked, overlay(page), insure, ...ACTIONS.map(name => action(page, name)))).toBeVisible();
    // The dealer queries an obviously bad play once; say OK and press again.
    if (await asked.isVisible()) {
      await asked.getByRole('button').first().click();
      continue;
    }
    if (await overlay(page).isVisible()) return seen;
    if (await insure.isVisible()) {
      await insure.click();
      continue;
    }
    const offered: string[] = [];
    for (const name of ACTIONS) {
      if (await action(page, name).isVisible()) {
        offered.push(name);
        seen.add(name);
      }
    }
    const pick = [...prefer, 'stand'].find(name => offered.includes(name));
    if (pick) await action(page, pick).click();
  }
  throw new Error('the round never came back to the betting overlay');
}

test.describe('the table', () => {
  test('deals, pays and comes back for another bet', async ({ page }) => {
    await openTable(page);
    await expect(bankroll(page)).toHaveText('$1,000.00');

    await tapBetTile(page);
    // The stake leaves the bankroll as soon as the bet is placed.
    await expect(bankroll(page)).toHaveText('$995.00');
    await playRound(page);
    await expect(overlay(page)).toBeVisible();
    await expect(betTitle(page)).toContainText('Place your bets.');
  });

  test('plays several rounds, hitting, standing, doubling and splitting', async ({ page }) => {
    await openTable(page);
    const seen = new Set<string>();
    for (let round = 0; round < 15; round++) {
      await tapBetTile(page);
      await playRound(page, { prefer: ['split', 'double', 'hit'], seen });
    }
    // Hitting and standing are always on offer; the rest depend on the cards.
    expect([...seen]).toEqual(expect.arrayContaining(['hit', 'stand']));
    expect(seen.size).toBeGreaterThan(2);
    const after = await bankroll(page).textContent();
    expect(after).not.toBe('$1,000.00');
  });

  test('ignores taps while the deal is still being animated', async ({ page }) => {
    // Slow the deal right down so the animation is still running after the bet.
    await openTable(page, {
      settings: { 'mechanics.dealerSpeed': 1, 'mechanics.otherPlayerSpeed': 1, 'mechanics.payoffSpeed': 1 },
    });
    await grid(page).click({ position: { x: 25, y: 25 } });
    // Every action button stays hidden until the timeline has finished.
    for (const name of ACTIONS) {
      await expect(action(page, name)).toBeHidden();
    }
    // A swipe is dropped as well: no "Cannot hit" complaint, and no card dealt.
    const box = (await felt(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 4 });
    await page.mouse.up();
    // The table may be showing a dealing message, but never a refused action.
    await expect(tableToast(page)).toHaveCount(0);
    // Once the timeline finishes, the player is asked to act for the first time.
    await expect(action(page, 'stand')).toBeVisible({ timeout: 30000 });
    await expect(bankroll(page)).toHaveText('$995.00');
  });

  test('renders the table in portrait and in landscape', async ({ page }) => {
    await openTable(page, { size: PORTRAIT });
    const canvas = tableCanvas(page);
    const portrait = (await canvas.boundingBox())!;
    expect(portrait.height).toBeGreaterThan(portrait.width);

    await page.setViewportSize(LANDSCAPE);
    await expect.poll(async () => (await canvas.boundingBox())?.width).toBeGreaterThan(800);
    const landscape = (await canvas.boundingBox())!;
    expect(landscape.width).toBeGreaterThan(landscape.height);
    // The bet grid is re-laid out with the table.
    await expect(grid(page)).toBeVisible();
    await tapBetTile(page);
    await playRound(page);
  });

  test('shows the statistics and resets them', async ({ page }) => {
    await openTable(page);
    await tapBetTile(page);
    await playRound(page);

    await barButton(page, 'Stats').click();
    const rows = statsRows(page);
    await expect(rows.filter({ hasText: 'Rounds Played' })).toContainText('1');
    await expect(rows.filter({ hasText: 'Total Initial Bets' })).toContainText('$5');
    await expect(rows.filter({ hasText: 'Bankroll High' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Play Correct' })).toContainText('%');

    await page.getByRole('button', { name: 'Reset Stats' }).click();
    await yes(page).click();
    await expect(rows.filter({ hasText: 'Rounds Played' })).toContainText('0');

    await page.locator('[data-screen="game.stats"]').getByRole('button', { name: 'Back' }).click();
    await expect(overlay(page)).toBeVisible();
  });

  test('turns the in-table readouts on from the statistics screen', async ({ page }) => {
    await openTable(page);
    await expect(page.getByTestId('counts')).toHaveText('');
    await barButton(page, 'Stats').click();
    await page.getByRole('switch', { name: 'Display Running Count' }).click();
    await page.locator('[data-screen="game.stats"]').getByRole('button', { name: 'Back' }).click();
    await tapBetTile(page);
    await playRound(page);
    await expect(page.getByTestId('counts')).toContainText('RC:');
  });

  test('offers the betting overlay buttons, and Foul only when the dealer makes mistakes', async ({ page }) => {
    await openTable(page);
    for (const name of ['Side Bet', 'Reset Bank', 'Shuffle', 'Customize', 'Last Error']) {
      await expect(overlayButton(page, name)).toBeVisible();
    }
    await expect(overlayButton(page, 'Foul')).toBeHidden();
  });

  test('offers a Foul claim when the dealer makes mistakes', async ({ page }) => {
    await openTable(page, { settings: { 'dealerErrors.loseOnPush': true } });
    const foul = overlayButton(page, 'Foul');
    await expect(foul).toBeVisible();
    await foul.click();
    await expect(betTitle(page)).toHaveText('No dealer errors');
  });

  test('shuffles on request and resets the bankroll', async ({ page }) => {
    await openTable(page);
    await overlayButton(page, 'Shuffle').click();
    await expect(betTitle(page)).toContainText('Shuffled');

    await tapBetTile(page);
    await playRound(page);
    await overlayButton(page, 'Reset Bank').click();
    await yes(page).click();
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('says there is no error to review before one has been made', async ({ page }) => {
    await openTable(page);
    await barButton(page, 'Error').click();
    await expect(tableToast(page)).toHaveText('No play errors yet');
  });

  test('hands the chips back when the player leaves in the middle of a round', async ({ page }) => {
    await openTable(page);
    // A dealt blackjack settles at once with no decision to make, so deal
    // until the player has a hand in progress.
    let inProgress = false;
    const stand = action(page, 'stand');
    const pass = action(page, 'pass');
    for (let round = 0; round < 10 && !inProgress; round++) {
      await tapBetTile(page);
      for (let wait = 0; wait < 100; wait++) {
        await expect(visibleOneOf(stand, pass, overlay(page))).toBeVisible();
        if (await stand.isVisible()) {
          inProgress = true;
          break;
        }
        if (await pass.isVisible()) await pass.click();
        if (await overlay(page).isVisible()) break;
      }
    }
    expect(inProgress).toBe(true);
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem('cj.bankroll') ?? 'null')?.state.value ?? 1000,
    );
    const money = (n: number) =>
      `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    await expect(bankroll(page)).toHaveText(money(before - 5));
    await barButton(page, 'Back').click();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem('cj.bankroll') ?? 'null')?.state.value ?? null,
    );
    expect(saved).toBe(before);
  });

  test("shows a hand's result on its chips, then sweeps its cards", async ({ page }) => {
    // Slow enough to see each result.
    await openTable(page, { settings: { 'strategy.warnOnError': false, 'mechanics.payoffSpeed': 1 } });
    await tapBetTile(page);
    const hit = action(page, 'hit');
    const result = page.getByTestId('seat-chip').getByTestId('seat-result');
    await expect(hit).toBeVisible({ timeout: 30000 });
    // Hit until the hand is over. A hit hides the buttons until its card has landed.
    for (let i = 0; i < 12 && (await hit.isVisible()); i++) {
      await hit.click();
      await expect(visibleOneOf(hit, result)).toBeVisible({ timeout: 30000 });
    }
    await expect(result).toBeVisible({ timeout: 30000 });
    await expect(result).toHaveText(/^\s*(Win|Lose|Push|Bust|21)\s*$/);
    await expect(result).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('.table__status')).toHaveCount(0);
  });

  test('shows a betting mistake as soon as the cards start coming', async ({ page }) => {
    await page.clock.install();
    await openTable(page, {
      settings: {
        'mechanics.dealerSpeed': 10,
        'betting.warnOnError': true,
        // The first tile is the bet for a count of -1, so at 0 it is a mistake.
        'betting.ramp': { minCount: -1, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 1 })) },
      },
    });
    await tapBetTile(page);
    const toast = tableToast(page);
    await expect(toast).toBeVisible();
    // Still dealing: the player has not been asked to act yet.
    await expect(action(page, 'stand')).toBeHidden();
    await expect(toast).toHaveAttribute('data-type', 'error');
    const box = await toast.boundingBox();
    expect(box!.y).toBeLessThan(page.viewportSize()!.height / 2);
    // The table's own messages do not replace it while it is up.
    await page.clock.runFor(600);
    await expect(toast).toHaveAttribute('data-type', 'error');
  });

  test('plays with the action buttons hidden, using swipes', async ({ page }) => {
    await openTable(page, { settings: { 'display.hideActionButtons': undefined } });
    await tapBetTile(page);
    await expect(action(page, 'stand')).toBeHidden();
    const box = (await felt(page).boundingBox())!;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Swipe left to stand until the bets are asked for again. A swipe while the
    // cards are moving is dropped, so it is tried again until one lands.
    await expect(async () => {
      if (await overlay(page).isVisible()) return;
      if (await dialog(page).isVisible()) await dialog(page).getByRole('button').first().click();
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down();
      await page.mouse.move(centre.x - 120, centre.y, { steps: 4 });
      await page.mouse.up();
      expect(await overlay(page).isVisible()).toBe(true);
    }).toPass({ timeout: 15000 });
    await expect(overlay(page)).toBeVisible();
  });

  test('places a side bet and pays it when it wins', async ({ page }) => {
    // Lucky Ladies pays when the player's first two cards total 20.
    await openTable(page, { settings: { 'bonuses.game': 8 } });
    await overlayButton(page, 'Side Bet').click();
    await expect(page.locator('[data-screen="game.betSelect"]')).toBeVisible();
    await expect(chips(page).getByRole('button')).toHaveCount(18);
    // Lucky Ladies allows a side bet of at most one times the main bet.
    await chip(page, 1).click();
    await expect(betTitle(page)).toContainText('side bet');

    // The stake leaves the bankroll with the main bet.
    const before = await bankroll(page).textContent();
    await tapBetTile(page);
    expect(await bankroll(page).textContent()).not.toBe(before);
    await playRound(page);
    await expect(overlay(page)).toBeVisible();
  });

  test('refuses a side bet larger than its multiple of the main bet', async ({ page }) => {
    await openTable(page, { settings: { 'bonuses.game': 8 } });
    await overlayButton(page, 'Side Bet').click();
    await chip(page, 2).click();
    // The smallest main bet is one chip, and Lucky Ladies allows only one times it.
    await grid(page).click({ position: { x: 25, y: 25 } });
    await expect(overlay(page)).toBeVisible();
    await expect(betTitle(page)).toContainText('cannot be greater than 1 times the main bet');
  });
});
