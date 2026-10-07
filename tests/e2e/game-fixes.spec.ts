// The table's own count readout, and the two side-bet spots.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedRandom, visibleOneOf } from './support/app';
import type { SavedSettings } from './support/app';
import { readoutRunningCount as feltCount, statsRunningCount } from './support/table';

const PORTRAIT = { width: 390, height: 844 };

async function openTable(
  page: Page,
  {
    settings = {},
    seed = 7,
    size = PORTRAIT,
  }: { settings?: SavedSettings; seed?: number; size?: typeof PORTRAIT } = {},
) {
  await page.setViewportSize(size);
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
        'strategy.warnOnError': false,
        'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 1 })) },
        'rules.surrender': 'none',
        'display.hideActionButtons': false,
        'display.showRunningCount': true,
        ...overrides,
      }),
    );
  }, settings);
  await page.goto('/index.html');
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('.bet-overlay')).toBeVisible();
}

const grid = (page: Page) => page.locator('.bet-overlay__grid');

/** Plays one round out, however it ends. */
async function playRound(page: Page) {
  await grid(page).click({ position: { x: 25, y: 25 } });
  const stand = page.locator('.table__actions [data-action="stand"]');
  const pass = page.locator('.table__actions [data-action="pass"]');
  const overlay = page.locator('.bet-overlay');
  for (let i = 0; i < 25; i++) {
    await expect(visibleOneOf(stand, pass, overlay)).toBeVisible();
    if (await stand.isVisible()) {
      await stand.click();
      continue;
    }
    if (await pass.isVisible()) {
      await pass.click();
      continue;
    }
    if (await overlay.isVisible()) return;
  }
}

test.describe('the count the table shows', () => {
  test('matches the real count when the dealer hole card flashes', async ({ page }) => {
    await openTable(page, { settings: { 'peeking.mode': 'holeCard', 'peeking.percent': 100 } });
    for (let round = 0; round < 4; round++) {
      await playRound(page);
      expect(await feltCount(page), `round ${round}`).toBe(await statsRunningCount(page));
    }
  });

  test('matches the real count in a face-down game', async ({ page }) => {
    await openTable(page, { settings: { 'table.cardsFaceDown': true } });
    for (let round = 0; round < 4; round++) {
      await playRound(page);
      expect(await feltCount(page), `round ${round}`).toBe(await statsRunningCount(page));
    }
  });
});

test.describe('a game with two side-bet spots', () => {
  test('asks for each spot in turn and records both', async ({ page }) => {
    await openTable(page, { settings: { 'bonuses.game': 11 } });
    await page.locator('.bet-overlay [data-action="side-bet"]').click();
    await expect(page.locator('.bet-select')).toBeVisible();
    await expect(page.locator('.bet-select .topbar__title')).toContainText('U side bet');
    await page.locator('.bet-select__chips [data-chips="1"]').click();
    // The second spot is asked for next, not the first one again.
    await expect(page.locator('.bet-select')).toBeVisible();
    await expect(page.locator('.bet-select .topbar__title')).toContainText('O side bet');
    await page.locator('.bet-select__chips [data-chips="1"]').click();
    await expect(page.locator('.bet-overlay')).toBeVisible();
    await expect(page.locator('.bet-overlay__title')).toContainText('U side bet');
    await expect(page.locator('.bet-overlay__title')).toContainText('O side bet');
  });
});

test.describe('the action buttons', () => {
  // Known issue: the bet labels occupy the lowest band of the felt, so no
  // placement inside it clears them. Fixing this needs either the seat row
  // raised or the buttons moved off the felt, which is a design decision.
  for (const seats of [4, 6]) {
    test.fixme(`stay clear of every seat's bet at ${seats} seats`, async ({ page }) => {
      await openTable(page, { settings: { 'table.seatCount': seats } });
      await grid(page).click({ position: { x: 25, y: 25 } });
      await expect(page.locator('.table__actions [data-action="stand"]')).toBeVisible({ timeout: 30000 });
      const covered = await page.evaluate(() => {
        const hits = (a: DOMRect, b: DOMRect) =>
          !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const buttons = [...document.querySelectorAll<HTMLElement>('.table__actions .btn')]
          .filter(el => !el.hidden)
          .map(el => el.getBoundingClientRect());
        return [...document.querySelectorAll<HTMLElement>('.table__chip')]
          .filter(chip => buttons.some(box => hits(chip.getBoundingClientRect(), box)))
          .map(chip => chip.dataset.seat);
      });
      expect(covered).toEqual([]);
    });
  }
});

test.describe('the result shown on a seat at the payoff', () => {
  for (const [name, size] of [
    ['portrait', PORTRAIT],
    ['landscape', { width: 844, height: 390 }],
  ] as const)
    test(`looks like the app’s other pop-ups in ${name}`, async ({ page }) => {
      await openTable(page, { settings: { 'mechanics.payoffSpeed': 1 }, size });
      await grid(page).click({ position: { x: 25, y: 25 } });
      const stand = page.locator('.table__actions [data-action="stand"]');
      const pass = page.locator('.table__actions [data-action="pass"]');
      for (let i = 0; i < 25; i++) {
        await expect(visibleOneOf(stand, pass, page.locator('.table__result'))).toBeVisible({ timeout: 30000 });
        if (await stand.isVisible()) {
          await stand.click();
          continue;
        }
        if (await pass.isVisible()) {
          await pass.click();
          continue;
        }
        if (await page.locator('.table__result').count()) break;
      }
      const result = page.locator('.table__result').first();
      await expect(result).toBeVisible({ timeout: 30000 });

      const compare = await page.evaluate(async () => {
        const el = document.querySelector<HTMLElement>('.table__result')!;
        const tone = el.dataset.tone;
        const url = '/src/ui/toast.ts';
        const { toast }: typeof import('@/ui/toast') = await import(url);
        const pop = toast('x', { tone: tone === 'win' ? 'good' : tone === 'lose' ? 'error' : 'plain' });
        const pick = (node: Element) => {
          const c = getComputedStyle(node);
          return {
            radius: c.borderTopLeftRadius,
            shadow: c.boxShadow !== 'none',
            weight: c.fontWeight,
            size: c.fontSize,
            background: c.backgroundColor,
            color: c.color,
          };
        };
        const box = el.getBoundingClientRect();
        const holder = el.parentElement!;
        const clipped =
          getComputedStyle(holder).overflow !== 'visible' &&
          (box.height > holder.clientHeight + 0.5 || box.width > holder.clientWidth + 0.5);
        const out = {
          tone,
          result: pick(el),
          popUp: pick(pop),
          chipWidth: holder.getBoundingClientRect().width,
          width: box.width,
          clipped,
        };
        pop.remove();
        return out;
      });
      // A pill sized to its text, like the pop-ups, not a slab filling the seat.
      expect(compare.result).toEqual(compare.popUp);
      expect(compare.width).toBeLessThan(compare.chipWidth);
      // Nothing of the pill may be cut off by the seat's label box.
      expect(compare.clipped).toBe(false);
    });
});

test.describe('opening the table', () => {
  test('burns the first card into the tray before betting opens', async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize(PORTRAIT);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        'cj.settings',
        JSON.stringify({
          // Slow enough to watch: each step of the shuffle takes most of a second.
          'mechanics.dealerSpeed': 1,
          'table.burnCards': 1,
          'table.showBurnCards': true,
          'display.hideActionButtons': false,
        }),
      );
    });
    await page.goto('/index.html');
    await page.locator('[data-action="play"]').click();
    await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
    // The burn is still being shown, so the betting menu must not be up yet.
    await page.clock.runFor(400);
    await expect(page.locator('.bet-overlay')).toBeHidden();
    // Then it goes into the tray and betting opens.
    await expect(page.locator('.bet-overlay')).toBeVisible({ timeout: 10000 });
  });
});
