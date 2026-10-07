// The table's own count readout, and the two side-bet spots.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedRandom, visibleOneOf } from './support/app';
import type { SavedSettings } from './support/app';
import {
  betGrid as grid,
  betOverlay,
  betTitle,
  playButton,
  results,
  SELECTOR,
  tableScreen,
  readoutRunningCount as feltCount,
  statsRunningCount,
  startGame,
} from './support/table';

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
  await startGame(page);
  await expect(betOverlay(page)).toBeVisible();
}

const betSelect = (page: Page) => page.locator('[data-screen="game.betSelect"]');
const chip = (page: Page, n: number) =>
  betSelect(page)
    .getByRole('group', { name: 'Chips' })
    .getByRole('button', { name: String(n), exact: true });

/** Plays one round out, however it ends. */
async function playRound(page: Page) {
  await grid(page).click({ position: { x: 25, y: 25 } });
  const stand = playButton(page, 'stand');
  const pass = playButton(page, 'pass');
  const overlay = betOverlay(page);
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
    await betOverlay(page).getByRole('button', { name: 'Side Bet' }).click();
    await expect(betSelect(page)).toBeVisible();
    await expect(betSelect(page).getByRole('heading', { level: 1 })).toContainText('U side bet');
    await chip(page, 1).click();
    // The second spot is asked for next, not the first one again.
    await expect(betSelect(page)).toBeVisible();
    await expect(betSelect(page).getByRole('heading', { level: 1 })).toContainText('O side bet');
    await chip(page, 1).click();
    await expect(betOverlay(page)).toBeVisible();
    await expect(betTitle(page)).toContainText('U side bet');
    await expect(betTitle(page)).toContainText('O side bet');
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
      await expect(playButton(page, 'stand')).toBeVisible({ timeout: 30000 });
      const covered = await page.evaluate(sel => {
        const hits = (a: DOMRect, b: DOMRect) =>
          !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const buttons = [...document.querySelectorAll<HTMLElement>(sel.actions)]
          .filter(el => !el.hidden)
          .map(el => el.getBoundingClientRect());
        return [...document.querySelectorAll<HTMLElement>(sel.chip)]
          .filter(chip => buttons.some(box => hits(chip.getBoundingClientRect(), box)))
          .map(chip => chip.dataset.seat);
      }, SELECTOR);
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
      const stand = playButton(page, 'stand');
      const pass = playButton(page, 'pass');
      for (let i = 0; i < 25; i++) {
        await expect(visibleOneOf(stand, pass, results(page))).toBeVisible({ timeout: 30000 });
        if (await stand.isVisible()) {
          await stand.click();
          continue;
        }
        if (await pass.isVisible()) {
          await pass.click();
          continue;
        }
        if (await results(page).count()) break;
      }
      const result = results(page).first();
      await expect(result).toBeVisible({ timeout: 30000 });

      const compare = await page.evaluate(async sel => {
        const el = document.querySelector<HTMLElement>(sel.result)!;
        const tone = el.dataset.tone;
        const url = '/src/components/game/table-toast.tsx';
        const { tableToast }: typeof import('@/components/game/table-toast') = await import(url);
        tableToast('x', { tone: tone === 'win' ? 'good' : tone === 'lose' ? 'error' : 'plain', ms: 60000 });
        let pop: HTMLElement | undefined;
        for (let i = 0; i < 100 && !pop; i++) {
          await new Promise(requestAnimationFrame);
          pop = [...document.querySelectorAll<HTMLElement>(`${sel.toast}:not([data-leaving])`)].find(
            li => li.textContent === 'x',
          );
        }
        // The box from the pop-up, the type from its text.
        const pick = (box: Element, text: Element) => {
          const c = getComputedStyle(box);
          const t = getComputedStyle(text);
          return {
            radius: c.borderTopLeftRadius,
            shadow: c.boxShadow !== 'none',
            weight: t.fontWeight,
            size: t.fontSize,
            background: c.backgroundColor,
            color: t.color,
          };
        };
        const box = el.getBoundingClientRect();
        const holder = el.parentElement!;
        const clipped =
          getComputedStyle(holder).overflow !== 'visible' &&
          (box.height > holder.clientHeight + 0.5 || box.width > holder.clientWidth + 0.5);
        return {
          tone,
          result: pick(el, el),
          popUp: pick(pop!, pop!),
          chipWidth: holder.getBoundingClientRect().width,
          width: box.width,
          clipped,
        };
      }, SELECTOR);
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
    await startGame(page);
    await expect(tableScreen(page)).toBeVisible();
    // The burn is still being shown, so the betting menu must not be up yet.
    await page.clock.runFor(400);
    await expect(betOverlay(page)).toBeHidden();
    // Then it goes into the tray and betting opens.
    await expect(betOverlay(page)).toBeVisible({ timeout: 10000 });
  });
});
