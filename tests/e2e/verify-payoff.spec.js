// Checks, in the browser and as the player sees it, the payoff and turn
// behaviours copied from the original app. Every deal is seeded; the seeds were
// chosen by replaying the engine offline for the deal each test needs.

import { test, expect } from '@playwright/test';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/** Seats 1 and 2 are the player's; 3 and 4 are computer players. */
const TWO_HUMAN = [false, false, true, true, false, false];

/** Speed s waits (101 - s) / 120 seconds per step. */
const pauseFor = speed => Math.round(((101 - speed) / 120) * 1000);

/** Logs, from page load, every seat label, bankroll, readout and pop-up change. */
function recorder() {
  window.__cjRecordFrames = true;
  const log = (window.__cjLog = []);
  const frameCount = () => window.__cjFrames?.length ?? 0;
  const seen = new Map();
  const toasts = new Map();
  const changed = (key, sig) => {
    if (seen.get(key) === sig) return false;
    seen.set(key, sig);
    return true;
  };
  const pillLook = pill => {
    const c = getComputedStyle(pill);
    const chip = pill.parentElement;
    const felt = document.querySelector('.table__felt');
    const range = document.createRange();
    range.selectNodeContents(pill);
    const rect = r => ({
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    });
    return {
      style: {
        radius: c.borderTopLeftRadius,
        family: c.fontFamily,
        size: c.fontSize,
        weight: c.fontWeight,
        shadow: c.boxShadow,
        background: c.backgroundColor,
        color: c.color,
      },
      pill: rect(pill.getBoundingClientRect()),
      text: rect(range.getBoundingClientRect()),
      padding: parseFloat(c.paddingLeft) + parseFloat(c.paddingRight),
      chip: rect(chip.getBoundingClientRect()),
      chipOverflow: getComputedStyle(chip).overflow,
      felt: rect(felt.getBoundingClientRect()),
      overflowsItself: pill.scrollWidth > pill.clientWidth + 1,
    };
  };
  const scan = () => {
    const t = performance.now();
    const f = frameCount();
    for (const chip of document.querySelectorAll('.table__chip')) {
      const pill = chip.querySelector('.table__result');
      const state = {
        pill: pill ? pill.textContent : null,
        tone: pill?.dataset.tone ?? null,
        text: pill ? '' : chip.textContent,
      };
      if (!changed(`chip${chip.dataset.seat}`, JSON.stringify(state))) continue;
      log.push({ kind: 'chip', t, f, seat: Number(chip.dataset.seat), ...state, look: pill ? pillLook(pill) : null });
    }
    const offered = [...document.querySelectorAll('.table__actions [data-action]')]
      .filter(el => !el.hidden)
      .map(el => el.dataset.action)
      .join(',');
    if (changed('actions', offered)) log.push({ kind: 'actions', t, f, text: offered });
    for (const [kind, selector] of [
      ['bankroll', '.table__bankroll'],
      ['counts', '.table__counts'],
    ]) {
      const el = document.querySelector(selector);
      if (el && changed(kind, el.textContent)) log.push({ kind, t, f, text: el.textContent });
    }
    for (const el of document.querySelectorAll('.toast')) {
      if (!toasts.has(el)) {
        const entry = {
          kind: 'toast',
          t,
          f,
          text: el.textContent,
          className: el.className,
          leaving: null,
          removed: null,
        };
        toasts.set(el, entry);
        log.push(entry);
      }
      const entry = toasts.get(el);
      if (entry.leaving === null && el.classList.contains('is-leaving')) entry.leaving = t;
    }
    for (const [el, entry] of toasts) if (entry.removed === null && !el.isConnected) entry.removed = t;
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'hidden'],
  });
}

/** Records every sound the table asks for, and every audio file actually started. */
async function recordSounds(page) {
  await page.evaluate(() => {
    window.__cjSounds = [];
    const play = window.app.sound.play.bind(window.app.sound);
    window.app.sound.play = name => {
      window.__cjSounds.push({ name, t: performance.now(), f: window.__cjFrames?.length ?? 0 });
      play(name);
    };
  });
}

async function openTable(page, { seed, settings = {}, size = PORTRAIT, sound = false } = {}) {
  await page.setViewportSize(size);
  await page.addInitScript(start => {
    let a = start;
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  await page.addInitScript(recorder);
  if (sound) {
    await page.addInitScript(() => {
      window.__cjAudio = [];
      HTMLMediaElement.prototype.play = function play() {
        window.__cjAudio.push({ src: this.src, t: performance.now() });
        return Promise.resolve();
      };
    });
  }
  await page.addInitScript(
    overrides => {
      localStorage.clear();
      localStorage.setItem(
        'cj.settings',
        JSON.stringify({
          'mechanics.dealerSpeed': 99,
          'mechanics.otherPlayerSpeed': 99,
          'mechanics.payoffSpeed': 99,
          'mechanics.dealerPointsOutStupidPlays': false,
          'table.startingBankroll': 1000,
          'table.seatCount': 4,
          'table.computerSeats': [false, true, true, true, false, false],
          'betting.chipValue': 5,
          'betting.warnOnError': false,
          'strategy.warnOnError': false,
          'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 1 })) },
          'display.hideActionButtons': false,
          ...overrides,
        }),
      );
    },
    { ...settings, 'display.sound': sound },
  );
  await page.goto('/index.html');
  if (sound) await recordSounds(page);
  await page.locator('[data-action="play"]').click();
  await expect(page.locator('.bet-overlay')).toBeVisible({ timeout: 15000 });
}

const overlay = page => page.locator('.bet-overlay');
const actionButton = (page, name) => page.locator(`.table__actions [data-action="${name}"]`);
const ACTIONS = ['hit', 'stand', 'double', 'split', 'surrender', 'insure', 'pass'];

/** Choices, given the actions on offer; null waits. */
const POLICY = {
  stand: offered => (offered.includes('pass') ? 'pass' : 'stand'),
  hit: offered => (offered.includes('hit') ? 'hit' : offered.includes('pass') ? 'pass' : 'stand'),
  double: offered => (offered.includes('double') ? 'double' : 'stand'),
  surrender: offered => (offered.includes('surrender') ? 'surrender' : 'stand'),
  splitAll: offered => (offered.includes('split') ? 'split' : 'stand'),
  splitOnce: () => {
    let split = false;
    return offered => {
      if (!split && offered.includes('split')) {
        split = true;
        return 'split';
      }
      return 'stand';
    };
  },
  hitTo17: (offered, cards) =>
    offered.includes('pass') ? 'pass' : offered.includes('hit') && total(cards) < 17 ? 'hit' : 'stand',
  // Lets the insurance offer run out by itself.
  waitOutInsurance: offered => (offered.includes('pass') ? null : 'stand'),
};

/**
 * Clears the logs, bets the first tile and plays the round with `choose`
 * until betting opens again. Returns what the round drew and logged.
 */
async function playRound(page, choose = POLICY.stand, { timeout = 45000, betDelay = 0 } = {}) {
  if (betDelay) await page.waitForTimeout(betDelay);
  await page.evaluate(() => {
    window.__cjFrames = [];
    window.__cjLog.length = 0;
    if (window.__cjSounds) window.__cjSounds.length = 0;
    if (window.__cjAudio) window.__cjAudio.length = 0;
  });
  await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
  await expect(overlay(page)).toBeHidden();
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await overlay(page).isVisible()) break;
    // Read every button at once, so a step finishing mid-read cannot hide one.
    const { offered, cards } = await page.evaluate(names => {
      const last = window.__cjFrames.at(-1);
      return {
        offered: names.filter(name => {
          const el = document.querySelector(`.table__actions [data-action="${name}"]`);
          return el && !el.hidden && el.offsetParent !== null;
        }),
        cards: last?.hands.find(hand => hand.key === last.pointer?.hand)?.cards ?? [],
      };
    }, ACTIONS);
    const pick = offered.length ? choose(offered, cards) : null;
    if (pick)
      await actionButton(page, pick)
        .click()
        .catch(() => {});
    else await page.waitForTimeout(40);
  }
  await expect(overlay(page)).toBeVisible();
  return page.evaluate(() => ({
    frames: window.__cjFrames,
    log: window.__cjLog,
    sounds: window.__cjSounds ?? [],
    audio: window.__cjAudio ?? [],
  }));
}

// --- reading the logs -------------------------------------------------------

const has = (frame, key) => frame.hands.some(hand => hand.key === key);
const handIn = (frame, key) => frame.hands.find(hand => hand.key === key);
/** The frame the dealer's hole card (or, with no hole card, its second card) is first shown face up. */
const dealerPlays = frames => frames.findIndex(f => f.dealer.cards.length >= 2 && f.dealer.faceUp[1] === true);
const firstIndex = (frames, pred, from = 0) => {
  for (let i = from; i < frames.length; i++) if (pred(frames[i], i)) return i;
  return -1;
};
/** The first frame a hand that was on the table is missing from it. */
const goneAt = (frames, key) => {
  const there = firstIndex(frames, f => has(f, key));
  return there < 0 ? -1 : firstIndex(frames, f => !has(f, key), there);
};
const chipLog = (log, seat) => log.filter(e => e.kind === 'chip' && e.seat === seat);
const pillsOn = (log, seat) => chipLog(log, seat).filter(e => e.pill !== null);
const value = id => Math.min(((id - 1) % 13) + 1, 10);
const total = cards => {
  const hard = cards.reduce((sum, id) => sum + value(id), 0);
  return cards.some(id => value(id) === 1) && hard + 10 <= 21 ? hard + 10 : hard;
};
/** How long the pointer stayed on a hand from the first frame it was drawn there. */
const dwell = (frames, key) => {
  const start = firstIndex(frames, f => f.pointer?.hand === key);
  if (start < 0) return 0;
  const end = firstIndex(frames, f => f.pointer?.hand !== key, start);
  return (end < 0 ? frames.at(-1).t : frames[end].t) - frames[start].t;
};

// --- 1. the payoff ----------------------------------------------------------

test.describe('the payoff at the end of a round', () => {
  // Seed 15: seat 1 wins, seat 2 loses, computer seat 3 wins, computer seat 4 pushes.
  const settings = {
    'table.computerSeats': TWO_HUMAN,
    'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 2 })) },
    'mechanics.payoffSpeed': 1,
  };
  const order = [
    { key: '1-0', seat: 1, result: 'Win', tone: 'win', paid: '$10' },
    { key: '2-0', seat: 2, result: 'Lose', tone: 'lose', paid: '$0' },
    { key: '3-0', seat: 3, result: 'Win', tone: 'win', paid: null },
    { key: '4-0', seat: 4, result: 'Push', tone: 'push', paid: null },
  ];

  test('pays each hand in seat order: its result, then its amount, then its cards go to the tray', async ({ page }) => {
    test.setTimeout(60000);
    await openTable(page, { seed: 15, settings });
    const { frames, log } = await playRound(page);
    const reveal = dealerPlays(frames);
    expect(reveal).toBeGreaterThan(0);
    const revealT = frames[reveal].t;

    let previousGoneT = revealT;
    for (const hand of order) {
      const gone = goneAt(frames, hand.key);
      expect(gone, `${hand.key} is swept`).toBeGreaterThan(reveal);
      const goneT = frames[gone].t;
      const after = chipLog(log, hand.seat).filter(e => e.t > revealT);
      const result = after.findIndex(e => e.pill !== null);
      expect(result, `${hand.key} shows a result`).toBeGreaterThanOrEqual(0);
      expect(after[result]).toMatchObject({ pill: hand.result, tone: hand.tone });
      // This hand's result comes only after the previous hand has left the table.
      expect(after[result].t, `${hand.key} result after the previous hand left`).toBeGreaterThan(previousGoneT - 1);
      expect(after[result].t, `${hand.key} result before its sweep`).toBeLessThan(goneT);
      if (hand.paid) {
        expect(after[result + 1], `${hand.key} then shows what it paid`).toMatchObject({ pill: null, text: hand.paid });
        expect(after[result + 1].t).toBeLessThan(goneT);
      }
      // The cards land in the tray as the hand leaves.
      const before = frames[gone - 1];
      expect(frames[gone].trayCards - before.trayCards, `${hand.key} cards into the tray`).toBe(
        handIn(before, hand.key).cards.length,
      );
      previousGoneT = goneT;
    }
    // Hand by hand: no frame loses more than one hand at a time.
    const lastGone = goneAt(frames, '4-0');
    for (let i = reveal + 1; i <= lastGone; i++) {
      expect(frames[i - 1].hands.length - frames[i].hands.length, `frame ${i}`).toBeLessThanOrEqual(1);
    }
  });

  test('labels computer seats with a result but never an amount, and leaves the bankroll alone for them', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await openTable(page, { seed: 15, settings });
    const { frames, log } = await playRound(page);
    const revealT = frames[dealerPlays(frames)].t;
    for (const seat of [3, 4]) {
      const pills = pillsOn(log, seat);
      expect(
        pills.map(e => e.pill),
        `seat ${seat}`,
      ).toEqual([order[seat - 1].result]);
      expect(
        chipLog(log, seat).filter(e => e.text.includes('$')),
        `seat ${seat} amounts`,
      ).toEqual([]);
    }
    // The bankroll does not move from the first computer result to the end of the round.
    const computerFrom = pillsOn(log, 3)[0].t;
    const bank = log.filter(e => e.kind === 'bankroll');
    const atStart = bank.filter(e => e.t <= computerFrom).at(-1).text;
    expect(
      bank
        .filter(e => e.t > computerFrom)
        .map(e => e.text)
        .filter(text => text !== atStart),
    ).toEqual([]);
    // Two $5 bets: one won $10, one lost; the computer seats change nothing.
    expect(atStart).toBe('$1,000.00');
    expect(revealT).toBeLessThan(computerFrom);
  });
});

// --- 3. settled at once -----------------------------------------------------

test.describe('a hand settled during play', () => {
  const speeds = { 'mechanics.otherPlayerSpeed': 60, 'mechanics.payoffSpeed': 60 };

  /** Asserts `key` showed `result` and left the table before `beforeIndex`. */
  function sweptBefore(frames, log, key, result, beforeIndex, label) {
    const seat = Number(key.split('-')[0]);
    const gone = goneAt(frames, key);
    expect(gone, `${key} swept`).toBeGreaterThan(0);
    expect(beforeIndex, `${label} happens`).toBeGreaterThan(0);
    expect(gone, `${key} swept before ${label}`).toBeLessThan(beforeIndex);
    const pill = pillsOn(log, seat)[0];
    expect(pill, `${key} result`).toMatchObject({ pill: result });
    expect(pill.t).toBeLessThan(frames[gone].t);
    const before = frames[gone - 1];
    expect(frames[gone].trayCards - before.trayCards).toBe(handIn(before, key).cards.length);
  }

  test('a bust shows its result and is swept before the next seat plays', async ({ page }) => {
    // Seed 1: seat 1 hits to 25.
    await openTable(page, { seed: 1, settings: speeds });
    const { frames, log } = await playRound(page, POLICY.hit);
    sweptBefore(
      frames,
      log,
      '1-0',
      'Bust',
      firstIndex(frames, f => f.pointer?.hand === '2-0'),
      'seat 2 plays',
    );
    // Not shown again at the payoff.
    expect(pillsOn(log, 1).filter(e => e.t > frames[dealerPlays(frames)].t)).toEqual([]);
  });

  test('a computer seat that busts is swept before the next seat plays', async ({ page }) => {
    // Seed 2 (seat 1 doubles): computer seats 3 and 4 both bust.
    await openTable(page, { seed: 2, settings: speeds });
    const { frames, log } = await playRound(page, POLICY.double);
    sweptBefore(
      frames,
      log,
      '3-0',
      'Bust',
      firstIndex(frames, f => f.pointer?.hand === '4-0'),
      'seat 4 plays',
    );
    sweptBefore(frames, log, '4-0', 'Bust', dealerPlays(frames), 'the dealer plays');
  });

  test('a surrender shows its result and is swept before the next seat plays', async ({ page }) => {
    await openTable(page, { seed: 2, settings: { ...speeds, 'rules.surrender': 'late' } });
    const { frames, log } = await playRound(page, POLICY.surrender);
    sweptBefore(
      frames,
      log,
      '1-0',
      'Surrender',
      firstIndex(frames, f => f.pointer?.hand === '2-0'),
      'seat 2 plays',
    );
  });

  test('a blackjack is swept at once when the dealer has checked for one', async ({ page }) => {
    // Seed 130: seat 1 has a natural; the dealer shows a king and checks.
    await openTable(page, { seed: 130, settings: speeds });
    const { frames, log } = await playRound(page);
    expect(value(frames[dealerPlays(frames)].dealer.cards[0])).toBe(10);
    sweptBefore(
      frames,
      log,
      '1-0',
      '21',
      firstIndex(frames, f => f.pointer?.hand === '2-0'),
      'seat 2 plays',
    );
  });

  test('a blackjack waits for the payoff when the dealer has no hole card', async ({ page }) => {
    // Seed 90, no hole card: seat 1 has a natural against a ten; seat 2 busts.
    await openTable(page, { seed: 90, settings: { ...speeds, 'rules.noHoleCard': true } });
    const { frames, log } = await playRound(page);
    const second = firstIndex(frames, f => f.dealer.cards.length >= 2);
    expect(value(frames[second].dealer.cards[0])).toBe(10);
    expect(goneAt(frames, '1-0'), 'the natural stays until the dealer has its second card').toBeGreaterThan(second);
    expect(pillsOn(log, 1)[0].t).toBeGreaterThan(frames[second].t);
    // A bust is still swept at once.
    sweptBefore(
      frames,
      log,
      '2-0',
      'Bust',
      firstIndex(frames, f => f.pointer?.hand === '3-0'),
      'seat 3 plays',
    );
  });
});

// --- 4. the result pill -----------------------------------------------------

test.describe('the result label', () => {
  const settings = {
    'table.computerSeats': TWO_HUMAN,
    'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 2 })) },
    'mechanics.payoffSpeed': 60,
  };
  for (const [name, size] of [
    ['portrait', PORTRAIT],
    ['landscape', LANDSCAPE],
  ]) {
    test(`is a pill like the app's pop-ups for a win, a loss and a push, unclipped and sized to its text, in ${name}`, async ({
      page,
    }) => {
      await openTable(page, { seed: 15, settings, size });
      const { log } = await playRound(page);
      const pills = log.filter(e => e.kind === 'chip' && e.pill !== null);
      expect(new Set(pills.map(e => e.tone))).toEqual(new Set(['win', 'lose', 'push']));
      const popUps = await page.evaluate(async () => {
        const { toast } = await import('/src/ui/toast.ts');
        const out = {};
        for (const tone of ['good', 'error', 'plain']) {
          const el = toast('x', { tone });
          const c = getComputedStyle(el);
          out[tone] = {
            radius: c.borderTopLeftRadius,
            family: c.fontFamily,
            size: c.fontSize,
            weight: c.fontWeight,
            shadow: c.boxShadow,
            background: c.backgroundColor,
            color: c.color,
          };
          el.remove();
        }
        return out;
      });
      const toneOf = { win: 'good', lose: 'error', push: 'plain' };
      for (const entry of pills) {
        const { look } = entry;
        const label = `${entry.pill} on seat ${entry.seat}`;
        expect(look.style, label).toEqual(popUps[toneOf[entry.tone]]);
        // Not cut off by the seat's label box, nor by the edge of the table.
        if (look.chipOverflow !== 'visible') {
          expect(look.pill.left, label).toBeGreaterThanOrEqual(look.chip.left - 0.5);
          expect(look.pill.right, label).toBeLessThanOrEqual(look.chip.right + 0.5);
          expect(look.pill.top, label).toBeGreaterThanOrEqual(look.chip.top - 0.5);
          expect(look.pill.bottom, label).toBeLessThanOrEqual(look.chip.bottom + 0.5);
        }
        expect(look.pill.left, label).toBeGreaterThanOrEqual(look.felt.left - 0.5);
        expect(look.pill.right, label).toBeLessThanOrEqual(look.felt.right + 0.5);
        expect(look.overflowsItself, label).toBe(false);
        // As wide as its text and padding, no wider.
        expect(Math.abs(look.pill.width - (look.text.width + look.padding)), label).toBeLessThan(2);
      }
    });
  }

  test('a bust and a surrender use the losing colours', async ({ page }) => {
    await openTable(page, { seed: 1 });
    const bust = (await playRound(page, POLICY.hit)).log.filter(e => e.kind === 'chip' && e.pill === 'Bust');
    expect(bust.length).toBeGreaterThan(0);
    expect(bust.every(e => e.tone === 'lose')).toBe(true);
  });
});

// --- 5 and 6. the turn pointer ---------------------------------------------

test.describe('the turn pointer', () => {
  test('points at every hand in turn, and rests on a computer hand for a step even when it stands', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const speed = 40;
    // Seed 15: computer seat 3 draws a card, computer seat 4 stands on 17 without drawing.
    await openTable(page, {
      seed: 15,
      settings: {
        'table.computerSeats': TWO_HUMAN,
        'betting.ramp': { minCount: 0, rows: [1, 2, 5, 10, 15].map(chips => ({ chips, hands: 2 })) },
        'mechanics.otherPlayerSpeed': speed,
      },
    });
    // Bet as a player would, after a moment: the first turn's pointer is checked on its own below.
    const { frames } = await playRound(page, POLICY.stand, { betDelay: 2000 });
    for (const key of ['1-0', '2-0', '3-0', '4-0']) {
      expect(
        frames.some(f => f.pointer?.hand === key),
        `pointer on ${key}`,
      ).toBe(true);
    }
    expect(
      handIn(
        frames.findLast(f => has(f, '4-0') && f.dealer.faceUp[1] !== true),
        '4-0',
      ).cards,
    ).toHaveLength(2);
    for (const key of ['3-0', '4-0']) {
      expect(dwell(frames, key), `pointer rests on ${key}`).toBeGreaterThanOrEqual(pauseFor(speed) * 0.85);
    }
    // Drawn just above the hand it points at.
    for (const f of frames.filter(fr => fr.pointer)) {
      const top = handIn(f, f.pointer.hand).slots.at(-1);
      expect(f.pointer.y).toBeLessThan(top.y);
      expect(Math.abs(f.pointer.x - top.x)).toBeLessThan(60);
    }
    // Gone before the dealer plays.
    const reveal = dealerPlays(frames);
    expect(
      frames
        .slice(reveal)
        .filter(f => f.pointer)
        .map(f => f.pointer.hand),
    ).toEqual([]);
  });

  for (const [name, seed, choose, extra] of [
    ['a bust', 1, POLICY.hit, {}],
    ['a computer bust', 2, POLICY.double, {}],
    ['a surrender', 2, POLICY.surrender, { 'rules.surrender': 'late' }],
  ]) {
    test(`leaves a hand before it is paid, and never points at an emptied seat, after ${name}`, async ({ page }) => {
      await openTable(page, {
        seed,
        settings: { 'mechanics.otherPlayerSpeed': 60, 'mechanics.payoffSpeed': 60, ...extra },
      });
      const { frames, log } = await playRound(page, choose);
      expect(frames.filter(f => f.pointer && !has(f, f.pointer.hand)).map(f => f.pointer.hand)).toEqual([]);
      // While a seat shows a result, the pointer is not on any of its hands.
      for (const entry of log.filter(e => e.kind === 'chip' && e.pill !== null)) {
        const frame = frames[entry.f - 1];
        expect(frame.pointer?.hand?.split('-')[0], `seat ${entry.seat} showing ${entry.pill}`).not.toBe(
          String(entry.seat),
        );
      }
    });
  }

  /** Bets, waits with no input, and returns how long after the turn began the pointer was first drawn. */
  async function firstPointerDelay(page) {
    await page.evaluate(() => {
      window.__cjFrames = [];
      window.__cjLog.length = 0;
    });
    await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
    await expect(actionButton(page, 'stand')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const { frames, log } = await page.evaluate(() => ({ frames: window.__cjFrames, log: window.__cjLog }));
    const turn = log.find(e => e.kind === 'actions' && e.text.includes('stand'));
    const drawn = frames.find(f => f.pointer?.hand === '1-0');
    test
      .info()
      .annotations.push({ type: 'pointer delay', description: drawn ? `${Math.round(drawn.t - turn.t)} ms` : 'never' });
    return drawn ? drawn.t - turn.t : Infinity;
  }

  test('appears on the first turn of a session within a moment, with no input, when the bet is placed at once', async ({
    page,
  }) => {
    await openTable(page, { seed: 7 });
    expect(await firstPointerDelay(page)).toBeLessThan(300);
  });

  test('appears on the first turn of a session within a moment, with no input, at a full table', async ({ page }) => {
    await openTable(page, { seed: 15 });
    expect(await firstPointerDelay(page)).toBeLessThan(300);
  });

  test('appears on the first turn of a session within a moment, with no input, when the bet takes a while', async ({
    page,
  }) => {
    await openTable(page, { seed: 7 });
    await page.waitForTimeout(2000);
    expect(await firstPointerDelay(page)).toBeLessThan(300);
  });

  test('appears on the first turn of a session once its image arrives, with no input', async ({ page }) => {
    // The image arrives well after the turn has begun.
    await page.route('**/assets/table/pointer.png', async route => {
      await new Promise(resolve => setTimeout(resolve, 2500));
      await route.continue();
    });
    await openTable(page, { seed: 7 });
    await page.locator('.bet-overlay__grid').click({ position: { x: 25, y: 25 } });
    await expect(actionButton(page, 'stand')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => window.__cjFrames.at(-1).pointer?.hand ?? null), { timeout: 5000 })
      .toBe('1-0');
  });

  test('appears on the first turn of a session when it is a computer seat', async ({ page }) => {
    // The shipped table: seat 1 is a computer player.
    await openTable(page, {
      seed: 7,
      settings: {
        'table.seatCount': 2,
        'table.computerSeats': [true, false, false, false, false, false],
        'mechanics.otherPlayerSpeed': 30,
      },
    });
    const { frames } = await playRound(page);
    expect(dwell(frames, '1-0')).toBeGreaterThanOrEqual(pauseFor(30) * 0.85);
  });
});

// --- 7. split hands ---------------------------------------------------------

test.describe('split hands', () => {
  /** Where the layout puts the first card of each hand column, by seat. */
  const columns = page =>
    page.evaluate(async () => {
      const { tableLayout } = await import('/src/game/table/layout.ts');
      const felt = document.querySelector('.table__felt');
      const layout = tableLayout({
        width: Math.max(200, Math.round(felt.clientWidth)),
        height: Math.max(200, Math.round(felt.clientHeight)),
        seatCount: window.app.settings.get('table.seatCount'),
        humanSeats: [1],
        decks: window.app.settings.get('table.decks'),
      });
      return Object.fromEntries(layout.seats.map(seat => [seat.seat, seat.hands.map(hand => hand[0].x)]));
    });

  test('a single split puts the two hands at the two ends of the seat', async ({ page }) => {
    // Seed 14: seat 1 splits once; computer seat 2 splits aces.
    await openTable(page, { seed: 14 });
    const { frames } = await playRound(page, POLICY.splitOnce());
    const cols = await columns(page);
    for (const seat of [1, 2]) {
      const both = frames.filter(f => has(f, `${seat}-0`) && has(f, `${seat}-1`));
      expect(both.length, `seat ${seat} split`).toBeGreaterThan(0);
      for (const f of both) {
        expect(handIn(f, `${seat}-0`).slots[0].x, `seat ${seat} first hand`).toBe(cols[seat][0]);
        expect(handIn(f, `${seat}-1`).slots[0].x, `seat ${seat} second hand`).toBe(cols[seat][3]);
      }
    }
  });

  test('three hands sit side by side', async ({ page }) => {
    // Seed 22: seat 1 splits, then splits again.
    await openTable(page, { seed: 22 });
    const { frames } = await playRound(page, POLICY.splitAll);
    const cols = await columns(page);
    const three = frames.filter(f => ['1-0', '1-1', '1-2'].every(key => has(f, key)));
    expect(three.length).toBeGreaterThan(0);
    for (const f of three) {
      expect(['1-0', '1-1', '1-2'].map(key => handIn(f, key).slots[0].x)).toEqual(cols[1].slice(0, 3));
    }
    // Two hands span three column steps; three hands step one at a time.
    const two = frames.find(f => has(f, '1-1') && !has(f, '1-2'));
    const span = handIn(two, '1-0').slots[0].x - handIn(two, '1-1').slots[0].x;
    const step = handIn(three[0], '1-0').slots[0].x - handIn(three[0], '1-1').slots[0].x;
    expect(step).toBeGreaterThan(0);
    expect(Math.abs(span - 3 * step)).toBeLessThanOrEqual(2);
  });
});

test.describe('split hands at the payoff', () => {
  for (const [name, seed, choose] of [
    ['one split', 14, POLICY.splitOnce],
    ['two splits', 22, () => POLICY.splitAll],
  ]) {
    test(`stay where they are while the seat is paid, after ${name}`, async ({ page }) => {
      await openTable(page, { seed });
      const { frames } = await playRound(page, choose());
      const reveal = dealerPlays(frames);
      const keys = frames[reveal].hands.filter(hand => hand.key.startsWith('1-')).map(hand => hand.key);
      expect(keys.length).toBeGreaterThan(1);
      for (const key of keys) {
        const xs = frames
          .slice(reveal)
          .filter(f => has(f, key))
          .map(f => handIn(f, key).slots[0].x);
        expect([...new Set(xs)], `${key} across the payoff`).toEqual([xs[0]]);
      }
    });
  }
});

// --- 8. the count readout ---------------------------------------------------

test.describe('the count readout', () => {
  async function statsRunningCount(page) {
    await page.locator('.table__bar [data-action="stats"]').click();
    await expect(page.locator('[data-screen="game.stats"]')).toBeVisible();
    const row = page.locator('tr', { has: page.getByText('Running Count', { exact: true }) });
    const text = (await row.locator('td').last().textContent()).trim();
    await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
    await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
    return text;
  }
  const rc = text => text.match(/RC: (-?[\d.]+)/)?.[1] ?? null;

  test('counts card by card during the deal, and matches the Stats screen after every round', async ({ page }) => {
    test.setTimeout(90000);
    const speed = 50;
    await openTable(page, { seed: 15, settings: { 'display.showRunningCount': true, 'mechanics.dealerSpeed': speed } });
    for (let round = 0; round < 3; round++) {
      const { frames, log } = await playRound(page);
      const firstTurn = firstIndex(frames, f => f.pointer);
      const dealEnd = firstTurn > 0 ? frames[firstTurn].t : frames[dealerPlays(frames)].t;
      const changes = log.filter(e => e.kind === 'counts' && e.t <= dealEnd + 1);
      const values = changes.map(e => rc(e.text));
      if (round === 0) {
        // The readout moves several times as the cards land, not once at the end.
        expect(values.length, `readout during the deal: ${values}`).toBeGreaterThanOrEqual(3);
        expect(changes.at(-1).t - changes[0].t).toBeGreaterThanOrEqual(pauseFor(speed));
      }
      const shown = rc(await page.locator('.table__counts').textContent());
      expect(shown, `round ${round}`).toBe(await statsRunningCount(page));
    }
  });
});

// --- 9. table messages ------------------------------------------------------

test.describe('table messages', () => {
  test('stay up about three and a half seconds', async ({ page }) => {
    // Seed 4: the dealer shows an ace and offers insurance, which is left to pass by itself.
    await openTable(page, { seed: 4 });
    const { log } = await playRound(page, POLICY.waitOutInsurance);
    const offer = log.find(e => e.kind === 'toast' && e.text.includes('Insurance'));
    expect(offer).toBeTruthy();
    expect(offer.leaving - offer.t).toBeGreaterThan(3300);
    expect(offer.leaving - offer.t).toBeLessThan(3900);
  });

  test('never say "No Dealer Blackjack" or "Dealer busts"', async ({ page }) => {
    // Look for a deal where the dealer checks under a ten, has no blackjack, then
    // busts, so the test does not depend on one seed surviving every change.
    for (let seed = 30; seed < 90; seed++) {
      await openTable(page, { seed });
      const { frames, log } = await playRound(page);
      const dealer = frames.findLast(f => f.dealer.cards.length > 0)?.dealer.cards ?? [];
      if (value(dealer[0]) !== 10 || total(dealer) <= 21) continue;
      const texts = log.filter(e => e.kind === 'toast').map(e => e.text);
      expect(
        texts.filter(text => /no dealer blackjack|dealer busts/i.test(text)),
        `seed ${seed}`,
      ).toEqual([]);
      return;
    }
    throw new Error('no seed between 30 and 90 dealt a ten that went on to bust');
  });

  for (const [name, seed, extra] of [
    ['the dealer checks for it', 43, {}],
    ['the dealer has no hole card', 14, { 'rules.noHoleCard': true }],
  ]) {
    test(`announce a dealer blackjack once when ${name}`, async ({ page }) => {
      await openTable(page, { seed, settings: extra });
      const { frames, log } = await playRound(page);
      const dealer = frames.findLast(f => f.dealer.cards.length > 0).dealer.cards;
      expect(total(dealer)).toBe(21);
      expect(dealer).toHaveLength(2);
      const texts = log.filter(e => e.kind === 'toast').map(e => e.text);
      expect(
        texts.filter(text => /dealer has blackjack/i.test(text)),
        `messages: ${JSON.stringify(texts)}`,
      ).toHaveLength(1);
    });
  }
});

// --- 10. sounds -------------------------------------------------------------

test.describe('sounds', () => {
  test('only a card coming off the shoe clicks, not a card turned over or moved on a split', async ({ page }) => {
    // Seed 14: seat 1 splits; the dealer turns its up card and hole card over.
    await openTable(page, { seed: 14, sound: true });
    const { frames, sounds, audio } = await playRound(page, POLICY.splitOnce());
    const clicks = sounds.filter(s => s.name === 'card');
    const drawn = frames[0].shoeCards - Math.min(...frames.map(f => f.shoeCards));
    expect(drawn).toBeGreaterThan(10);
    expect(clicks).toHaveLength(drawn);
    for (const click of clicks) {
      expect(frames[click.f].shoeCards, `click at frame ${click.f}`).toBe(frames[click.f - 1].shoeCards - 1);
    }
    const split = firstIndex(frames, f => has(f, '1-1'));
    const reveals = frames
      .map((f, i) => i)
      .filter(
        i =>
          i > 0 &&
          frames[i].dealer.faceUp.filter(Boolean).length > frames[i - 1].dealer.faceUp.filter(Boolean).length &&
          frames[i].shoeCards === frames[i - 1].shoeCards,
      );
    expect(reveals.length).toBeGreaterThan(0);
    for (const i of [split, ...reveals])
      expect(
        sounds.filter(s => s.f === i),
        `frame ${i}`,
      ).toEqual([]);
    expect(audio.filter(a => a.src.endsWith('click.mp3'))).toHaveLength(clicks.length);
  });

  test('catching a dealer error with Foul clicks, and a Foul with no error buzzes', async ({ page }) => {
    test.setTimeout(120000);
    await openTable(page, {
      seed: 15,
      sound: true,
      settings: {
        'dealerErrors.noPayOnWin': true,
        'dealerErrors.loseOnPush': true,
        'dealerErrors.blackjackPayoff': true,
        'dealerErrors.shouldHaveBusted': true,
      },
    });
    const foul = page.locator('.bet-overlay [data-action="foul"]');
    const claim = async () => {
      await page.evaluate(() => {
        window.__cjSounds.length = 0;
        window.__cjAudio.length = 0;
      });
      await foul.click();
      return page.evaluate(() => ({
        sounds: window.__cjSounds.map(s => s.name),
        audio: window.__cjAudio.map(a => a.src.split('/').pop()),
      }));
    };
    const missed = await claim();
    expect(missed).toEqual({ sounds: ['error'], audio: ['buzz.mp3'] });
    let caught = null;
    for (let round = 0; round < 40 && !caught; round++) {
      await playRound(page, POLICY.hitTo17);
      const heard = await claim();
      if ((await page.locator('.bet-overlay__title').textContent()).includes('caught')) caught = heard;
    }
    expect(caught, 'a dealer error was made and caught').not.toBeNull();
    expect(caught).toEqual({ sounds: ['card'], audio: ['click.mp3'] });
  });
});

// --- 11. a doubled hand that busts -----------------------------------------

test.describe('a doubled hand that busts', () => {
  test('stays on the table, unannounced, until the payoff', async ({ page }) => {
    // Seed 2: seat 1 doubles on 13 and draws a jack.
    await openTable(page, { seed: 2, settings: { 'mechanics.otherPlayerSpeed': 60, 'mechanics.payoffSpeed': 60 } });
    const { frames, log } = await playRound(page, POLICY.double);
    const doubled = firstIndex(frames, f => handIn(f, '1-0')?.cards.length === 3);
    const reveal = dealerPlays(frames);
    expect(doubled).toBeGreaterThan(0);
    expect(total(handIn(frames[doubled], '1-0').cards)).toBeGreaterThan(21);
    for (let i = doubled; i < reveal; i++) expect(has(frames[i], '1-0'), `frame ${i}`).toBe(true);
    const pills = pillsOn(log, 1);
    expect(pills.length).toBeGreaterThan(0);
    expect(pills.every(e => e.t > frames[reveal].t)).toBe(true);
    expect(log.filter(e => e.kind === 'toast' && /bust/i.test(e.text))).toEqual([]);
    expect(goneAt(frames, '1-0')).toBeGreaterThan(reveal);
  });
});
