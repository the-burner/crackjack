// The renderer's opt-in frame log, which the parity checks read to see exactly
// what the table drew and for how long.

import { test, expect } from '@playwright/test';
import { seedRandom } from './support/app';
import { betGrid, betOverlay, playButton, startGame } from './support/table';

test('records each frame the table draws, when a test asks it to', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // The same cards every run, so the round always reaches the player's turn.
  await seedRandom(page, 7);
  await page.addInitScript(() => {
    window.__cjRecordFrames = true;
    localStorage.clear();
    localStorage.setItem(
      'cj.settings',
      JSON.stringify({
        'mechanics.dealerSpeed': 99,
        'mechanics.otherPlayerSpeed': 99,
        'mechanics.payoffSpeed': 99,
        'display.hideActionButtons': false,
        'table.seatCount': 1,
        'table.computerSeats': [false, false, false, false, false, false],
      }),
    );
  });
  await page.goto('/index.html');
  await startGame(page);
  await betGrid(page).click({ position: { x: 25, y: 25 } });
  await expect(playButton(page, 'stand')).toBeVisible({ timeout: 30000 });

  // The pointer image may still be arriving; it must be drawn within a moment.
  await expect
    .poll(() => page.evaluate(() => window.__cjFrames?.at(-1)?.pointer ?? null), { timeout: 1000 })
    .not.toBeNull();
  const frames = (await page.evaluate(() => window.__cjFrames)) ?? [];
  expect(frames.length).toBeGreaterThan(5);
  const last = frames.at(-1)!;
  expect(typeof last.t).toBe('number');
  // The player's two cards, where they were drawn, and the pointer above them.
  const mine = last.hands.find(hand => hand.key === '1-0')!;
  expect(mine.cards).toHaveLength(2);
  expect(mine.slots).toHaveLength(2);
  expect(last.pointer).toMatchObject({ hand: '1-0' });
  expect(last.pointer!.y).toBeLessThan(mine.slots[0].y);
  expect(last.dealer.cards).toHaveLength(2);
  expect(last.dealer.faceUp).toEqual([true, false]);
  expect(typeof last.trayCards).toBe('number');
});

test('records nothing unless asked', async ({ page }) => {
  await page.goto('/index.html');
  await startGame(page);
  await expect(betOverlay(page)).toBeVisible({ timeout: 10000 });
  expect(await page.evaluate(() => window.__cjFrames)).toBeUndefined();
});
