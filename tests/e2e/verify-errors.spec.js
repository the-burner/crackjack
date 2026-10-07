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

/** Card ids are suit * 13 + rank; spades by default. */
const card = (rank, suit = 0) => suit * 13 + rank;
const [A, Q, K] = [1, 12, 13];

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
  'betting.chipValue': 10,
  'betting.warnOnError': false,
  'strategy.warnOnError': false,
  // A count of 10 is never reached, so the first row is always the right bet.
  'betting.ramp': {
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
 * Opens the table with the given settings and error rolls. `storage` seeds
 * other `cj.*` keys. The setup runs once per tab, so a reload keeps what the
 * app saved.
 */
async function openTable(page, { settings = {}, rolls = {}, storage = {} } = {}) {
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
      Math.random = () => {
        const stack = new Error().stack ?? '';
        if (stack.includes('dealer-errors.ts')) {
          const name = Object.keys(window.__cjRolls).find(fn => stack.includes(fn));
          return name ? window.__cjRolls[name] : 0;
        }
        return seeded();
      };
      // What the player hears: the file each sound effect would play.
      window.__cjSounds = [];
      HTMLMediaElement.prototype.play = function play() {
        window.__cjSounds.push(this.src.split('/').pop());
        return Promise.resolve();
      };
      // Result pills on the seats, with when they appeared.
      window.__cjResults = [];
      window.__cjRecordFrames = true;
      new MutationObserver(() => {
        for (const pill of document.querySelectorAll('.table__chip .table__result')) {
          if (pill.dataset.seen) continue;
          pill.dataset.seen = '1';
          window.__cjResults.push({ text: pill.textContent, t: performance.now() });
        }
      }).observe(document, { childList: true, subtree: true });
    },
    { rolls },
  );
  await page.addInitScript(
    ({ overrides, extra }) => {
      if (sessionStorage.getItem('cj-test-setup')) return;
      sessionStorage.setItem('cj-test-setup', '1');
      localStorage.clear();
      localStorage.setItem('cj.settings', JSON.stringify(overrides));
      for (const [key, value] of Object.entries(extra)) localStorage.setItem(`cj.${key}`, JSON.stringify(value));
    },
    { overrides: { ...BASE_SETTINGS, ...settings }, extra: storage },
  );
  await page.goto('/index.html');
  await stackTheShoe(page);
  await page.locator('[data-action="play"]').click();
  await expect(overlay(page)).toBeVisible();
}

/** Makes the shoe deal from `window.__cjStack` while it has cards. */
async function stackTheShoe(page) {
  await page.evaluate(async () => {
    const { Shoe } = await import('/src/game/engine/shoe.ts');
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

const overlay = page => page.locator('.bet-overlay');
const bankroll = page => page.locator('.table__bankroll');
const action = (page, name) => page.locator(`.table__actions [data-action="${name}"]`);
const foul = page => page.locator('.bet-overlay [data-action="foul"]');

/**
 * Plays one round from stacked cards. With one seat the deal is player,
 * dealer up card, player, hole card; then the player's draws, then the
 * dealer's. `tile` is which bet tile to tap (0 is the smallest).
 */
async function playRound(page, { cards, actions = ['stand'], tile = 0, insure = null }) {
  await page.evaluate(stack => {
    window.__cjStack = stack;
  }, cards);
  await page.evaluate(() => {
    window.__cjRoundStart = performance.now();
  });
  await tapTile(page, tile);
  if (insure !== null) {
    const answer = page.locator(`[data-action="${insure ? 'insure' : 'pass'}"]`);
    await expect(answer).toBeVisible();
    await answer.click();
  }
  for (const name of actions) {
    await expect(action(page, name)).toBeVisible();
    await action(page, name).click();
  }
  await expect(overlay(page)).toBeVisible();
}

async function tapTile(page, index) {
  const grid = page.locator('.bet-overlay__grid');
  const box = await grid.boundingBox();
  await grid.click({ position: { x: 25 + (index * box.width) / 6, y: 25 } });
  await expect(overlay(page)).toBeHidden();
}

/** Frames drawn since the round began. */
const roundFrames = page => page.evaluate(() => window.__cjFrames.filter(frame => frame.t >= window.__cjRoundStart));

/** The most cards the dealer held this round. */
async function dealerCards(page) {
  const frames = await roundFrames(page);
  return frames.reduce((most, frame) => (frame.dealer.cards.length > most.length ? frame.dealer.cards : most), []);
}

/** Result pills shown this round. */
const roundResults = page =>
  page.evaluate(() => window.__cjResults.filter(r => r.t >= window.__cjRoundStart).map(r => r.text));

/** Sounds played since `from` (an index into the sound log). */
const soundsSince = (page, from) => page.evaluate(start => window.__cjSounds.slice(start), from);
const soundCount = page => page.evaluate(() => window.__cjSounds.length);

async function callFoul(page) {
  await expect(foul(page)).toBeVisible();
  await foul(page).click();
}

async function openStats(page) {
  await page.locator('.table__bar [data-action="stats"]').click();
  await expect(page.locator('.stats-table')).toBeVisible();
}

const stat = (page, label) =>
  page
    .locator('.stats-table tr:not(.stats-table__head)')
    .filter({ has: page.locator('th', { hasText: new RegExp(`^${label}$`) }) })
    .locator('td');

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
    const revealed = frames.find(frame => frame.dealer.faceUp[1] === true);
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
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });

  test('Foul on a busted good hand refunds the bet when the dealer was level', async ({ page }) => {
    await openTable(page, { settings });
    // Player 20 on three cards against the dealer's 20.
    await playRound(page, { cards: [card(5), card(10), card(6), card(K), card(9)], actions: ['hit'] });
    expect(await roundResults(page)).toEqual(['Bust']);
    await callFoul(page);
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('Foul on a busted good hand refunds nothing when the dealer was ahead', async ({ page }) => {
    // Without a peek on a ten the dealer can hold an unseen blackjack.
    await openTable(page, { settings: { ...settings, 'rules.dealerPeeksTen': false } });
    await playRound(page, { cards: [card(5), card(10), card(6), card(A), card(9)], actions: ['hit'] });
    expect(await roundResults(page)).toEqual(['Bust']);
    await expect(bankroll(page)).toHaveText('$990.00');
    await callFoul(page);
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$990.00');
  });

  test('a three-card 19 is never called a bust', async ({ page }) => {
    await openTable(page, { settings });
    await playRound(page, { cards: [card(5), card(10), card(6), card(7), card(8)], actions: ['hit', 'stand'] });
    expect(await roundResults(page)).not.toContain('Bust');
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });

  test('a doubled 20 can be called a bust', async ({ page }) => {
    await openTable(page, { settings });
    // 5 and 6 doubled, catching a 9 for 20, against the dealer's 17.
    await playRound(page, { cards: [card(5), card(10), card(6), card(7), card(9)], actions: ['double'] });
    expect(await roundResults(page)).toEqual(['Bust']);
    await expect(bankroll(page)).toHaveText('$980.00');
  });

  test('a doubled 20 can be called a bust when the table lets doubled hands draw on', async ({ page }) => {
    await openTable(page, { settings: { ...settings, 'rules.hitAfterDouble': true } });
    // 4 and 3 doubled to 12, then a hit to 20.
    await playRound(page, {
      cards: [card(4), card(10), card(3), card(7), card(5), card(8)],
      actions: ['double', 'hit'],
    });
    expect(await roundResults(page)).toEqual(['Bust']);
    await expect(bankroll(page)).toHaveText('$980.00');
  });

  test('a doubled 21 is never called a bust', async ({ page }) => {
    await openTable(page, { settings: { ...settings, 'rules.hitAfterDouble': true } });
    // 4 and 3 doubled to 11, then a hit to 21.
    await playRound(page, {
      cards: [card(4), card(10), card(3), card(7), card(4, 1), card(10, 1)],
      actions: ['double', 'hit'],
    });
    expect(await roundResults(page)).not.toContain('Bust');
    await expect(bankroll(page)).toHaveText('$1,020.00');
  });
});

// --- 2. Stood on 16 ----------------------------------------------------------

test.describe('stood on 16', () => {
  const settings = { 'dealerErrors.standOn16': true };
  // The player stands on 10 and 2.
  const player12 = (up, hole) => [card(10), up, card(2), hole];

  test('the dealer stops on a four-card hard 16 when the player has less than 17, and Foul catches it', async ({
    page,
  }) => {
    await openTable(page, { settings });
    // Dealer 2, 3, 4, 7 = hard 16; a 5 would follow if it drew.
    await playRound(page, { cards: [...player12(card(2), card(3)), card(4), card(7), card(5)] });
    expect(await dealerCards(page)).toEqual([card(2), card(3), card(4), card(7)]);
    expect(await roundResults(page)).toEqual(['Lose']);
    await callFoul(page);
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
  });

  test('the dealer stops on a four-card soft 16', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 2, A, 2, A = soft 16.
    await playRound(page, { cards: [...player12(card(2), card(A)), card(2, 1), card(A, 1), card(5)] });
    expect(await dealerCards(page)).toEqual([card(2), card(A), card(2, 1), card(A, 1)]);
    await callFoul(page);
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
  });

  test('the dealer never stands on a two-card 10-6', async ({ page }) => {
    await openTable(page, { settings });
    await playRound(page, { cards: [...player12(card(10, 1), card(6)), card(5)] });
    expect(await dealerCards(page)).toEqual([card(10, 1), card(6), card(5)]);
    await callFoul(page);
    await expect(page.locator('.toast--error')).toHaveText('No dealer errors');
  });

  test('the dealer never stands on a three-card 16', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 2, 4, 10 = 16 on three cards, then a 5.
    await playRound(page, { cards: [...player12(card(2, 1), card(4)), card(10, 1), card(5)] });
    expect(await dealerCards(page)).toEqual([card(2, 1), card(4), card(10, 1), card(5)]);
  });

  test('the dealer never stands on 16 when the player has 17 or more', async ({ page }) => {
    await openTable(page, { settings });
    // Player 10 and 7; dealer 2, 3, 4, 7 = 16, then a 5.
    await playRound(page, { cards: [card(10), card(2), card(7), card(3), card(4), card(7, 1), card(5)] });
    expect(await dealerCards(page)).toEqual([card(2), card(3), card(4), card(7, 1), card(5)]);
  });
});

// --- 3. Should have busted ---------------------------------------------------

test.describe('should have busted', () => {
  const settings = { 'dealerErrors.shouldHaveBusted': true };
  // The player stands on 20.
  const player20 = (up, hole) => [card(10), up, card(K), hole];

  test('a four-card 22 is claimed as 21, and Foul refunds the win', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 6, 6, 2, 8 = 22.
    await playRound(page, { cards: [...player20(card(6), card(6, 1)), card(2), card(8)] });
    expect(await dealerCards(page)).toHaveLength(4);
    expect(await roundResults(page)).toEqual(['Lose']);
    await expect(bankroll(page)).toHaveText('$990.00');
    await callFoul(page);
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });

  test('a three-card 22 is never claimed as 21', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 6, 6, 10 = 22.
    await playRound(page, { cards: [...player20(card(6), card(6, 1)), card(Q)] });
    expect(await roundResults(page)).toEqual(['Win']);
    await expect(bankroll(page)).toHaveText('$1,010.00');
  });

  test('a five-card 23 is claimed as 21', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 2, 3, 4, 5, 9 = 23.
    await playRound(page, { cards: [...player20(card(2), card(3)), card(4), card(5), card(9)] });
    expect(await dealerCards(page)).toHaveLength(5);
    expect(await roundResults(page)).toEqual(['Lose']);
    await expect(bankroll(page)).toHaveText('$990.00');
  });

  test('a four-card 23 is never claimed as 21', async ({ page }) => {
    await openTable(page, { settings });
    // Dealer 6, 6, 2, 9 = 23.
    await playRound(page, { cards: [...player20(card(6), card(6, 1)), card(2), card(9)] });
    expect(await roundResults(page)).toEqual(['Win']);
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
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,015.00');
  });

  test('a winning side bet is not part of the shortfall', async ({ page }) => {
    // Royal Match pays 3:1 on a suited first two cards.
    await openTable(page, { settings: { ...settings, 'bonuses.game': 15 } });
    await page.locator('.bet-overlay [data-action="side-bet"]').click();
    await page.locator('[data-chips="1"]').click();
    await expect(overlay(page)).toBeVisible();
    await playRound(page, { cards: natural, actions: [] });
    // $980 after the bets. Paid in full: $25 for the natural and $40 for the side bet,
    // $1,045. At even money the dealer keeps only the $5 premium.
    await expect(bankroll(page)).toHaveText('$1,040.00');
    await callFoul(page);
    await expect(bankroll(page)).toHaveText('$1,045.00');
  });

  test('a missed blackjack mispay with a winning side bet reports only the premium', async ({ page }) => {
    await openTable(page, { settings: { ...settings, 'bonuses.game': 15 } });
    await page.locator('.bet-overlay [data-action="side-bet"]').click();
    await page.locator('[data-chips="1"]').click();
    await expect(overlay(page)).toBeVisible();
    await playRound(page, { cards: natural, actions: [] });
    await page.evaluate(
      stack => {
        window.__cjStack = stack;
      },
      [card(10, 1), card(7, 1), card(9, 1), card(K, 1)],
    );
    await tapTile(page, 0);
    await expect(page.locator('.toast--error')).toHaveText('You missed a dealer error, BJ Mispaid, costing $5');
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
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('insurance is paid in full on a hand that pushed the blackjack', async ({ page }) => {
    await openTable(page, { settings });
    // The player's own blackjack pushes the dealer's.
    await playRound(page, { cards: [card(A, 1), card(A), card(K, 1), card(K)], actions: [], insure: true });
    await expect(bankroll(page)).toHaveText('$1,010.00');
    await callFoul(page);
    await expect(page.locator('.toast--error')).toHaveText('No dealer errors');
  });

  test('insurance is paid in full when blackjacks pay even money', async ({ page }) => {
    await openTable(page, { settings: { ...settings, 'rules.blackjackPayout': '1:1' } });
    await playRound(page, { cards: [card(10), card(A), card(8), card(K)], actions: [], insure: true });
    await expect(bankroll(page)).toHaveText('$1,000.00');
    await callFoul(page);
    await expect(page.locator('.toast--error')).toHaveText('No dealer errors');
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
    await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
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
    await expect(page.locator('.toast--error')).toHaveText('No dealer errors');
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
    await expect(page.locator('.toast--error')).toHaveText(
      'You missed a dealer error, Busted a good hand, costing $20',
    );
    // Nothing is refunded: the $10 bet is out on the new round.
    await expect(bankroll(page)).toHaveText('$980.00');
  });
});

// --- 7. Stats: dealer errors -------------------------------------------------

test('the Stats screen counts correct calls, false calls and missed errors', async ({ page }) => {
  await openTable(page, { settings: { 'dealerErrors.bustOn21OrLess': true } });
  const busted20 = [card(5), card(10), card(6), card(7), card(9)];
  // Caught.
  await playRound(page, { cards: busted20, actions: ['hit'] });
  await callFoul(page);
  await expect(page.locator('.toast--good')).toBeVisible();
  // A false call straight after.
  await foul(page).click();
  await expect(page.locator('.toast--error')).toHaveText('No dealer errors');
  // Missed: the next round starts without a call.
  await playRound(page, { cards: [card(5, 1), card(10, 1), card(6, 1), card(7, 1), card(9, 1)], actions: ['hit'] });
  await playRound(page, { cards: [card(10, 2), card(7, 2), card(9, 2), card(K, 2)] });
  await openStats(page);
  // Three decisions, two of them wrong.
  await expect(stat(page, 'Dealer Error Correct')).toHaveText('33%');
  await expect(stat(page, 'Dealer Errors Missed')).toHaveText('2');
});

// --- 8. Stats: bets ----------------------------------------------------------

test('Top Bet and Low Bet are per round, so Average Bet never exceeds Top Bet', async ({ page }) => {
  await openTable(page, {
    settings: {
      'table.seatCount': 2,
      'betting.ramp': {
        minCount: 10,
        rows: [
          { chips: 1, hands: 1 },
          { chips: 1, hands: 2 },
        ],
      },
    },
  });
  // Two hands of $10: seat 1, seat 2, dealer, seat 1, seat 2, hole card.
  await playRound(page, {
    cards: [card(10), card(9), card(7), card(10, 1), card(9, 1), card(8)],
    tile: 1,
    actions: ['stand', 'stand'],
  });
  // One hand of $10.
  await playRound(page, { cards: [card(10, 2), card(9, 2), card(8, 1), card(10, 3)] });
  await openStats(page);
  await expect(stat(page, 'Rounds Played')).toHaveText('2');
  await expect(stat(page, 'Total Initial Bets')).toHaveText('$30');
  await expect(stat(page, 'Top Bet')).toHaveText('$20');
  await expect(stat(page, 'Low Bet')).toHaveText('$10');
  await expect(stat(page, 'Average Bet')).toHaveText('$15');
});

// --- 9. Stats: accuracy ------------------------------------------------------

test('bet accuracy is floored and play accuracy rounded, on the Stats screen and the table', async ({ page }) => {
  await openTable(page, {
    settings: {
      'betting.warnOnError': true,
      'strategy.warnOnError': true,
      'display.showBetAccuracy': true,
      'display.showPlayAccuracy': true,
    },
  });
  // Neutral cards only. Player 9, 8 against the dealer's 9, 8.
  const round = suit => [card(9, suit), card(9, (suit + 1) % 4), card(8, suit), card(8, (suit + 1) % 4)];
  await playRound(page, { cards: round(0) });
  await playRound(page, { cards: round(1) });
  // The wrong bet ($20) and the wrong play (hitting 17).
  await playRound(page, { cards: [...round(2), card(9, 3)], tile: 1, actions: ['hit'] });
  await expect(page.locator('.table__counts')).toHaveText('Bets: 66%, Plays: 67%');
  await openStats(page);
  await expect(stat(page, 'Bet Correct')).toHaveText('66%');
  await expect(stat(page, 'Play Correct')).toHaveText('67%');
});

// --- 10. Stats survive a reload ----------------------------------------------

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

    await page.reload();
    await stackTheShoe(page);
    await page.locator('[data-action="play"]').click();
    await expect(overlay(page)).toBeVisible();
    await openStats(page);
    const after = await Promise.all(labels.map(label => stat(page, label).textContent()));
    expect(after).toEqual(before);
  });

  test('from before the dealer-error counters show no NaN', async ({ page }) => {
    const old = {
      rounds: 3,
      totalBet: 30,
      highBet: 10,
      lowBet: 10,
      highBankroll: 1010,
      lowBankroll: 990,
      bankrollSum: 3000,
      playDecisions: 3,
      playErrors: 1,
      betDecisions: 3,
      betErrors: 0,
    };
    await openTable(page, { settings: { 'dealerErrors.bustOn21OrLess': true }, storage: { gameStats: old } });
    await openStats(page);
    await expect(page.locator('.stats-table')).not.toContainText('NaN');
    await expect(stat(page, 'Rounds Played')).toHaveText('3');
    await expect(stat(page, 'Dealer Error Correct')).toHaveText('100%');
    await expect(stat(page, 'Dealer Errors Missed')).toHaveText('0');

    // A false call on top of the old session counts normally.
    await page.locator('.game-stats [data-action="back"]').click();
    await expect(overlay(page)).toBeVisible();
    await foul(page).click();
    await openStats(page);
    await expect(page.locator('.stats-table')).not.toContainText('NaN');
    await expect(stat(page, 'Dealer Error Correct')).toHaveText('0%');
    await expect(stat(page, 'Dealer Errors Missed')).toHaveText('1');
  });
});

// --- extra findings ------------------------------------------------------------

test('a dealer that stood on 16 by mistake always counts as an error', async ({ page }) => {
  // The stand happens; the separate roll that records it as an error does not come up.
  await openTable(page, { settings: { 'dealerErrors.standOn16': true }, rolls: { pickDealerError: 0.5 } });
  await playRound(page, { cards: [card(10), card(2), card(2, 1), card(3), card(4), card(7), card(5)] });
  expect(await dealerCards(page)).toEqual([card(2), card(3), card(4), card(7)]);
  await callFoul(page);
  await expect(page.locator('.toast--good')).toHaveText('You caught a dealer error');
});

test('a hand that lost to a dealer standing on 16 costs only its bet', async ({ page }) => {
  await openTable(page, { settings: { 'dealerErrors.standOn16': true } });
  // Player 12 stands; dealer 2, 3, 4, 7 stops on 16 and the $10 hand loses.
  await playRound(page, { cards: [card(10), card(2), card(2, 1), card(3), card(4), card(7), card(5)] });
  expect(await roundResults(page)).toEqual(['Lose']);
  await expect(bankroll(page)).toHaveText('$990.00');
});

// --- the table behind other screens --------------------------------------------

test('the bankroll figures count a payoff mistake and its Foul refund', async ({ page }) => {
  await openTable(page, { settings: { 'dealerErrors.blackjackPayoff': true } });
  // A natural paid even money: $1,010 instead of $1,015.
  await playRound(page, { cards: [card(A), card(9), card(K), card(8)], actions: [] });
  await openStats(page);
  await expect(stat(page, 'Bankroll High')).toHaveText('$1,010');
  await page.locator('.game-stats [data-action="back"]').click();
  await callFoul(page);
  await openStats(page);
  await expect(stat(page, 'Bankroll High')).toHaveText('$1,015');
  await expect(stat(page, 'Bankroll Low')).toHaveText('$1,015');
});

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
  await expect(page.locator('[data-action="pass"]')).toBeVisible();
  await openStats(page);
  // Longer than the offer lasts with the table showing.
  await page.clock.fastForward(10000);
  await page.locator('.game-stats [data-action="back"]').click();
  await expect(page.locator('[data-action="pass"]')).toBeVisible();
});

test('Customize changes the bets offered as soon as the table is back', async ({ page }) => {
  await openTable(page);
  await page.locator('.bet-overlay [data-action="customize"]').click();
  await page
    .locator('[data-screen="settings.betting"] .tc-row', { hasText: 'Chip Value' })
    .locator('select')
    .selectOption({ label: '$25' });
  await page.locator('[data-screen="settings.betting"] [data-action="back"]').click();
  await expect(overlay(page)).toBeVisible();
  // One chip is now $25: the lost hand costs that.
  await playRound(page, { cards: [card(10), card(10, 1), card(9), card(K)] });
  await expect(bankroll(page)).toHaveText('$975.00');
});
