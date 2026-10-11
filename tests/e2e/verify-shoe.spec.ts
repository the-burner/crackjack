// Checks, on screen, the shoe, burn, peeking and face-down behaviour copied
// from the original app. The table is a canvas, so these read the renderer's
// frame log (window.__cjFrames) and assert order and duration.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Frame } from './globals.d';
import { seedRandom, visibleOneOf } from './support/app';
import type { SavedSettings } from './support/app';
import {
  betOverlay,
  betTitle,
  dialog as openDialog,
  overlayButton,
  playButton,
  readoutRunningCount as readout,
  SELECTOR,
  statsRunningCount as statsCount,
  tapBetTile,
  startGame,
} from './support/table';

/** Opens the table with a seeded deal and the frame and overlay logs on. */
async function openTable(page: Page, { settings = {}, seed = 7 }: { settings?: SavedSettings; seed?: number } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRandom(page, seed);
  await page.addInitScript(
    ({ overrides, sel }) => {
      window.__cjRecordFrames = true;
      // When the betting menu shows and hides.
      window.__cjOverlay = [];
      new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>(sel.overlay);
        const visible = Boolean(el && !el.hidden);
        const log = window.__cjOverlay;
        if (log.at(-1)?.visible !== visible) log.push({ t: performance.now(), visible });
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
      localStorage.clear();
      localStorage.setItem(
        'cj.settings',
        JSON.stringify({
          'mechanics.dealerSpeed': 99,
          'mechanics.otherPlayerSpeed': 99,
          'mechanics.payoffSpeed': 99,
          'table.startingBankroll': 1000,
          'table.seatCount': 1,
          'table.computerSeats': [false, false, false, false, false, false],
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
    },
    { overrides: settings, sel: SELECTOR },
  );
  await page.goto('/index.html');
  await startGame(page);
  await expect(betOverlay(page)).toBeVisible({ timeout: 20000 });
}

const overlay = betOverlay;
const action = playButton;
const frames = (page: Page) => page.evaluate(() => window.__cjFrames ?? []);
const overlayLog = (page: Page) => page.evaluate(() => window.__cjOverlay);
const clearLogs = (page: Page) =>
  page.evaluate(() => {
    window.__cjFrames = [];
    window.__cjOverlay = [];
  });

/** What a fresh shoe's running count is after seeing `cards`, by the selected strategy. */
const countOf = (page: Page, cards: number[]) =>
  page.evaluate(async seen => {
    const url = '/src/core/counting.ts';
    const { Counter }: typeof import('@/core/counting') = await import(url);
    const decks = window.app.settings.get('table.decks');
    const counter = new Counter(window.app.strategies.current(window.app.settings, decks), {
      division: 0,
      lastDeck: 1,
      rounding: 0,
    });
    counter.reset(decks);
    for (const card of seen) counter.addCard(card, 1);
    return String(Math.round(counter.running * 10) / 10);
  }, cards);

/** The first frame at or after index `from` that matches. */
const findFrom = <T>(list: T[], from: number, test: (item: T, index: number) => boolean) => {
  for (let i = from; i < list.length; i++) if (test(list[i], i)) return i;
  return -1;
};

const cardCount = (frame: Frame) =>
  frame.dealer.cards.length + frame.hands.reduce((sum, hand) => sum + hand.cards.length, 0);

/**
 * Bets the smallest amount and plays the round out, clearing the logs first, so
 * the frames returned are this round's, up to and including the next shuffle.
 */
async function playRound(
  page: Page,
  { prefer = ['stand'], onTurn = null }: { prefer?: string[]; onTurn?: (() => Promise<void>) | null } = {},
) {
  await clearLogs(page);
  await tapBetTile(page);
  const dialog = openDialog(page);
  for (let step = 0; step < 300; step++) {
    // Until the table wants something: the cards may still be coming.
    await expect(
      visibleOneOf(
        dialog,
        overlay(page),
        ...['pass', 'hit', 'stand', 'double', 'split'].map(name => action(page, name)),
      ),
    ).toBeVisible();
    if (await dialog.isVisible()) {
      await dialog.getByRole('button').first().click();
      continue;
    }
    if (await overlay(page).isVisible()) return frames(page);
    if (await action(page, 'pass').isVisible()) {
      await action(page, 'pass').click();
      continue;
    }
    const offered: string[] = [];
    for (const name of ['hit', 'stand', 'double', 'split']) {
      if (await action(page, name).isVisible()) offered.push(name);
    }
    const pick = [...prefer, 'stand'].find(name => offered.includes(name));
    if (pick) {
      if (onTurn) await onTurn();
      await action(page, pick).click();
    }
  }
  throw new Error('the round never came back to the betting menu');
}

/** True for a frame showing a fresh shoe: nothing drawn yet. */
const freshShoe = (frame: Frame, decks: number) =>
  frame.shoeCards === decks * 52 && cardCount(frame) === 0 && frame.burns.length === 0;

test.describe('opening the table', () => {
  test('shows the burn face up, puts it in the tray, and only then opens betting', async ({ page }) => {
    await openTable(page, {
      settings: { 'mechanics.dealerSpeed': 50, 'table.burnCards': 1, 'table.showBurnCards': true },
    });
    const log = await frames(page);
    const shuffled = findFrom(log, 0, f => freshShoe(f, 6));
    const shown = findFrom(log, Math.max(0, shuffled), f => f.burns.length === 1 && f.burns[0].faceUp);
    const inTray = findFrom(log, shown, f => f.burns.length === 0 && f.trayCards === 1);
    expect(shuffled, 'a fresh shoe is drawn').toBeGreaterThanOrEqual(0);
    expect(shown, 'the burn is shown face up').toBeGreaterThan(shuffled);
    expect(inTray, 'the burn goes into the tray').toBeGreaterThan(shown);
    expect(log[shown].shoeCards).toBe(311);
    // Shown long enough to be seen: a step at dealer speed 50 is about 425 ms.
    expect(log[inTray].t - log[shown].t).toBeGreaterThan(300);
    const opened = (await overlayLog(page)).filter(entry => entry.visible);
    expect(opened.length).toBeGreaterThan(0);
    expect(opened[0].t, 'betting opens after the burn is in the tray').toBeGreaterThanOrEqual(log[inTray].t);
  });
});

test.describe('counting the burn card', () => {
  test('counts a burn card that is shown, before the first bet', async ({ page }) => {
    await openTable(page, { settings: { 'table.burnCards': 1, 'table.showBurnCards': true } });
    const burn = (await frames(page)).find(f => f.burns.length === 1)!.burns[0];
    expect(burn.faceUp).toBe(true);
    const expected = await countOf(page, [burn.card]);
    // This seed's burn has a count value, so counting it shows.
    expect(expected).not.toBe('0');
    expect(await readout(page)).toBe(expected);
    expect(await statsCount(page)).toBe(expected);
  });
});

test.describe('between shoes', () => {
  test('reshuffles and burns at the end of the round, before the next bets, and starts a new count', async ({
    page,
  }) => {
    await openTable(page, {
      settings: {
        'table.shuffleMode': 'rounds',
        'table.roundsPerShoe': 1,
        'table.burnCards': 1,
        'table.showBurnCards': true,
      },
    });
    const first = await frames(page);
    const firstBurn = first.find(f => f.burns.length === 1)!.burns[0].card;

    const round = await playRound(page);
    const dealt = findFrom(round, 0, f => cardCount(f) > 0);
    const shuffled = findFrom(round, dealt, f => freshShoe(f, 6));
    expect(shuffled, 'the shoe is reshuffled at the end of the round').toBeGreaterThan(dealt);
    const shown = findFrom(round, shuffled, f => f.burns.length === 1 && f.burns[0].faceUp);
    const inTray = findFrom(round, shown, f => f.burns.length === 0 && f.trayCards === 1 && f.shoeCards === 311);
    expect(shown).toBeGreaterThan(shuffled);
    expect(inTray).toBeGreaterThan(shown);
    const opened = (await overlayLog(page)).filter(e => e.visible);
    expect(opened[0].t, 'betting opens after the new burn is in the tray').toBeGreaterThanOrEqual(round[inTray].t);

    // The old shoe's count is not carried over.
    const newBurn = round[shown].burns[0].card;
    const seenLastShoe = [
      firstBurn,
      ...new Set(
        round
          .slice(0, shuffled)
          .flatMap(f =>
            [f.dealer, ...f.hands]
              .flatMap(hand => hand.cards.map((card, i) => (hand.faceUp[i] ? `${hand.key}:${i}:${card}` : null)))
              .filter((entry): entry is string => entry !== null),
          ),
      ),
    ].map(entry => (typeof entry === 'number' ? entry : Number(entry.split(':')[2])));
    const expected = await countOf(page, [newBurn]);
    const carried = await countOf(page, [...seenLastShoe, newBurn]);
    expect(await readout(page)).toBe(expected);
    expect(await statsCount(page)).toBe(expected);
    // Only meaningful when the old shoe's count was not zero.
    expect(carried).not.toBe(expected);

    // Nothing is shuffled once the next bet is down.
    const next = await playRound(page);
    const bet = findFrom(next, 0, f => cardCount(f) > 0);
    const cleared = findFrom(next, bet, f => cardCount(f) === 0);
    const during = next.slice(bet, cleared);
    expect(during.some(f => f.burns.length > 0 || f.shoeCards >= 311)).toBe(false);
  });
});

test.describe('the Shuffle button', () => {
  test('reshuffles, shows and counts the burn, puts it in the tray, and resets the count', async ({ page }) => {
    await openTable(page, { settings: { 'table.burnCards': 1, 'table.showBurnCards': true } });
    await playRound(page);
    await clearLogs(page);
    await overlayButton(page, 'Shuffle').click();
    await expect(betTitle(page)).toContainText('Shuffled');
    await expect.poll(async () => (await frames(page)).some(f => f.burns.length === 1 && f.burns[0].faceUp)).toBe(true);
    const log = await frames(page);
    const shown = findFrom(log, 0, f => f.burns.length === 1 && f.burns[0].faceUp);
    expect(log[shown].shoeCards).toBe(311);
    const expected = await countOf(page, [log[shown].burns[0].card]);
    expect(await readout(page)).toBe(expected);
    expect(await statsCount(page)).toBe(expected);
    // As at the opening: the burn then goes into the tray, while betting is still open.
    await expect
      .poll(
        async () => {
          const last = (await frames(page)).at(-1)!;
          return { burns: last.burns.length, tray: last.trayCards };
        },
        { timeout: 5000 },
      )
      .toEqual({ burns: 0, tray: 1 });
    await expect(overlay(page)).toBeVisible();
  });
});

/** Indices of frames where the dealer's hole card flashed up and went back down. */
function holeCardFlash(log: Frame[]) {
  const up = log.findIndex(f => f.dealer.cards.length === 2 && f.dealer.faceUp[1] === true);
  if (up < 0) return null;
  const down = findFrom(log, up, f => f.dealer.cards.length === 2 && f.dealer.faceUp[1] === false);
  return down < 0 ? null : { up, down };
}

test.describe('peeking at the hole card', () => {
  test('flashes the hole card for about half a second during the deal, and counts it once', async ({ page }) => {
    await openTable(page, { settings: { 'peeking.mode': 'holeCard', 'peeking.percent': 100, 'table.burnCards': 1 } });
    for (let round = 0; round < 4; round++) {
      const log = await playRound(page);
      const flash = holeCardFlash(log);
      expect(flash, `round ${round}: the hole card flashed`).not.toBeNull();
      const ms = log[flash!.down].t - log[flash!.up].t;
      expect(ms, `round ${round}: flash length`).toBeGreaterThan(350);
      expect(ms, `round ${round}: flash length`).toBeLessThan(800);
      // During the deal: the player has not been asked to act yet.
      expect(log.slice(0, flash!.down).some(f => f.pointer)).toBe(false);
      expect(await readout(page), `round ${round}: readout against the session's count`).toBe(await statsCount(page));
    }
  });
});

/** The four-seat face-down table: the player in seat 1, computers in 2 to 4. */
const FACE_DOWN = {
  'table.cardsFaceDown': true,
  'table.seatCount': 4,
  'table.computerSeats': [false, true, true, true, false, false],
};

/** The frame at the end of the initial deal: every hand has two cards. */
const endOfDeal = (log: Frame[]) =>
  log.findIndex(f => f.dealer.cards.length === 2 && f.hands.length >= 4 && f.hands.every(h => h.cards.length === 2));

test.describe('peeking right and left', () => {
  test("deals the neighbour's cards face up and counts them; other seats stay face down", async ({ page }) => {
    await openTable(page, { settings: { ...FACE_DOWN, 'peeking.adjacentHands': true } });
    const burn = (await frames(page)).find(f => f.burns.length === 1)!.burns[0].card;
    for (let round = 0; round < 3; round++) {
      let atTurn = null as { frame: Frame; rc: string | undefined } | null;
      const log = await playRound(page, {
        onTurn: async () => {
          if (atTurn) return;
          atTurn = { frame: (await frames(page)).at(-1)!, rc: await readout(page) };
        },
      });
      const deal = endOfDeal(log);
      expect(deal).toBeGreaterThanOrEqual(0);
      const hand = (key: string) => log[deal].hands.find(h => h.key === key)!;
      expect(hand('2-0').faceUp, `round ${round}: the neighbour in seat 2`).toEqual([true, true]);
      expect(hand('3-0').faceUp, `round ${round}: seat 3`).toEqual([false, false]);
      expect(hand('4-0').faceUp, `round ${round}: seat 4`).toEqual([false, false]);
      if (round === 0 && atTurn) {
        // At the player's turn the readout is everything face up so far, the neighbour's cards included.
        const visible = [atTurn.frame.dealer, ...atTurn.frame.hands].flatMap(h =>
          h.cards.filter((_, i) => h.faceUp[i]),
        );
        expect(visible).toEqual(expect.arrayContaining(hand('2-0').cards));
        expect(atTurn.rc).toBe(await countOf(page, [burn, ...visible]));
      }
      expect(await readout(page), `round ${round}`).toBe(await statsCount(page));
    }
  });
});

test.describe('a face-down game', () => {
  test("shows the player's hand for its turn, hides it on standing, and turns every hand up at the showdown", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await openTable(page, { settings: FACE_DOWN });
    for (let round = 0; round < 5; round++) {
      const log = await playRound(page);
      const deal = endOfDeal(log);
      expect(deal).toBeGreaterThanOrEqual(0);
      expect(
        log[deal].hands.every(h => h.faceUp.every(up => !up)),
        `round ${round}: dealt face down`,
      ).toBe(true);
      // The dealer's hole card turning up marks the showdown.
      const showdown = findFrom(log, deal, f => f.dealer.cards.length >= 2 && f.dealer.faceUp[1] === true);
      expect(showdown).toBeGreaterThan(deal);
      const mine = (f: Frame) => f.hands.find(h => h.key === '1-0');
      const turn = findFrom(log, deal, f => f.pointer?.hand === '1-0');
      if (turn >= 0) {
        expect(mine(log[turn])!.faceUp.every(Boolean), `round ${round}: face up for its turn`).toBe(true);
        const hidden = findFrom(log, turn, f => {
          const hand = mine(f);
          return !!hand && hand.cards.length > 0 && hand.faceUp.every(up => !up);
        });
        expect(hidden, `round ${round}: face down again after standing`).toBeGreaterThan(turn);
        expect(hidden).toBeLessThan(showdown);
      }
      // Computer seats' first two cards stay down until the showdown. A hand that
      // busts or has blackjack is settled early, and is turned up to be swept.
      const lasting = new Set(log[showdown].hands.filter(h => h.cards.length > 0).map(h => h.key));
      for (const f of log.slice(deal, showdown)) {
        for (const h of f.hands.filter(h => h.key !== '1-0' && h.key.endsWith('-0') && lasting.has(h.key))) {
          expect(h.faceUp.slice(0, 2), `round ${round}: ${h.key} before the showdown`).toEqual([false, false]);
        }
      }
      // Every hand still on the table at the showdown is face up before it is swept.
      const atShowdown = log[showdown].hands.filter(h => h.cards.length > 0).map(h => h.key);
      for (const key of atShowdown) {
        const last = log.findLastIndex(f => f.hands.some(h => h.key === key && h.cards.length > 0));
        const hand = log[last].hands.find(h => h.key === key)!;
        expect(hand.faceUp.every(Boolean), `round ${round}: ${key} when it was paid`).toBe(true);
      }
      expect(await readout(page), `round ${round}`).toBe(await statsCount(page));
    }
  });
});

test.describe('extra findings', () => {
  test('the readout agrees with the Stats count after a split', async ({ page }) => {
    test.setTimeout(180000);
    await openTable(page, {
      settings: { 'table.seatCount': 4, 'table.computerSeats': [false, true, true, true, false, false] },
    });
    let splits = 0;
    for (let round = 0; round < 80 && splits < 4; round++) {
      const log = await playRound(page, { prefer: ['split'] });
      if (!log.some(f => f.hands.some(h => h.key.endsWith('-1')))) continue;
      splits += 1;
      expect(await readout(page), `round ${round}, after a split`).toBe(await statsCount(page));
    }
    expect(splits, 'hands were split').toBe(4);
  });
});
