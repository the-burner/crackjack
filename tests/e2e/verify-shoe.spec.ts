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

/** Opens the table with a seeded deal and the frame, overlay and chip logs on. */
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
      // Seat 1's chip label and the bankroll, as painted, sampled once per animation frame.
      window.__cjChip = [];
      const sample = () => {
        const text = document.querySelector(`${sel.chip}[data-seat="1"]`)?.textContent ?? null;
        const bank = document.querySelector(sel.bankroll)?.textContent ?? null;
        const last = window.__cjChip.at(-1);
        if (last?.text !== text || last?.bank !== bank) window.__cjChip.push({ t: performance.now(), text, bank });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
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
    window.__cjChip = [];
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
const rankOf = (id: number) => ((id - 1) % 13) + 1;
const valueOf = (id: number) => Math.min(rankOf(id), 10);

/**
 * Bets the smallest amount and plays the round out, clearing the logs first, so
 * the frames returned are this round's, up to and including the next shuffle.
 */
async function playRound(
  page: Page,
  {
    prefer = ['stand'],
    insure = false,
    onTurn = null,
  }: { prefer?: string[]; insure?: boolean; onTurn?: (() => Promise<void>) | null } = {},
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
      await action(page, insure ? 'insure' : 'pass').click();
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

  test('deals a hidden burn card face down into the tray, and does not count it', async ({ page }) => {
    await openTable(page, { settings: { 'table.burnCards': 1, 'table.showBurnCards': false } });
    const log = await frames(page);
    const shown = findFrom(log, 0, f => f.burns.length === 1);
    expect(shown).toBeGreaterThanOrEqual(0);
    expect(log[shown].burns[0].faceUp).toBe(false);
    expect(log.slice(shown).some(f => f.burns.some(b => b.faceUp))).toBe(false);
    // Seed 7 burns the same card as above, which would count if seen.
    expect(await countOf(page, [log[shown].burns[0].card])).not.toBe('0');
    expect(findFrom(log, shown, f => f.burns.length === 0 && f.trayCards === 1)).toBeGreaterThan(shown);
    expect(await readout(page)).toBe('0');
    expect(await statsCount(page)).toBe('0');
  });
});

test.describe('the number of burn cards', () => {
  test('burns nothing when set to 0', async ({ page }) => {
    await openTable(page, { settings: { 'table.burnCards': 0 } });
    const log = await frames(page);
    expect(log.some(f => f.burns.length > 0)).toBe(false);
    expect(log.at(-1)!.trayCards).toBe(0);
    expect(log.at(-1)!.shoeCards).toBe(312);
    expect(await readout(page)).toBe('0');
  });

  test('burns three when set to 3', async ({ page }) => {
    await openTable(page, { settings: { 'table.burnCards': 3, 'table.showBurnCards': true } });
    const log = await frames(page);
    const three = findFrom(log, 0, f => f.burns.length === 3);
    expect(three).toBeGreaterThanOrEqual(0);
    expect(log[three].burns.every(b => b.faceUp)).toBe(true);
    expect(findFrom(log, three, f => f.burns.length === 0 && f.trayCards === 3)).toBeGreaterThan(three);
    expect(log.at(-1)!.shoeCards).toBe(309);
    const expected = await countOf(
      page,
      log[three].burns.map(b => b.card),
    );
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

test.describe('insurance', () => {
  test('takes the insurance chips off the seat as soon as the dealer has checked', async ({ page }) => {
    test.setTimeout(180000);
    await openTable(page, {
      settings: { 'rules.insurance': 'normal', 'rules.dealerPeeksAce': true, 'mechanics.payoffSpeed': 60 },
    });
    let checked: { log: Frame[]; chip: Window['__cjChip']; reveal?: number; missing?: boolean } | null = null;
    for (let round = 0; round < 60 && !checked; round++) {
      const log = await playRound(page, { insure: true });
      const chip = await page.evaluate(() => window.__cjChip);
      if (!chip.some(c => c.text === '$7.50')) {
        const up = log.find(f => f.dealer.cards.length === 2)?.dealer.cards[0];
        // An ace up must offer insurance; anything else is a round to skip.
        if (up && valueOf(up) === 1) {
          const hole = log.find(f => f.dealer.cards.length === 2)!.dealer.cards[1];
          const blackjack = valueOf(hole) === 10;
          if (!blackjack) checked = { log, chip, missing: true };
        }
        continue;
      }
      const reveal = log.findIndex(f => f.dealer.faceUp[1] === true && f.dealer.faceUp[0] === true);
      const hole = log.find(f => f.dealer.cards.length === 2)!.dealer.cards[1];
      if (valueOf(hole) === 10) continue;
      checked = { log, chip, reveal };
    }
    expect(checked, 'a round with insurance against an ace and no blackjack').not.toBeNull();
    const { chip, log, reveal, missing } = checked!;
    // Insurance was bought: the bankroll paid half the $5 bet.
    const banks = chip.map(c => Number(c.bank?.replace(/[$,]/g, '')));
    expect(
      banks.some((bank, i) => i > 0 && banks[i - 1] - bank === 2.5),
      JSON.stringify(chip.map(c => c.bank)),
    ).toBe(true);
    // The stake was put up and shown on the seat.
    expect(
      missing,
      `seat 1 label never showed the insurance stake; it showed ${JSON.stringify(chip.map(c => c.text))}`,
    ).toBeFalsy();
    const insured = chip.findIndex(c => c.text === '$7.50');
    const back = findFrom(chip, insured, c => c.text === '$5');
    expect(back, 'the insurance stake comes off the label').toBeGreaterThan(insured);
    // Before the dealer's hand is played out at the end of the round.
    expect(chip[back].t).toBeLessThan(log[reveal!].t);
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

  test('flashes only under an upcard the dealer checks', async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, {
      settings: {
        'peeking.mode': 'whenDealerPeeks',
        'peeking.percent': 100,
        'rules.dealerPeeksAce': true,
        'rules.dealerPeeksTen': true,
      },
    });
    const seen = { checked: 0, other: 0 };
    for (let round = 0; round < 20; round++) {
      const log = await playRound(page);
      const up = log.find(f => f.dealer.cards.length === 2)!.dealer.cards[0];
      const flashed = holeCardFlash(log) !== null;
      const checks = valueOf(up) === 1 || valueOf(up) === 10;
      expect(flashed, `round ${round}: upcard ${valueOf(up)}`).toBe(checks);
      seen[checks ? 'checked' : 'other'] += 1;
    }
    expect(seen.checked).toBeGreaterThan(0);
    expect(seen.other).toBeGreaterThan(0);
  });

  test('does not flash under a ten when the dealer does not check tens', async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, {
      settings: {
        'peeking.mode': 'whenDealerPeeks',
        'peeking.percent': 100,
        'rules.dealerPeeksAce': true,
        'rules.dealerPeeksTen': false,
      },
    });
    let tens = 0;
    for (let round = 0; round < 15; round++) {
      const log = await playRound(page);
      const up = log.find(f => f.dealer.cards.length === 2)!.dealer.cards[0];
      expect(holeCardFlash(log) !== null, `round ${round}: upcard ${valueOf(up)}`).toBe(valueOf(up) === 1);
      if (valueOf(up) === 10) tens += 1;
    }
    expect(tens).toBeGreaterThan(0);
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

  test("randomize card turns up the neighbour's cards one by one, at random", async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, { settings: { ...FACE_DOWN, 'peeking.adjacentHands': true, 'peeking.randomizeCard': true } });
    const patterns = new Set<string>();
    for (let round = 0; round < 10; round++) {
      const log = await playRound(page);
      const deal = endOfDeal(log);
      patterns.add(JSON.stringify(log[deal].hands.find(h => h.key === '2-0')!.faceUp));
      expect(log[deal].hands.find(h => h.key === '3-0')!.faceUp).toEqual([false, false]);
      expect(await readout(page), `round ${round}`).toBe(await statsCount(page));
    }
    // Some cards up and some down, and at least once a hand split between the two.
    expect([...patterns].some(p => p.includes('true'))).toBe(true);
    expect([...patterns].some(p => p.includes('false'))).toBe(true);
    expect(patterns.has('[true,false]') || patterns.has('[false,true]')).toBe(true);
  });

  test("randomize hand turns up the whole neighbour's hand or none of it", async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, { settings: { ...FACE_DOWN, 'peeking.adjacentHands': true, 'peeking.randomizeHand': true } });
    const patterns = new Set<string>();
    for (let round = 0; round < 10; round++) {
      const log = await playRound(page);
      const deal = endOfDeal(log);
      patterns.add(JSON.stringify(log[deal].hands.find(h => h.key === '2-0')!.faceUp));
      expect(await readout(page), `round ${round}`).toBe(await statsCount(page));
    }
    expect([...patterns].sort()).toEqual(['[false,false]', '[true,true]']);
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

test.describe('the double-down card face down', () => {
  test('stays down until the showdown, then is turned up before the hand is paid', async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, {
      settings: {
        'table.doubleDownCardFaceUp': false,
        'table.seatCount': 4,
        'table.computerSeats': [false, true, true, true, false, false],
      },
    });
    let doubled: { log: Frame[]; at: number; key: string } | null = null;
    for (let round = 0; round < 25 && !doubled; round++) {
      const log = await playRound(page, { prefer: ['double'] });
      const at = log.findIndex(f => f.hands.some(h => h.cards.length >= 3 && h.faceUp[2] === false));
      if (at >= 0)
        doubled = { log, at, key: log[at].hands.find(h => h.cards.length >= 3 && h.faceUp[2] === false)!.key };
    }
    expect(doubled, 'a hand was doubled').not.toBeNull();
    const { log, at, key } = doubled!;
    const showdown = findFrom(log, at, f => f.dealer.cards.length >= 2 && f.dealer.faceUp[1] === true);
    expect(showdown).toBeGreaterThan(at);
    for (const f of log.slice(at, showdown)) {
      const hand = f.hands.find(h => h.key === key);
      if (hand) expect(hand.faceUp[2], `${key} before the showdown`).toBe(false);
    }
    const last = log.findLastIndex(f => f.hands.some(h => h.key === key && h.cards.length >= 3));
    expect(log[last].hands.find(h => h.key === key)!.faceUp[2], `${key}'s double card when it was paid`).toBe(true);
    expect(await readout(page)).toBe(await statsCount(page));
  });
});

test.describe('players come and go', () => {
  test('changes the occupied computer seats now and then, and otherwise keeps them', async ({ page }) => {
    test.setTimeout(300000);
    await openTable(page, {
      settings: {
        'mechanics.dealerSpeed': 100,
        'mechanics.otherPlayerSpeed': 100,
        'mechanics.payoffSpeed': 100,
        'table.playersComeAndGo': true,
        // Portrait shows four seats.
        'table.seatCount': 4,
        'table.computerSeats': [false, true, true, true, false, false],
      },
    });
    const seatings: string[] = [];
    for (let round = 0; round < 60; round++) {
      const log = await playRound(page);
      const seats = new Set(
        log.flatMap(f =>
          f.hands.filter(h => h.cards.length > 0 && !h.key.startsWith('1-')).map(h => h.key.split('-')[0]),
        ),
      );
      seatings.push([...seats].sort().join(','));
    }
    const changes = seatings.slice(1).filter((s, i) => s !== seatings[i]).length;
    expect(changes, seatings.join(' | ')).toBeGreaterThan(0);
    // About 7% of rounds; well under a third.
    expect(changes, seatings.join(' | ')).toBeLessThan(15);
  });
});

test.describe('the cut card', () => {
  /** Plays rounds, noting the cards drawn from the shoe by the end of each and whether it was reshuffled after. */
  async function shoeRounds(page: Page, count: number) {
    const rounds: { drawn: number; reshuffled: boolean; midRound: boolean }[] = [];
    for (let round = 0; round < count; round++) {
      const log = await playRound(page);
      const cleared = log.findLastIndex(f => cardCount(f) > 0);
      const drawn = 52 - Math.min(...log.slice(0, cleared + 1).map(f => f.shoeCards));
      const reshuffled = findFrom(log, cleared, f => freshShoe(f, 1)) > cleared;
      // A reshuffle mid-round would show the shoe filling up again while cards are out.
      const midRound = log.slice(0, cleared + 1).some((f, i) => i > 0 && f.shoeCards > log[i - 1].shoeCards);
      rounds.push({ drawn, reshuffled, midRound });
      if (reshuffled) break;
    }
    return rounds;
  }

  test('reshuffles at the end of the round in which the card after penetration came out', async ({ browser }) => {
    test.setTimeout(180000);
    const base = { 'table.decks': 1, 'table.shuffleMode': 'cutCard', 'table.burnCards': 1 };
    // First, deep penetration, to learn how many cards each round leaves drawn.
    const first = await browser.newPage();
    await openTable(first, { settings: { ...base, 'table.cardsBehindCutCard': 10 }, seed: 11 });
    const learned = await shoeRounds(first, 3);
    await first.close();
    expect(learned.length).toBe(3);
    const atPenetration = learned[1].drawn;

    // Then the same deal with the cut card placed right after round 2's last card.
    const page = await browser.newPage();
    await openTable(page, { settings: { ...base, 'table.cardsBehindCutCard': 52 - atPenetration }, seed: 11 });
    const rounds = await shoeRounds(page, 4);
    expect(rounds.map(r => r.drawn).slice(0, 2)).toEqual(learned.slice(0, 2).map(r => r.drawn));
    // Round 2 ended exactly at penetration: no cut card yet.
    expect(rounds[1].reshuffled, `round 2 ended with ${atPenetration} drawn, at penetration`).toBe(false);
    // Round 3 drew the card after penetration: reshuffled at its end, not during it.
    expect(rounds[2].reshuffled, 'round 3 drew past penetration').toBe(true);
    expect(rounds.some(r => r.midRound)).toBe(false);
    await page.close();
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

  test('counts every card dealt, including the one a split hand draws, in an unshuffled shoe', async ({ page }) => {
    test.setTimeout(180000);
    await openTable(page, {
      settings: {
        'table.shuffleMode': 'rounds',
        'table.roundsPerShoe': 80,
        'table.burnCards': 1,
        'table.showBurnCards': true,
        'table.seatCount': 4,
        'table.computerSeats': [false, true, true, true, false, false],
      },
    });
    // In a face-up game every card dealt is seen by the end of its round.
    const seen = [(await frames(page)).find(f => f.burns.length === 1)!.burns[0].card];
    let splits = 0;
    for (let round = 0; round < 80 && splits < 4; round++) {
      const log = await playRound(page, { prefer: ['split'] });
      // Each hand's cards as last drawn, which takes in split hands.
      const keys = new Set(log.flatMap(f => [f.dealer, ...f.hands].filter(h => h.cards.length > 0).map(h => h.key)));
      for (const key of keys) {
        const last = log.findLast(f => [f.dealer, ...f.hands].some(h => h.key === key && h.cards.length > 0))!;
        seen.push(...[last.dealer, ...last.hands].find(h => h.key === key)!.cards);
      }
      const expected = await countOf(page, seen);
      if (!log.some(f => f.hands.some(h => h.key.endsWith('-1')))) {
        // No split: the tally and the readout agree.
        expect(await readout(page), `round ${round}, no split`).toBe(expected);
        continue;
      }
      splits += 1;
      const hands = [...keys]
        .map(
          key =>
            `${key}: ${log
              .findLast(f => f.hands.some(h => h.key === key && h.cards.length))
              ?.hands.find(h => h.key === key)
              ?.cards.map(rankOf)
              .join(' ')}`,
        )
        .join('; ');
      expect(await readout(page), `round ${round}, after a split (${hands}): the readout`).toBe(expected);
      expect(await statsCount(page), `round ${round}, after a split: the Stats count`).toBe(expected);
    }
    expect(splits, 'hands were split').toBe(4);
  });

  test('turns a busted computer hand face up before sweeping it, in a face-down game', async ({ page }) => {
    test.setTimeout(180000);
    await openTable(page, { settings: FACE_DOWN });
    let busts = 0;
    for (let round = 0; round < 12; round++) {
      const log = await playRound(page);
      const deal = endOfDeal(log);
      const showdown = findFrom(log, deal, f => f.dealer.cards.length >= 2 && f.dealer.faceUp[1] === true);
      for (const key of ['2-0', '3-0', '4-0']) {
        const last = log.findLastIndex(f => f.hands.some(h => h.key === key && h.cards.length > 0));
        if (last < 0 || last >= showdown) continue;
        // Swept in play: it busted.
        busts += 1;
        const hand = log[last].hands.find(h => h.key === key)!;
        expect(hand.faceUp, `round ${round}: ${key} ${JSON.stringify(hand.cards)} as it was swept`).toEqual(
          hand.cards.map(() => true),
        );
      }
    }
    expect(busts).toBeGreaterThan(0);
  });
});
