// Dealer errors and the game statistics, checked through the table itself:
// what the player sees, what Foul does, and what the Stats screen shows.
//
// Randomness: Math.random is replaced. A call made from dealer-errors.ts (the
// dealer's "does it make a mistake now?" roll) returns a value the test picks,
// keyed by the deciding function's name, so an allowed error always happens
// (0) or never does (0.99). Every other call is a seeded generator. The cards
// themselves are stacked: the shoe's draw takes from `window.__cjStack` while
// it has cards, so each test deals exactly the hands it describes.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SavedSettings } from './support/app';
import {
  bankroll,
  barButton,
  betGrid,
  betOverlay,
  overlayButton,
  playButton,
  readout,
  statValue,
  tableToast,
  startGame,
} from './support/table';

/** Card ids are suit * 13 + rank; spades by default. */
const card = (rank: number, suit = 0) => suit * 13 + rank;
const [A, K] = [1, 13];

const ALL_HUMAN = [false, false, false, false, false, false];

const BASE_SETTINGS = {
  'mechanics.dealerSpeed': 99,
  'mechanics.otherPlayerSpeed': 99,
  'mechanics.payoffSpeed': 99,
  'mechanics.dealerPointsOutStupidPlays': false,
  'mechanics.dealerMakesObviousPlays': false,
  'table.startingBankroll': 1000,
  'table.seatCount': 1,
  'table.computerSeats': ALL_HUMAN,
  'table.burnCards': 0,
  'game.betting.chipValue': 10,
  'game.betting.warnOnError': false,
  'game.strategy.warnOnError': false,
  // A count of 10 is never reached, so the first row is always the right bet.
  'game.betting.ramp': {
    minCount: 10,
    rows: [
      { chips: 1, hands: 1 },
      { chips: 2, hands: 1 },
    ],
  },
  'rules.surrender': 'none',
  'display.hideActionButtons': false,
  'display.sound': true,
};

/**
 * Opens the table with the given settings and error rolls. The setup runs
 * once per tab, so a reload keeps what the app saved.
 */
async function openTable(
  page: Page,
  { settings = {}, rolls = {} }: { settings?: SavedSettings; rolls?: Record<string, number> } = {},
) {
  await page.addInitScript(
    ({ rolls: picked }) => {
      let a = 11;
      const seeded = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      window.__cjRolls = { dealerStandsByMistake: 0, bustsGoodHandByMistake: 0, pickDealerError: 0, ...picked };
      // Only the app's own calls follow the seed: a library's (React makes ids) must not shift it.
      const libraryRandom = Math.random;
      Math.random = () => {
        // The nearest caller decides: an app frame before any library frame.
        const stack = new Error().stack ?? '';
        const app = stack.indexOf('/src/');
        const library = stack.indexOf('/node_modules/');
        if (app < 0 || (library >= 0 && library < app)) return libraryRandom();
        if (stack.includes('dealer-errors.ts')) {
          const name = Object.keys(window.__cjRolls).find(fn => stack.includes(fn));
          return name ? window.__cjRolls[name] : 0;
        }
        return seeded();
      };
      // What the player hears: the file each sound effect would play.
      window.__cjSounds = [];
      // Result pills on the seats, with when they appeared.
      window.__cjResults = [];
      window.__cjRecordFrames = true;
      new MutationObserver(() => {
        for (const pill of document.querySelectorAll<HTMLElement>(
          '[data-testid="seat-chip"] [data-testid="seat-result"]',
        )) {
          if (pill.dataset.seen) continue;
          pill.dataset.seen = '1';
          window.__cjResults.push({ text: pill.textContent, t: performance.now() });
        }
      }).observe(document, { childList: true, subtree: true });
    },
    { rolls },
  );
  await page.addInitScript(
    ({ overrides }) => {
      if (sessionStorage.getItem('cj-test-setup')) return;
      sessionStorage.setItem('cj-test-setup', '1');
      localStorage.clear();
      localStorage.setItem('cj.settings', JSON.stringify(overrides));
    },
    { overrides: { ...BASE_SETTINGS, ...settings } },
  );
  await page.goto('/index.html');
  await page.evaluate(() => {
    window.app.sound.output = file => window.__cjSounds.push(file.split('/').pop()!);
  });
  await stackTheShoe(page);
  await startGame(page);
  await expect(overlay(page)).toBeVisible();
}

/** Makes the shoe deal from `window.__cjStack` while it has cards. */
async function stackTheShoe(page: Page) {
  await page.evaluate(async () => {
    const url = '/src/game/engine/shoe.ts';
    const { Shoe }: typeof import('@/game/engine/shoe') = await import(url);
    const draw = Shoe.prototype.draw;
    window.__cjStack = [];
    Shoe.prototype.draw = function stackedDraw() {
      const next = window.__cjStack.shift();
      if (next === undefined) return draw.call(this);
      this.remainingByCard[next] -= 1;
      this.remaining -= 1;
      this.dealt += 1;
      return next;
    };
  });
}

const overlay = betOverlay;
const action = playButton;
const foul = (page: Page) => overlayButton(page, 'Foul');
const statsScreen = (page: Page) => page.locator('[data-screen="game.stats"]');
const statsTable = (page: Page) => statsScreen(page).getByRole('table');
const closeStats = (page: Page) => statsScreen(page).getByRole('button', { name: 'Back', exact: true }).click();

/**
 * Plays one round from stacked cards. With one seat the deal is player,
 * dealer up card, player, hole card; then the player's draws, then the
 * dealer's. `tile` is which bet tile to tap (0 is the smallest).
 */
async function playRound(
  page: Page,
  {
    cards,
    actions = ['stand'],
    tile = 0,
    insure = null,
  }: { cards: number[]; actions?: string[]; tile?: number; insure?: boolean | null },
) {
  await page.evaluate(stack => {
    window.__cjStack = stack;
  }, cards);
  await page.evaluate(() => {
    window.__cjRoundStart = performance.now();
  });
  await tapTile(page, tile);
  if (insure !== null) {
    const answer = playButton(page, insure ? 'insure' : 'pass');
    await expect(answer).toBeVisible();
    await answer.click();
  }
  for (const name of actions) {
    await expect(action(page, name)).toBeVisible();
    await action(page, name).click();
  }
  await expect(overlay(page)).toBeVisible();
}

async function tapTile(page: Page, index: number) {
  const grid = betGrid(page);
  const box = (await grid.boundingBox())!;
  await grid.click({ position: { x: 25 + (index * box.width) / 6, y: 25 } });
  await expect(overlay(page)).toBeHidden();
}

/** Frames drawn since the round began. */
const roundFrames = (page: Page) =>
  page.evaluate(() => (window.__cjFrames ?? []).filter(frame => frame.t >= window.__cjRoundStart));

/** The most cards the dealer held this round. */
async function dealerCards(page: Page) {
  const frames = await roundFrames(page);
  return frames.reduce(
    (most, frame) => (frame.dealer.cards.length > most.length ? frame.dealer.cards : most),
    [] as number[],
  );
}

/** Result pills shown this round. */
const roundResults = (page: Page) =>
  page.evaluate(() => window.__cjResults.filter(r => r.t >= window.__cjRoundStart).map(r => r.text));

/** Sounds played since `from` (an index into the sound log). */
const soundsSince = (page: Page, from: number) => page.evaluate(start => window.__cjSounds.slice(start), from);
const soundCount = (page: Page) => page.evaluate(() => window.__cjSounds.length);

async function callFoul(page: Page) {
  await expect(foul(page)).toBeVisible();
  await foul(page).click();
}

async function openStats(page: Page) {
  await barButton(page, 'Stats').click();
  await expect(statsTable(page)).toBeVisible();
}

const stat = statValue;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

// --- 1. Busted a good hand ---------------------------------------------------

test.describe('busted a good hand', () => {
  const settings = { 'dealerErrors.bustOn21OrLess': true };

  test('a three-card 20 is called a bust as the card lands and swept before the dealer plays', async ({ page }) => {
    await openTable(page, { settings });
    // Player 5, 6, hits a 9 for 20; dealer 10 and 7.
    await playRound(page, { cards: [card(5), card(10), card(6), card(7), card(9)], actions: ['hit'] });
    const results = await page.evaluate(() => window.__cjResults.filter(r => r.t >= window.__cjRoundStart));
    expect(results.map(r => r.text)).toEqual(['Bust']);

    const frames = await roundFrames(page);
    const revealed = frames.find(frame => frame.dealer.faceUp[1] === true)!;
    expect(revealed).toBeTruthy();
    // The label showed, and the hand left the table, while the hole card was still down.
    expect(results[0].t).toBeLessThan(revealed.t);
    const held = frames.findIndex(frame => frame.hands.find(hand => hand.key === '1-0')?.cards.length === 3);
    const sweptAt = frames.findIndex((frame, i) => i > held && !frame.hands.some(hand => hand.key === '1-0'));
    expect(held).toBeGreaterThanOrEqual(0);
    expect(sweptAt).toBeGreaterThan(held);
    expect(frames[sweptAt].t).toBeLessThan(revealed.t);
    expect(frames[sweptAt].dealer.faceUp[1]).toBe(false);
    // It paid nothing.
    await expect(bankroll(page)).toHaveText('$990.00');
  });

  test('Foul on a busted good hand refunds twice the bet when the dealer was behind', async ({ page }) => {
    await openTable(page, { settings });
    // Player 21 on three cards against the dealer's 17.
    await playRound(page, { cards: [card(5), card(10), card(6), card(7), card(10, 1)], actions: ['hit'] });
    expect(await roundResults(page)).toEqual(['Bust']);
    await expect(bankroll(page)).toHaveText('$990.00');
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });
});

// --- 2. Stood on 16 ----------------------------------------------------------

test.describe('stood on 16', () => {
  const settings = { 'dealerErrors.standOn16': true };
  // The player stands on 10 and 2.
  const player12 = (up: number, hole: number) => [card(10), up, card(2), hole];

  test('the dealer stops on a four-card hard 16 when the player has less than 17, and Foul catches it', async ({
    page,
  }) => {
    await openTable(page, { settings });
    // Dealer 2, 3, 4, 7 = hard 16; a 5 would follow if it drew.
    await playRound(page, { cards: [...player12(card(2), card(3)), card(4), card(7), card(5)] });
    expect(await dealerCards(page)).toEqual([card(2), card(3), card(4), card(7)]);
    expect(await roundResults(page)).toEqual(['Lose']);
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
  });
});

// --- 3. Should have busted ---------------------------------------------------

test.describe('should have busted', () => {
  const settings = { 'dealerErrors.shouldHaveBusted': true };
  // The player stands on 20.
  const player20 = (up: number, hole: number) => [card(10), up, card(K), hole];

  test('a four-card 22 is claimed as 21, and Foul refunds the win', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 6, 6, 2, 8 = 22.
    await playRound(page, { cards: [...player20(card(6), card(6, 1)), card(2), card(8)] });
    expect(await dealerCards(page)).toHaveLength(4);
    expect(await roundResults(page)).toEqual(['Lose']);
    await expect(bankroll(page)).toHaveText('$990.00');
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });
});

// --- 4. BJ mispaid -----------------------------------------------------------

test.describe('blackjack mispaid', () => {
  const settings = { 'dealerErrors.blackjackPayoff': true };
  // A spade blackjack against the dealer's 9 and 8.
  const natural = [card(A), card(9), card(K), card(8)];

  test('a natural is paid even money, and Foul refunds the premium', async ({ page }) => {
    await openTable(page, { settings });
    await playRound(page, { cards: natural, actions: [] });
    await expect(bankroll(page)).toHaveText('$1,010.00');
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,015.00');
  });
});

// --- 5. Insurance mispaid ----------------------------------------------------

test.describe('insurance mispaid', () => {
  const settings = { 'dealerErrors.insurancePayoff': true };

  test('insurance on a hand that lost to the blackjack is paid 1:1, and Foul refunds the difference', async ({
    page,
  }) => {
    await openTable(page, { settings });
    // Player 10, 8 insures against the dealer's A, K.
    await playRound(page, { cards: [card(10), card(A), card(8), card(K)], actions: [], insure: true });
    expect(await roundResults(page)).toEqual(['Lose']);
    // Paid properly, the $5 insurance returns $15 and the bankroll is back at $1,000.
    await expect(bankroll(page)).toHaveText('$995.00');
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });
});

// --- 6. Foul outcomes --------------------------------------------------------

test.describe('calling Foul', () => {
  const busted20 = [card(5), card(10), card(6), card(7), card(9)];

  test('a correct call plays the click and refunds', async ({ page }) => {
    await openTable(page, { settings: { 'dealerErrors.bustOn21OrLess': true } });
    await playRound(page, { cards: busted20, actions: ['hit'] });
    const before = await soundCount(page);
    await callFoul(page);
    await expect(tableToast(page, 'good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,010.00');
    const heard = await soundsSince(page, before);
    expect(heard).toContain('click.mp3');
    expect(heard).not.toContain('buzz.mp3');
  });

  test('a call with no error is a false call: buzzer, error tone, and no money moves', async ({ page }) => {
    await openTable(page, {
      settings: { 'dealerErrors.bustOn21OrLess': true },
      rolls: { bustsGoodHandByMistake: 0.99 },
    });
    await playRound(page, { cards: busted20, actions: ['hit', 'stand'] });
    await expect(bankroll(page)).toHaveText('$1,010.00');
    const before = await soundCount(page);
    await callFoul(page);
    await expect(tableToast(page, 'error')).toHaveText('No dealer errors');
    await expect(bankroll(page)).toHaveText('$1,010.00');
    expect(await soundsSince(page, before)).toContain('buzz.mp3');
  });

  test('an error the player never calls is reported when the next round starts', async ({ page }) => {
    await openTable(page, { settings: { 'dealerErrors.bustOn21OrLess': true } });
    await playRound(page, { cards: busted20, actions: ['hit'] });
    await expect(bankroll(page)).toHaveText('$990.00');
    await page.evaluate(
      stack => {
        window.__cjStack = stack;
      },
      [card(10, 1), card(7, 1), card(9, 1), card(K, 1)],
    );
    await tapTile(page, 0);
    await expect(tableToast(page, 'error')).toHaveText('You missed a dealer error, Busted a good hand, costing $20');
    // Nothing is refunded: the $10 bet is out on the new round.
    await expect(bankroll(page)).toHaveText('$980.00');
  });
});

// --- 7. Stats: accuracy ------------------------------------------------------

test('bet accuracy is floored and play accuracy rounded, on the Stats screen and the table', async ({ page }) => {
  await openTable(page, {
    settings: {
      'game.betting.warnOnError': true,
      'game.strategy.warnOnError': true,
      'display.showBetAccuracy': true,
      'display.showPlayAccuracy': true,
    },
  });
  // Neutral cards only. Player 9, 8 against the dealer's 9, 8.
  const round = (suit: number) => [card(9, suit), card(9, (suit + 1) % 4), card(8, suit), card(8, (suit + 1) % 4)];
  await playRound(page, { cards: round(0) });
  await playRound(page, { cards: round(1) });
  // The wrong bet ($20) and the wrong play (hitting 17).
  await playRound(page, { cards: [...round(2), card(9, 3)], tile: 1, actions: ['hit'] });
  await expect(readout(page)).toHaveText('Bets: 66%, Plays: 67%');
  await openStats(page);
  await expect(stat(page, 'Bet Correct')).toHaveText('66%');
  await expect(stat(page, 'Play Correct')).toHaveText('67%');
});

// --- 8. Stats survive a reload -----------------------------------------------

test.describe('saved statistics', () => {
  test('survive a reload', async ({ page }) => {
    await openTable(page, { settings: { 'dealerErrors.bustOn21OrLess': true } });
    await playRound(page, { cards: [card(5), card(10), card(6), card(7), card(9)], actions: ['hit'] });
    await callFoul(page);
    await foul(page).click();
    await openStats(page);
    const labels = [
      'Rounds Played',
      'Total Initial Bets',
      'Top Bet',
      'Low Bet',
      'Bankroll',
      'Dealer Error Correct',
      'Dealer Errors Missed',
    ];
    const before = await Promise.all(labels.map(label => stat(page, label).textContent()));
    expect(before).toEqual(['1', '$10', '$10', '$10', '$1,010', '50%', '1']);

    // The URL keeps the screen: the reload opens the Stats screen of a fresh table.
    await page.reload();
    await expect(page.locator('[data-screen="game.stats"]')).toBeVisible();
    const after = await Promise.all(labels.map(label => stat(page, label).textContent()));
    expect(after).toEqual(before);
  });
});

// --- the table behind other screens --------------------------------------------

test('the insurance offer waits while another screen covers the table', async ({ page }) => {
  await page.clock.install();
  await openTable(page);
  await page.evaluate(
    stack => {
      window.__cjStack = stack;
    },
    [card(10), card(A), card(8), card(9)],
  );
  await tapTile(page, 0);
  await expect(playButton(page, 'pass')).toBeVisible();
  await openStats(page);
  // Longer than the offer lasts with the table showing.
  await page.clock.fastForward(10000);
  await closeStats(page);
  await expect(playButton(page, 'pass')).toBeVisible();
});

test('Customize changes the bets offered as soon as the table is back', async ({ page }) => {
  await openTable(page);
  await overlayButton(page, 'Customize').click();
  const betting = page.locator('[data-screen="game.betting"]');
  await betting.getByRole('combobox', { name: 'Chip Value', exact: true }).selectOption({ label: '$25' });
  await betting.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(overlay(page)).toBeVisible();
  // One chip is now $25: the lost hand costs that.
  await playRound(page, { cards: [card(10), card(10, 1), card(9), card(K)] });
  await expect(bankroll(page)).toHaveText('$975.00');
});
