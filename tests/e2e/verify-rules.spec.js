// Rule behaviours checked through the table, as a player meets them: the
// buttons offered, what tapping them does, and what the table shows.
//
// Each test stacks the shoe: `Math.random` is replaced by one that knows how
// many of each card the shoe holds, and returns the value that makes the
// shoe's draw (shoe.js: floor(random * remaining) over card ids 1..52) produce
// the next card on the list. Once the list runs out it falls back to a seeded
// generator (seed 7), still tracking the shoe. Nothing else at the table draws
// on Math.random with dealer errors, peeking and "players come and go" off.
// With one human seat the deal order is: player, dealer up, player, hole card.

import { test, expect } from '@playwright/test';

const RANKS = 'A23456789TJQK';
const SUITS = 'schd';
/** 'Ts' -> card id (suit * 13 + rank; spades, clubs, hearts, diamonds). */
const card = name => SUITS.indexOf(name[1]) * 13 + RANKS.indexOf(name[0]) + 1;
const cards = names => names.map(card);

const BASE = {
  'mechanics.dealerSpeed': 99,
  'mechanics.otherPlayerSpeed': 99,
  'mechanics.payoffSpeed': 99,
  'mechanics.dealerPointsOutStupidPlays': false,
  'mechanics.dealerMakesObviousPlays': false,
  'table.startingBankroll': 1000,
  'table.seatCount': 1,
  'table.computerSeats': [false, false, false, false, false, false],
  'table.burnCards': 0,
  'table.decks': 6,
  'betting.chipValue': 5,
  'betting.warnOnError': false,
  // The first tile is five chips: $25.
  'betting.ramp': { minCount: 0, rows: [{ chips: 5, hands: 1 }] },
  'strategy.warnOnError': false,
  'rules.surrender': 'none',
  'display.hideActionButtons': false,
};

/** Opens the table with these settings and this stacked shoe, at the betting overlay. */
async function openTable(page, { settings = {}, stack = [] } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  const decks = settings['table.decks'] ?? BASE['table.decks'];
  await page.addInitScript(({ stack, decks }) => {
    const remaining = new Array(53).fill(decks);
    remaining[0] = 0;
    let total = decks * 52;
    const queue = [...stack];
    let a = 7;
    const seeded = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    Math.random = () => {
      if (queue.length) {
        const want = queue.shift();
        let before = 0;
        for (let c = 1; c < want; c++) before += remaining[c];
        const r = (before + 0.5) / total;
        remaining[want] -= 1;
        total -= 1;
        return r;
      }
      const r = seeded();
      let pick = Math.floor(r * total);
      for (let c = 1; c <= 52; c++) {
        pick -= remaining[c];
        if (pick < 0) {
          remaining[c] -= 1;
          break;
        }
      }
      total -= 1;
      return r;
    };
  }, { stack: cards(stack), decks });
  await page.addInitScript(overrides => {
    window.__cjRecordFrames = true;
    // Every action button shown, and every pop-up, however briefly.
    window.__cjOffered = [];
    window.__cjToasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(records => {
        for (const r of records) {
          if (r.type === 'attributes' && r.target.matches?.('.table__actions [data-action]') && !r.target.hidden) {
            window.__cjOffered.push(r.target.dataset.action);
          }
          for (const node of r.addedNodes ?? []) {
            if (node.classList?.contains('toast')) window.__cjToasts.push({ text: node.textContent, className: node.className });
          }
        }
      }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    });
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(overrides));
  }, { ...BASE, ...settings });
  await page.goto('/index.html');
  // Records the sounds the table asks for.
  await page.evaluate(() => {
    window.__cjSounds = [];
    const play = window.app.sound.play.bind(window.app.sound);
    window.app.sound.play = name => { window.__cjSounds.push(name); return play(name); };
  });
  await page.locator('[data-action="play"]').click();
  await expect(overlay(page)).toBeVisible({ timeout: 10000 });
}

const overlay = page => page.locator('.bet-overlay');
const overlayTitle = page => page.locator('.bet-overlay__title');
const bankroll = page => page.locator('.table__bankroll');
const action = (page, name) => page.locator(`.table__actions [data-action="${name}"]`);
const insure = page => page.locator('[data-action="insure"]');
const pass = page => page.locator('[data-action="pass"]');
const ACTIONS = ['hit', 'stand', 'double', 'split', 'surrender'];

/** Taps the first bet tile and waits for the deal to start. */
async function bet(page) {
  await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
  await expect(overlay(page)).toBeHidden();
}

/** Waits until the table wants something: an action, the insurance answer, or the next bet. */
async function settle(page) {
  await expect.poll(async () => {
    if (await overlay(page).isVisible()) return 'bet';
    if (await pass(page).isVisible()) return 'insurance';
    for (const name of ACTIONS) if (await action(page, name).isVisible()) return 'act';
    return 'busy';
  }, { timeout: 20000 }).not.toBe('busy');
  if (await overlay(page).isVisible()) return 'bet';
  return (await pass(page).isVisible()) ? 'insurance' : 'act';
}

/** The action buttons showing now. */
async function offered(page) {
  const shown = [];
  for (const name of ACTIONS) if (await action(page, name).isVisible()) shown.push(name);
  return shown;
}

/** Taps an action and waits for the table to want something again. */
async function tap(page, name) {
  await action(page, name).click();
  return settle(page);
}

const frames = page => page.evaluate(() => window.__cjFrames);
const lastFrame = async page => (await frames(page)).at(-1);
/** The dealer's cards as last drawn before the table was cleared. */
const dealerLast = async page => (await frames(page)).findLast(f => f.dealer.cards.length > 0).dealer;
const handIn = (frame, key) => frame.hands.find(hand => hand.key === key);
/** The most cards a hand ever showed this round. */
const mostCards = async (page, key) => Math.max(0, ...(await frames(page)).map(f => handIn(f, key)?.cards.length ?? 0));
const resetOffered = page => page.evaluate(() => { window.__cjOffered = []; });
const offeredLog = page => page.evaluate(() => window.__cjOffered);
const toasts = page => page.evaluate(() => window.__cjToasts);

// A plain dealer 17 (9 up, 8 in the hole) that never peeks.
const D17 = ['9h', '8h'];
/** Interleaves the player's two cards with the dealer's, in deal order. */
const deal = ([p1, p2], [up, hole]) => [p1, up, p2, hole];

test.describe('1. many unbusted cards win', () => {
  for (const [count, key, stack] of [
    [5, 'rules.autoWinFiveCards', ['2c', '3c', '4s']],
    [6, 'rules.autoWinSixCards', ['2c', '3c', '2h', '4s']],
    [7, 'rules.autoWinSevenCards', ['2c', '3c', '2h', 'Ac', 'Ah']],
  ]) {
    test(`${count} unbusted cards stand the hand and pay it as a win`, async ({ page }) => {
      // 2+3 against a dealer 17 (T up, 7 in the hole); every hit stays low.
      await openTable(page, { settings: { [key]: true }, stack: [...deal(['2s', '3s'], ['Ts', '7s']), ...stack] });
      await bet(page);
      await expect(bankroll(page)).toHaveText('$975.00');
      expect(await settle(page)).toBe('act');
      for (let n = 3; n <= count; n++) {
        // Hit is still offered below the winning count.
        expect(await offered(page)).toContain('hit');
        const next = await tap(page, 'hit');
        if (n < count) expect(next).toBe('act');
        else expect(next).toBe('bet');
      }
      expect(await mostCards(page, '1-0')).toBe(count);
      // 14 or 16 against 17 would lose; the card count wins even money.
      await expect(bankroll(page)).toHaveText('$1,025.00');
    });
  }
});

test.describe('2. auto-stand on 21', () => {
  test('a hard 21 is stood automatically', async ({ page }) => {
    await openTable(page, { stack: [...deal(['Ts', '5s'], D17), '6s'] });
    await bet(page);
    await settle(page);
    await resetOffered(page);
    expect(await tap(page, 'hit')).toBe('bet');
    expect(await offeredLog(page)).toEqual([]);
    expect(await mostCards(page, '1-0')).toBe(3);
    await expect(bankroll(page)).toHaveText('$1,025.00');
  });

  test('a soft 21 of exactly four cards still offers Hit', async ({ page }) => {
    await openTable(page, { stack: [...deal(['As', '2s'], D17), '3s', '5s'] });
    await bet(page);
    await settle(page);
    await tap(page, 'hit');
    expect(await tap(page, 'hit')).toBe('act');
    expect((await lastFrame(page)).hands[0].cards).toEqual(cards(['As', '2s', '3s', '5s']));
    expect(await offered(page)).toEqual(expect.arrayContaining(['hit', 'stand']));
    expect(await tap(page, 'stand')).toBe('bet');
    await expect(bankroll(page)).toHaveText('$1,025.00');
  });

  test('with 22 counting as 21, a 21 is still stood automatically', async ({ page }) => {
    await openTable(page, { settings: { 'rules.player22CountsAs21': true }, stack: [...deal(['Ts', '5s'], D17), '6s'] });
    await bet(page);
    await settle(page);
    await resetOffered(page);
    expect(await tap(page, 'hit')).toBe('bet');
    expect(await offeredLog(page)).toEqual([]);
    await expect(bankroll(page)).toHaveText('$1,025.00');
  });

  test('with 22 counting as 21, a hard 22 does not bust and pushes a dealer 21', async ({ page }) => {
    // Dealer 9+7 draws a 5 to 21. As a 22 the hand would win; as a 21 it pushes.
    await openTable(page, { settings: { 'rules.player22CountsAs21': true }, stack: [...deal(['Ts', '5s'], ['9h', '7h']), '7s', '5h'] });
    await bet(page);
    await settle(page);
    await resetOffered(page);
    expect(await tap(page, 'hit')).toBe('bet');
    // Stood for the player, as a 21 would be.
    expect(await offeredLog(page)).toEqual([]);
    // Still on the table when the dealer drew to 21: not swept as a bust.
    const all = await frames(page);
    const dealerDrew = all.find(f => f.dealer.cards.length === 3);
    expect(handIn(dealerDrew, '1-0')?.cards).toEqual(cards(['Ts', '5s', '7s']));
    expect((await toasts(page)).map(t => t.text)).not.toContain('Bust');
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });
});

test.describe('3. dealer makes obvious plays', () => {
  const obvious = { 'mechanics.dealerMakesObviousPlays': true };

  test('a hard 17 is stood for the player without being offered', async ({ page }) => {
    await openTable(page, { settings: obvious, stack: deal(['Ts', '7s'], D17) });
    await bet(page);
    expect(await settle(page)).toBe('bet');
    expect(await offeredLog(page)).toEqual([]);
    // 17 against 17 pushes.
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('a soft 20 is left alone, and a hard 20 holding an ace is then stood', async ({ page }) => {
    await openTable(page, { settings: obvious, stack: [...deal(['As', '9s'], D17), 'Ts'] });
    await bet(page);
    expect(await settle(page)).toBe('act');
    expect(await offered(page)).toEqual(expect.arrayContaining(['hit', 'stand']));
    await resetOffered(page);
    expect(await tap(page, 'hit')).toBe('bet');
    expect(await offeredLog(page)).toEqual([]);
    expect(await mostCards(page, '1-0')).toBe(3);
  });

  test('a pair of nines is left alone', async ({ page }) => {
    await openTable(page, { settings: obvious, stack: deal(['9s', '9c'], D17) });
    await bet(page);
    expect(await settle(page)).toBe('act');
    expect(await offered(page)).toEqual(expect.arrayContaining(['stand', 'split']));
  });

  test('a hard 16 is left alone', async ({ page }) => {
    await openTable(page, { settings: obvious, stack: deal(['Ts', '6s'], D17) });
    await bet(page);
    expect(await settle(page)).toBe('act');
    expect(await offered(page)).toEqual(expect.arrayContaining(['hit', 'stand']));
  });
});

test.describe('4. split aces', () => {
  test('with resplitting but no hitting, a split pair of aces offers Split but not Hit', async ({ page }) => {
    await openTable(page, {
      settings: { 'rules.hitSplitAces': false, 'rules.resplitAces': true, 'rules.maxSplitHands': 4 },
      stack: [...deal(['As', 'Ac'], D17), 'Ah', '5s', '6s', '7s'],
    });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'split')).toBe('act');
    expect(handIn(await lastFrame(page), '1-0').cards).toEqual(cards(['As', 'Ah']));
    const shown = await offered(page);
    expect(shown).toContain('split');
    expect(shown).not.toContain('hit');
  });

  test('with doubling after split aces, a split ace may be doubled but not hit', async ({ page }) => {
    await openTable(page, {
      // The settings screen turns Double After Split on with it.
      settings: { 'rules.hitSplitAces': false, 'rules.resplitAces': false, 'rules.doubleAfterSplitAces': true, 'rules.doubleAfterSplit': true },
      stack: [...deal(['As', 'Ac'], D17), '5s', '2s', '6s'],
    });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'split')).toBe('act');
    const shown = await offered(page);
    expect(shown).toContain('double');
    expect(shown).not.toContain('hit');
    await expect(bankroll(page)).toHaveText('$950.00');
    await tap(page, 'double');
    await expect(bankroll(page)).toHaveText('$925.00');
    expect(handIn(await lastFrame(page), '1-0').cards).toEqual(cards(['As', '5s', '2s']));
  });

  test('with none of the split-ace rules, split aces stand at once', async ({ page }) => {
    await openTable(page, {
      settings: { 'rules.hitSplitAces': false, 'rules.resplitAces': false, 'rules.doubleAfterSplitAces': false },
      stack: [...deal(['As', 'Ac'], D17), '5s', '6s'],
    });
    await bet(page);
    await settle(page);
    await resetOffered(page);
    expect(await tap(page, 'split')).toBe('bet');
    expect(await offeredLog(page)).toEqual([]);
    expect(await mostCards(page, '1-0')).toBe(2);
    expect(await mostCards(page, '1-1')).toBe(2);
  });
});

test.describe('5. Macao surrender', () => {
  test('is offered on an unbusted five-card hand only', async ({ page }) => {
    await openTable(page, { settings: { 'rules.surrender': 'macao' }, stack: [...deal(['2s', '3s'], ['Th', '7h']), '2c', '3c', '4s'] });
    await bet(page);
    await settle(page);
    for (let n = 2; n < 5; n++) {
      expect(await offered(page)).not.toContain('surrender');
      await tap(page, 'hit');
    }
    expect(await mostCards(page, '1-0')).toBe(5);
    expect(await offered(page)).toContain('surrender');
    expect(await tap(page, 'surrender')).toBe('bet');
    await expect(bankroll(page)).toHaveText('$987.50');
  });

  test('is not offered on a two-card hand, even under an ace', async ({ page }) => {
    await openTable(page, { settings: { 'rules.surrender': 'macao' }, stack: deal(['Ts', '6s'], ['Ah', '7h']) });
    await bet(page);
    expect(await settle(page)).toBe('insurance');
    await expect(action(page, 'surrender')).toBeHidden();
    await pass(page).click();
    expect(await settle(page)).toBe('act');
    expect(await offered(page)).not.toContain('surrender');
  });
});

test.describe('6. double-down rescue', () => {
  test('offers Surrender on the doubled hand and returns half of everything wagered', async ({ page }) => {
    await openTable(page, { settings: { 'rules.doubleDownRescue': true }, stack: [...deal(['6s', '5s'], ['Th', '7h']), '2s'] });
    await bet(page);
    await settle(page);
    expect(await offered(page)).not.toContain('surrender');
    expect(await tap(page, 'double')).toBe('act');
    await expect(bankroll(page)).toHaveText('$950.00');
    expect(await offered(page)).toContain('surrender');
    expect(await tap(page, 'surrender')).toBe('bet');
    // Half of $50.
    await expect(bankroll(page)).toHaveText('$975.00');
  });
});

test.describe('7. early surrender', () => {
  test('is offered during the insurance offer and keeps half against a dealer blackjack', async ({ page }) => {
    await openTable(page, { settings: { 'rules.surrender': 'early' }, stack: deal(['Ts', '6s'], ['Ah', 'Kh']) });
    await bet(page);
    expect(await settle(page)).toBe('insurance');
    await expect(action(page, 'surrender')).toBeVisible();
    // The dealer has not looked yet.
    expect((await lastFrame(page)).dealer.faceUp).toEqual([true, false]);
    await action(page, 'surrender').click();
    expect(await settle(page)).not.toBe('act');
    if (await pass(page).isVisible()) await pass(page).click();
    await expect(overlay(page)).toBeVisible({ timeout: 10000 });
    expect((await dealerLast(page)).cards).toEqual(cards(['Ah', 'Kh']));
    await expect(bankroll(page)).toHaveText('$987.50');
  });

  test('early surrender against a ten is offered before the hole card is known', async ({ page }) => {
    await openTable(page, {
      // The settings screen turns the ten peek off with it.
      settings: { 'rules.surrender': 'earlyVsTen', 'rules.dealerPeeksTen': false },
      stack: deal(['Ts', '6s'], ['Kh', 'Ah']),
    });
    await bet(page);
    expect(await settle(page)).toBe('act');
    expect(await offered(page)).toContain('surrender');
    expect((await lastFrame(page)).dealer.faceUp).toEqual([true, false]);
    expect(await tap(page, 'surrender')).toBe('bet');
    await expect(bankroll(page)).toHaveText('$987.50');
  });
});

test.describe('8. redouble and hit after double', () => {
  const tenDollars = { 'betting.chipValue': 10, 'betting.ramp': { minCount: 0, rows: [{ chips: 1, hands: 1 }] } };

  test('a redouble stakes the bet plus the doubles already made', async ({ page }) => {
    await openTable(page, {
      settings: { ...tenDollars, 'rules.redouble': true, 'rules.doubleOnThreeCards': true, 'rules.doubleAnyNumberOfCards': true },
      stack: [...deal(['2s', '3s'], ['Th', '7h']), '2c', '3c'],
    });
    await bet(page);
    await expect(bankroll(page)).toHaveText('$990.00');
    await settle(page);
    expect(await tap(page, 'double')).toBe('act');
    await expect(bankroll(page)).toHaveText('$980.00');
    expect(await offered(page)).toContain('double');
    expect(await offered(page)).not.toContain('hit');
    await tap(page, 'double');
    await expect(bankroll(page)).toHaveText('$960.00');
  });

  test('with only Redouble on, Hit is not offered after a double', async ({ page }) => {
    await openTable(page, {
      settings: { ...tenDollars, 'rules.redouble': true, 'rules.doubleOnThreeCards': true },
      stack: [...deal(['2s', '3s'], ['Th', '7h']), '2c'],
    });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'double')).toBe('act');
    const shown = await offered(page);
    expect(shown).not.toContain('hit');
    expect(shown).toContain('double');
  });

  test('with Hit After Double on, Hit is offered after a double', async ({ page }) => {
    await openTable(page, {
      settings: { ...tenDollars, 'rules.hitAfterDouble': true },
      stack: [...deal(['2s', '3s'], ['Th', '7h']), '2c'],
    });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'double')).toBe('act');
    expect(await offered(page)).toContain('hit');
  });
});

test.describe('9. player blackjack always wins', () => {
  test('a natural against a dealer natural is paid 3:2', async ({ page }) => {
    await openTable(page, {
      settings: { 'rules.playerBlackjackAlwaysWins': true, 'betting.chipValue': 10, 'betting.ramp': { minCount: 0, rows: [{ chips: 1, hands: 1 }] } },
      stack: deal(['As', 'Ks'], ['Kh', 'Ah']),
    });
    await bet(page);
    expect(await settle(page)).toBe('bet');
    expect((await dealerLast(page)).cards).toEqual(cards(['Kh', 'Ah']));
    await expect(bankroll(page)).toHaveText('$1,015.00');
  });
});

test.describe('10. suited 6-7-8 pays 2:1 if it wins', () => {
  const settings = { 'bonuses.suited678IfWins': true, 'betting.chipValue': 10, 'betting.ramp': { minCount: 0, rows: [{ chips: 1, hands: 1 }] } };

  test('pays nothing extra against a dealer 21', async ({ page }) => {
    // Dealer 9+7 draws a 5 to 21: the suited 21 pushes.
    await openTable(page, { settings, stack: [...deal(['6s', '7s'], ['9h', '7h']), '8s', '5h'] });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'hit')).toBe('bet');
    expect((await dealerLast(page)).cards).toEqual(cards(['9h', '7h', '5h']));
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('pays 2:1 when it beats the dealer', async ({ page }) => {
    await openTable(page, { settings, stack: [...deal(['6s', '7s'], D17), '8s'] });
    await bet(page);
    await settle(page);
    expect(await tap(page, 'hit')).toBe('bet');
    await expect(bankroll(page)).toHaveText('$1,020.00');
  });
});

test.describe('11. side bets', () => {
  /** Picks a side bet of `chips` chips for each spot the game asks about. */
  async function sideBets(page, chips, titles = []) {
    await overlay(page).locator('[data-action="side-bet"]').click();
    for (const [index, amount] of chips.entries()) {
      await expect(page.locator('.bet-select')).toBeVisible();
      if (titles[index]) await expect(page.locator('.bet-select .topbar__title')).toHaveText(titles[index]);
      await page.locator(`.bet-select__chips [data-chips="${amount}"]`).click();
    }
    await expect(overlay(page)).toBeVisible();
  }

  test('a game with two spots asks for each in turn and records both', async ({ page }) => {
    await openTable(page, { settings: { 'bonuses.game': 11 }, stack: deal(['Ts', '7s'], D17) });
    await sideBets(page, [1, 1], ['U side bet', 'O side bet']);
    await expect(overlayTitle(page)).toContainText('U side bet $5');
    await expect(overlayTitle(page)).toContainText('O side bet $5');
    await bet(page);
    await expect(page.locator('.table__chip[data-seat="1"]')).toHaveText('$25, SB:$10');
    await expect(bankroll(page)).toHaveText('$965.00');
  });

  test('a side bet above its multiple of the main bet is refused with a message', async ({ page }) => {
    // Lucky Ladies allows 1x: $50 on a $25 bet.
    await openTable(page, { settings: { 'bonuses.game': 8 } });
    await sideBets(page, [10]);
    await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
    await expect(overlay(page)).toBeVisible();
    await expect(overlayTitle(page)).toHaveText('Side bet cannot be greater than 1 times the main bet.');
    await expect(bankroll(page)).toHaveText('$1,000.00');
  });

  test('a side bet that makes the round unaffordable is refused', async ({ page }) => {
    // $75 main plus $50 side on a $100 bankroll.
    await openTable(page, { settings: { 'bonuses.game': 8, 'table.startingBankroll': 100, 'betting.ramp': { minCount: 0, rows: [{ chips: 15, hands: 1 }] } } });
    await sideBets(page, [10]);
    await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
    await expect(overlay(page)).toBeVisible();
    await expect(overlayTitle(page)).toHaveText('Not enough in the bankroll for that bet.');
    await expect(bankroll(page)).toHaveText('$100.00');
  });

  test('the seat label shows the side bet and the bankroll drops by both bets', async ({ page }) => {
    await openTable(page, { settings: { 'bonuses.game': 8 }, stack: deal(['Ts', '7s'], D17) });
    await sideBets(page, [1]);
    await bet(page);
    await expect(page.locator('.table__chip[data-seat="1"]')).toHaveText('$25, SB:$5');
    await expect(bankroll(page)).toHaveText('$970.00');
  });
});

test.describe('12. bankroll limits', () => {
  const ramp = chips => ({ minCount: 0, rows: [{ chips, hands: 1 }] });

  for (const [bank, enabled] of [[100, false], [150, true]]) {
    test(`Insure is ${enabled ? 'available' : 'unavailable'} with $${bank - 100} left after a $100 bet`, async ({ page }) => {
      await openTable(page, { settings: { 'table.startingBankroll': bank, 'betting.ramp': ramp(20) }, stack: deal(['Ts', '6s'], ['Ah', '7h']) });
      await bet(page);
      expect(await settle(page)).toBe('insurance');
      await expect(insure(page)).toBeVisible();
      if (enabled) await expect(insure(page)).toBeEnabled();
      else await expect(insure(page)).toBeDisabled();
    });
  }

  for (const [label, settings, chips, shown] of [
    ['a double', {}, 15, false],
    ['a double', {}, 10, true],
    ['a triple-down', { 'rules.tripleDown': true }, 8, false],
    ['a triple-down', { 'rules.tripleDown': true }, 6, true],
  ]) {
    test(`Double is ${shown ? '' : 'not '}offered for ${label} with $${100 - chips * 5} left after a $${chips * 5} bet`, async ({ page }) => {
      await openTable(page, { settings: { ...settings, 'table.startingBankroll': 100, 'betting.ramp': ramp(chips) }, stack: deal(['6s', '5s'], ['Th', '7h']) });
      await bet(page);
      expect(await settle(page)).toBe('act');
      if (shown) await expect(action(page, 'double')).toBeVisible();
      else await expect(action(page, 'double')).toBeHidden();
    });
  }

  for (const [chips, shown] of [[6, false], [5, true]]) {
    test(`a redouble is ${shown ? '' : 'not '}offered with $${100 - chips * 10} left after doubling a $${chips * 5} bet`, async ({ page }) => {
      await openTable(page, {
        settings: { 'rules.redouble': true, 'rules.doubleOnThreeCards': true, 'table.startingBankroll': 100, 'betting.ramp': ramp(chips) },
        stack: [...deal(['2s', '3s'], ['Th', '7h']), '2c'],
      });
      await bet(page);
      await settle(page);
      expect(await tap(page, 'double')).toBe('act');
      await expect(bankroll(page)).toHaveText(`$${100 - chips * 10}.00`);
      await expect(action(page, 'stand')).toBeVisible();
      if (shown) await expect(action(page, 'double')).toBeVisible();
      else await expect(action(page, 'double')).toBeHidden();
    });
  }
});

test.describe('13. "Are you sure?" on an obviously bad play', () => {
  const sure = { 'mechanics.dealerPointsOutStupidPlays': true };
  const sounds = page => page.evaluate(() => window.__cjSounds);
  const clearSounds = page => page.evaluate(() => { window.__cjSounds = []; });

  /** Taps an action the dealer should query: nothing is dealt, the question drops down with a click. */
  async function expectQueried(page, name, question) {
    const before = (await lastFrame(page)).hands[0].cards.length;
    const asked = (await toasts(page)).filter(t => t.text === question).length;
    await clearSounds(page);
    await action(page, name).click();
    await expect.poll(async () => (await toasts(page)).filter(t => t.text === question).length).toBe(asked + 1);
    const pop = page.locator('.toast', { hasText: question });
    await expect(pop).toBeVisible();
    await expect(pop).toHaveClass(/toast--top/);
    await expect(page.locator('.dialog-overlay')).toHaveCount(0);
    expect(await sounds(page)).toEqual(['card']);
    expect(await settle(page)).toBe('act');
    expect((await lastFrame(page)).hands[0].cards.length).toBe(before);
    await expect(action(page, name)).toBeVisible();
  }

  test('hitting a hard 17 is refused once, then goes through, and the next hit is asked afresh', async ({ page }) => {
    await openTable(page, { settings: sure, stack: [...deal(['Ts', '7s'], D17), 'As', '2s'] });
    await bet(page);
    await settle(page);
    await expectQueried(page, 'hit', 'Are you sure that you want to Hit?');
    expect(await tap(page, 'hit')).toBe('act');
    expect((await lastFrame(page)).hands[0].cards).toEqual(cards(['Ts', '7s', 'As']));
    // A hard 18 now: a new decision, so the dealer asks again.
    await expectQueried(page, 'hit', 'Are you sure that you want to Hit?');
    await tap(page, 'hit');
    expect(await mostCards(page, '1-0')).toBe(4);
  });

  test('standing under 12 is refused once, then goes through', async ({ page }) => {
    await openTable(page, { settings: sure, stack: deal(['5s', '4s'], D17) });
    await bet(page);
    await settle(page);
    await expectQueried(page, 'stand', 'Are you sure that you want to Stand?');
    expect(await tap(page, 'stand')).toBe('bet');
  });

  test('doubling a hard 12 is refused once as "Double Down", then goes through', async ({ page }) => {
    // The double draws a 9: 21 against 17 pays the doubled $50.
    await openTable(page, { settings: sure, stack: [...deal(['Ts', '2s'], D17), '9s'] });
    await bet(page);
    await settle(page);
    await expectQueried(page, 'double', 'Are you sure that you want to Double Down?');
    await expect(bankroll(page)).toHaveText('$975.00');
    expect(await tap(page, 'double')).toBe('bet');
    expect(await mostCards(page, '1-0')).toBe(3);
    await expect(bankroll(page)).toHaveText('$1,050.00');
  });
});

test.describe('14. speed mapping', () => {
  // Seat 1 human, seat 2 computer. Deal: 8s 2d 6h(up) 8c 3d Th(hole).
  // The player splits the 8s: 8+3 (doubled, draws 9), 8+2 (stands).
  // The computer's 5 against a 6 hits a T to 15 and stands; the dealer's 16 draws a 5.
  const stack = ['8s', '2d', '6h', '8c', '3d', 'Th', '3s', '9s', '2h', 'Td', '5h'];
  const FAST = 99;
  const SLOW = 40;
  const SLOW_MS = Math.round(((101 - SLOW) / 120) * 1000);

  /** Plays the round and returns the time each step took, by what it was. */
  async function measure(page, { dealer, other }) {
    await openTable(page, {
      settings: {
        'mechanics.dealerSpeed': dealer, 'mechanics.otherPlayerSpeed': other,
        'table.seatCount': 2, 'table.computerSeats': [false, true, false, false, false, false],
      },
      stack,
    });
    await page.evaluate(() => { window.__cjFrames = []; });
    await bet(page);
    expect(await settle(page)).toBe('act');
    await tap(page, 'split');
    await tap(page, 'double');
    expect(await tap(page, 'stand')).toBe('bet');

    const log = await frames(page);
    const count = (f, key) => (key === 'dealer' ? f.dealer.cards.length : handIn(f, key)?.cards.length ?? 0);
    /** The frame where a hand first shows n cards. */
    const reach = (key, n, from = 0) => log.findIndex((f, i) => i >= from && count(f, key) >= n);
    // Until the picture next changes: a stray redraw of the same picture is not a step.
    const look = f => JSON.stringify([f.dealer.cards, f.dealer.faceUp, f.hands.map(h => [h.key, h.cards, h.faceUp]), f.pointer?.hand]);
    const after = i => log[log.findIndex((f, j) => j > i && look(f) !== look(log[i]))].t - log[i].t;
    // From when the previous picture first appeared: a stray redraw of it is not a step.
    const before = i => {
      let start = i - 1;
      while (start > 0 && look(log[start - 1]) === look(log[i - 1])) start -= 1;
      return log[i].t - log[start].t;
    };

    const deal = [reach('1-0', 1), reach('2-0', 1), reach('dealer', 1), reach('1-0', 2), reach('2-0', 2), reach('dealer', 2)];
    const split = reach('1-1', 1);
    const doubled = reach('1-0', 3, split);
    const secondHand = reach('1-1', 2);
    const computerDraw = reach('2-0', 3);
    const dealerDraw = reach('dealer', 3);
    for (const i of [...deal, split, doubled, secondHand, computerDraw, dealerDraw]) expect(i).toBeGreaterThan(0);
    // Order check: the stack played out as planned.
    expect(handIn(log[doubled], '1-0').cards).toEqual(cards(['8s', '3s', '9s']));
    expect(handIn(log[computerDraw], '2-0').cards).toEqual(cards(['2d', '3d', 'Td']));
    expect(log[dealerDraw].dealer.cards).toEqual(cards(['6h', 'Th', '5h']));
    return {
      deal: deal.map(after),
      split: after(split),
      // The double step draws nothing, so it is the wait before its card.
      double: before(doubled),
      doubleCard: after(doubled),
      secondHand: after(secondHand),
      computerDraw: after(computerDraw),
      dealerDraw: after(dealerDraw),
    };
  }

  const fast = (ms, name = '') => expect(ms, name).toBeLessThan(SLOW_MS / 2);
  const slow = (ms, name = '') => expect(ms, name).toBeGreaterThan(SLOW_MS * 0.8);

  test('a slow Other Player Speed slows play but not the deal or the dealer', async ({ page }) => {
    const ms = await measure(page, { dealer: FAST, other: SLOW });
    ms.deal.forEach(fast);
    for (const step of ['split', 'double', 'doubleCard', 'secondHand', 'computerDraw']) slow(ms[step], step);
    fast(ms.dealerDraw);
  });

  test('a slow Dealer Speed slows the deal and the dealer but not play', async ({ page }) => {
    const ms = await measure(page, { dealer: SLOW, other: FAST });
    ms.deal.forEach(slow);
    for (const step of ['split', 'double', 'doubleCard', 'secondHand', 'computerDraw']) fast(ms[step], step);
    slow(ms.dealerDraw);
  });
});

test.describe('15. computer seats', () => {
  const computerSeat = { 'table.seatCount': 2, 'table.computerSeats': [false, true, false, false, false, false] };
  // Seat order: player, computer, dealer up, player, computer, hole card.
  const deal2 = ([h1, h2], [c1, c2], [up, hole]) => [h1, c1, up, h2, c2, hole];

  test('a computer 16 against a 10 follows the Playing Strategy, not "hit to 17"', async ({ page }) => {
    // Seen before it acts: 5 4 T 6 T, a running count of +1. The default
    // strategy stands 16 v 10 at a true count of 0 or more.
    await openTable(page, { settings: computerSeat, stack: deal2(['5s', '4s'], ['Tc', '6c'], ['Th', '7h']) });
    await bet(page);
    expect(await tap(page, 'stand')).toBe('bet');
    expect(await mostCards(page, '2-0')).toBe(2);
  });

  test('a computer 11 against a 6 doubles, as the strategy says', async ({ page }) => {
    // Doubling takes one card (to 13); a hitting seat would draw on.
    await openTable(page, { settings: computerSeat, stack: [...deal2(['Ts', '9s'], ['5c', '6c'], ['6h', 'Th']), '2d', '9d', '9c'] });
    await bet(page);
    expect(await tap(page, 'stand')).toBe('bet');
    expect(await mostCards(page, '2-0')).toBe(3);
  });

  test('a computer seat never surrenders', async ({ page }) => {
    // The strategy surrenders 16 v 10 when the table allows it.
    await openTable(page, { settings: { ...computerSeat, 'rules.surrender': 'late' }, stack: deal2(['5s', '4s'], ['Tc', '6c'], ['Th', '7h']) });
    await bet(page);
    expect(await tap(page, 'stand')).toBe('bet');
    expect((await toasts(page)).map(t => t.text)).not.toContain('Surrender');
    // Still on the table when the dealer turned the hole card.
    const log = await frames(page);
    const revealed = log.find(f => f.dealer.faceUp[1]);
    expect(handIn(revealed, '2-0')?.cards).toEqual(cards(['Tc', '6c']));
  });

  test('a computer seat that splits plays both hands', async ({ page }) => {
    // 8 8 against a 6: split; 8+T stands, 8+2 doubles and draws a 9.
    await openTable(page, { settings: computerSeat, stack: [...deal2(['Ts', '9s'], ['8d', '8c'], ['6h', 'Th']), 'Tc', '2s', '9c'] });
    await bet(page);
    expect(await tap(page, 'stand')).toBe('bet');
    const log = await frames(page);
    const both = log.find(f => handIn(f, '2-0') && handIn(f, '2-1') && handIn(f, '2-1').cards.length === 3);
    expect(both).toBeTruthy();
    expect(handIn(both, '2-0').cards).toEqual(cards(['8d', 'Tc']));
    expect(handIn(both, '2-1').cards).toEqual(cards(['8c', '2s', '9c']));
  });
});
