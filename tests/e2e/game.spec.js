// End-to-end tests of the blackjack table: betting, playing out hands, the
// statistics screen, both orientations, and the rule that input is ignored
// while a deal is still being animated.

import { test, expect } from '@playwright/test';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/** Starts with a clean installation and the fastest animation speeds. */
async function openTable(page, { settings = {}, size = PORTRAIT } = {}) {
  await page.setViewportSize(size);
  await page.addInitScript(overrides => {
    localStorage.clear();
    localStorage.setItem('bjv.settings', JSON.stringify({
      'mechanics.dealerSpeed': 99,
      'mechanics.otherPlayerSpeed': 99,
      'mechanics.payoffSpeed': 99,
      ...overrides,
    }));
  }, settings);
  await page.goto('/index.html');
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('.bet-overlay')).toBeVisible();
  return page.locator('.table');
}

const bankroll = page => page.locator('.table__bankroll');
const overlay = page => page.locator('.bet-overlay');
const grid = page => page.locator('.bet-overlay__grid');
const action = (page, name) => page.locator(`.table__actions [data-action="${name}"]`);

/** Clicks the first tile of the bet grid, which is the smallest bet. */
async function placeBet(page) {
  await grid(page).click({ position: { x: 25, y: 25 } });
  await expect(overlay(page)).toBeHidden();
}

/**
 * Plays the hand in front of the player until the next bet is asked for, and
 * reports which actions the table offered along the way.
 */
async function playRound(page, { prefer = ['stand'], seen = new Set() } = {}) {
  for (let step = 0; step < 60; step++) {
    // The dealer queries an obviously bad play once; say OK and press again.
    const dialog = page.locator('.dialog-overlay');
    if (await dialog.isVisible()) {
      await dialog.locator('button').first().click();
      continue;
    }
    if (await overlay(page).isVisible()) return seen;
    const insure = page.locator('[data-action="pass"]');
    if (await insure.isVisible()) {
      await insure.click();
      continue;
    }
    const offered = [];
    for (const name of ['hit', 'stand', 'double', 'split', 'surrender']) {
      if (await action(page, name).isVisible()) {
        offered.push(name);
        seen.add(name);
      }
    }
    const pick = [...prefer, 'stand'].find(name => offered.includes(name));
    if (pick) await action(page, pick).click();
    else await page.waitForTimeout(100);
  }
  throw new Error('the round never came back to the betting overlay');
}

test.describe('the table', () => {
  test('deals, pays and comes back for another bet', async ({ page }) => {
    await openTable(page);
    await expect(bankroll(page)).toHaveText('$1,000.00');

    await placeBet(page);
    // The stake leaves the bankroll as soon as the bet is placed.
    await expect(bankroll(page)).toHaveText('$995.00');
    await playRound(page);
    await expect(overlay(page)).toBeVisible();
    await expect(overlay(page).locator('.bet-overlay__title')).toContainText('Place your bets.');
  });

  test('plays several rounds, hitting, standing, doubling and splitting', async ({ page }) => {
    await openTable(page);
    const seen = new Set();
    for (let round = 0; round < 15; round++) {
      await placeBet(page);
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
    await openTable(page, { settings: { 'mechanics.dealerSpeed': 1, 'mechanics.otherPlayerSpeed': 1, 'mechanics.payoffSpeed': 1 } });
    await grid(page).click({ position: { x: 25, y: 25 } });
    // Every action button stays hidden until the timeline has finished.
    for (const name of ['hit', 'stand', 'double', 'split', 'surrender']) {
      await expect(action(page, name)).toBeHidden();
    }
    // A swipe is dropped as well: no "Cannot hit" complaint, and no card dealt.
    const box = await page.locator('.table__felt').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 4 });
    await page.mouse.up();
    // The table may be showing a dealing message, but never a refused action.
    await expect(page.locator('.table__status')).not.toContainText('Cannot');
    // Once the timeline finishes, the player is asked to act for the first time.
    await expect(action(page, 'stand')).toBeVisible({ timeout: 30000 });
    await expect(bankroll(page)).toHaveText('$995.00');
  });

  test('renders the table in portrait and in landscape', async ({ page }) => {
    await openTable(page, { size: PORTRAIT });
    const canvas = page.locator('.table__canvas');
    const portrait = await canvas.boundingBox();
    expect(portrait.height).toBeGreaterThan(portrait.width);

    await page.setViewportSize(LANDSCAPE);
    await expect.poll(async () => (await canvas.boundingBox()).width).toBeGreaterThan(800);
    const landscape = await canvas.boundingBox();
    expect(landscape.width).toBeGreaterThan(landscape.height);
    // The bet grid is re-laid out with the table.
    await expect(grid(page)).toBeVisible();
    await placeBet(page);
    await playRound(page);
  });

  test('shows the statistics and resets them', async ({ page }) => {
    await openTable(page);
    await placeBet(page);
    await playRound(page);

    await page.locator('[data-action="stats"]').click();
    const rows = page.locator('.stats-table tr');
    await expect(rows.filter({ hasText: 'Rounds Played' })).toContainText('1');
    await expect(rows.filter({ hasText: 'Total Initial Bets' })).toContainText('$5');
    await expect(rows.filter({ hasText: 'Bankroll High' })).toBeVisible();
    await expect(rows.filter({ hasText: 'Play Correct' })).toContainText('%');

    await page.locator('[data-action="reset-stats"]').click();
    await page.locator('.dialog__buttons button', { hasText: 'Yes' }).click();
    await expect(rows.filter({ hasText: 'Rounds Played' })).toContainText('0');

    await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
    await expect(overlay(page)).toBeVisible();
  });

  test('turns the in-table readouts on from the statistics screen', async ({ page }) => {
    await openTable(page);
    await expect(page.locator('.table__counts')).toHaveText('');
    await page.locator('[data-action="stats"]').click();
    await page.locator('.check', { hasText: 'Display Running Count' }).click();
    await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
    await placeBet(page);
    await playRound(page);
    await expect(page.locator('.table__counts')).toContainText('RC:');
  });

  test('offers the betting overlay buttons, and Foul only when the dealer makes mistakes', async ({ page }) => {
    await openTable(page);
    for (const name of ['side-bet', 'reset-bank', 'shuffle', 'customize', 'last-error']) {
      await expect(overlay(page).locator(`[data-action="${name}"]`)).toBeVisible();
    }
    await expect(overlay(page).locator('[data-action="foul"]')).toBeHidden();
  });

  test('offers a Foul claim when the dealer makes mistakes', async ({ page }) => {
    await openTable(page, { settings: { 'dealerErrors.loseOnPush': true } });
    const foul = overlay(page).locator('[data-action="foul"]');
    await expect(foul).toBeVisible();
    await foul.click();
    await expect(overlay(page).locator('.bet-overlay__title')).toHaveText('No dealer errors');
  });

  test('shuffles on request and resets the bankroll', async ({ page }) => {
    await openTable(page);
    await overlay(page).locator('[data-action="shuffle"]').click();
    await expect(overlay(page).locator('.bet-overlay__title')).toContainText('shuffled');

    await placeBet(page);
    await playRound(page);
    await overlay(page).locator('[data-action="reset-bank"]').click();
    await page.locator('.dialog__buttons button', { hasText: 'Yes' }).click();
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('says there is no error to review before one has been made', async ({ page }) => {
    await openTable(page);
    await page.locator('[data-action="error"]').click();
    await expect(page.locator('.table__status')).toContainText('No play errors yet');
  });

  test('hands the chips back when the player leaves in the middle of a round', async ({ page }) => {
    await openTable(page);
    await placeBet(page);
    await expect(action(page, 'stand')).toBeVisible();
    await expect(bankroll(page)).toHaveText('$995.00');
    await page.locator('.table__bar [data-action="back"]').click();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bjv.bankroll')));
    expect(saved).toBe(1000);
  });

  test('plays with the action buttons hidden, using swipes', async ({ page }) => {
    await openTable(page, { settings: { 'display.hideActionButtons': true } });
    await placeBet(page);
    await expect(action(page, 'stand')).toBeHidden();
    const felt = page.locator('.table__felt');
    const box = await felt.boundingBox();
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Swipe left to stand, round after round, until the bets are asked for again.
    for (let step = 0; step < 16 && !(await overlay(page).isVisible()); step++) {
      const dialog = page.locator('.dialog-overlay');
      if (await dialog.isVisible()) {
        await dialog.locator('button').first().click();
        continue;
      }
      await page.mouse.move(centre.x, centre.y);
      await page.mouse.down();
      await page.mouse.move(centre.x - 120, centre.y, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
    await expect(overlay(page)).toBeVisible();
  });

  test('picks a side bet amount on the bet picker', async ({ page }) => {
    await openTable(page, { settings: { 'bonuses.game': 8 } });
    await overlay(page).locator('[data-action="side-bet"]').click();
    await expect(page.locator('.bet-select')).toBeVisible();
    await expect(page.locator('.bet-select__chips .btn')).toHaveCount(18);
    await page.locator('.bet-select__chips [data-chips="2"]').click();
    await expect(page.locator('.dialog__body')).toContainText('not paid out');
    await page.locator('.dialog__buttons button').click();
    await expect(overlay(page)).toBeVisible();
  });
});
