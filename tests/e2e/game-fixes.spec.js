// The table's own count readout, and the two side-bet spots.

import { test, expect } from '@playwright/test';

const PORTRAIT = { width: 390, height: 844 };

async function openTable(page, { settings = {}, seed = 7, size = PORTRAIT } = {}) {
  await page.setViewportSize(size);
  await page.addInitScript(start => {
    let a = start;
    // Only the app's own calls follow the seed: a library's (React makes ids) must not shift it.
    const libraryRandom = Math.random;
    Math.random = () => {
      if (!(new Error().stack ?? '').includes('/src/')) return libraryRandom();
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
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

const grid = page => page.locator('.bet-overlay__grid');

/** Plays one round out, however it ends. */
async function playRound(page) {
  await grid(page).click({ position: { x: 25, y: 25 } });
  for (let i = 0; i < 25; i++) {
    const stand = page.locator('.table__actions [data-action="stand"]');
    if (await stand.isVisible()) {
      await stand.click();
      continue;
    }
    const pass = page.locator('.table__actions [data-action="pass"]');
    if (await pass.isVisible()) {
      await pass.click();
      continue;
    }
    if (await page.locator('.bet-overlay').isVisible()) return;
    await page.waitForTimeout(120);
  }
}

/** The running count the Statistics screen reports. */
async function statsRunningCount(page) {
  await page.locator('.table__bar [data-action="stats"]').click();
  await expect(page.locator('[data-screen="game.stats"]')).toBeVisible();
  const row = page.locator('tr', { has: page.getByText('Running Count', { exact: true }) });
  const value = (await row.locator('td').last().textContent()).trim();
  await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
  await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
  return value;
}

const feltCount = async page => (await page.locator('.table__counts').textContent()).match(/RC: (-?[\d.]+)/)?.[1];

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
        const hits = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const buttons = [...document.querySelectorAll('.table__actions .btn')]
          .filter(el => !el.hidden)
          .map(el => el.getBoundingClientRect());
        return [...document.querySelectorAll('.table__chip')]
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
  ])
    test(`looks like the app’s other pop-ups in ${name}`, async ({ page }) => {
      await openTable(page, { settings: { 'mechanics.payoffSpeed': 1 }, size });
      await grid(page).click({ position: { x: 25, y: 25 } });
      for (let i = 0; i < 25; i++) {
        const stand = page.locator('.table__actions [data-action="stand"]');
        if (await stand.isVisible()) {
          await stand.click();
          continue;
        }
        const pass = page.locator('.table__actions [data-action="pass"]');
        if (await pass.isVisible()) {
          await pass.click();
          continue;
        }
        if (await page.locator('.table__result').count()) break;
        await page.waitForTimeout(100);
      }
      const result = page.locator('.table__result').first();
      await expect(result).toBeVisible({ timeout: 30000 });

      const compare = await page.evaluate(async () => {
        const el = document.querySelector('.table__result');
        const tone = el.dataset.tone;
        const { toast } = await import('/src/ui/toast.ts');
        const pop = toast('x', { tone: tone === 'win' ? 'good' : tone === 'lose' ? 'error' : 'plain' });
        const pick = node => {
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
        const holder = el.parentElement;
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
    await page.waitForTimeout(400);
    await expect(page.locator('.bet-overlay')).toBeHidden();
    // Then it goes into the tray and betting opens.
    await expect(page.locator('.bet-overlay')).toBeVisible({ timeout: 10000 });
  });
});
