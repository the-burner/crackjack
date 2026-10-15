// Checks, in the browser and as the player sees it, the payoff and turn
// behaviours copied from the original app. Every deal is seeded; the seeds were
// chosen by replaying the engine offline for the deal each test needs.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Frame } from './globals.d';
import { seedRandom } from './support/app';
import {
  betGrid,
  betOverlay,
  betTitle,
  overlayButton,
  playButton,
  readout,
  SELECTOR,
  statsRunningCount,
  startGame,
} from './support/table';
import type { SavedSettings } from './support/app';
import type { PillLook, Rect, TableLogEntry } from './support/types';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

/** Seats 1 and 2 are the player's; 3 and 4 are computer players. */
const TWO_HUMAN = [false, false, true, true, false, false];

/** Speed s waits (101 - s) / 120 seconds per step. */
const pauseFor = (speed: number) => Math.round(((101 - speed) / 120) * 1000);

/** Logs, from page load, every seat label, bankroll, readout and pop-up change. */
function recorder(sel: typeof SELECTOR) {
  window.__cjRecordFrames = true;
  const log: TableLogEntry[] = (window.__cjLog = []);
  const frameCount = () => window.__cjFrames?.length ?? 0;
  const seen = new Map<string, string>();
  const toasts = new Map<Element, TableLogEntry>();
  const changed = (key: string, sig: string) => {
    if (seen.get(key) === sig) return false;
    seen.set(key, sig);
    return true;
  };
  const pillLook = (pill: HTMLElement): PillLook => {
    const c = getComputedStyle(pill);
    const chip = pill.parentElement!;
    const felt = document.querySelector(sel.felt)!;
    const range = document.createRange();
    range.selectNodeContents(pill);
    const rect = (r: DOMRect): Rect => ({
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
        shadow: c.boxShadow === 'none' ? 'none' : 'shadow',
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
    for (const chip of document.querySelectorAll<HTMLElement>(sel.chip)) {
      const pill = chip.querySelector<HTMLElement>(sel.result);
      const state = {
        pill: pill ? pill.textContent : null,
        tone: pill?.dataset.tone ?? null,
        text: pill ? '' : (chip.textContent ?? ''),
      };
      if (!changed(`chip${chip.dataset.seat}`, JSON.stringify(state))) continue;
      log.push({ kind: 'chip', t, f, seat: Number(chip.dataset.seat), ...state, look: pill ? pillLook(pill) : null });
    }
    const offered = [...document.querySelectorAll<HTMLElement>(sel.actions)]
      .filter(el => !el.hidden)
      .map(el => el.dataset.action)
      .join(',');
    if (changed('actions', offered)) log.push({ kind: 'actions', t, f, text: offered });
    for (const [kind, selector] of [
      ['bankroll', sel.bankroll],
      ['counts', sel.counts],
    ] as const) {
      const el = document.querySelector(selector);
      const text = el?.textContent ?? '';
      if (el && changed(kind, text)) log.push({ kind, t, f, text });
    }
    for (const el of document.querySelectorAll<HTMLElement>(sel.toast)) {
      if (!toasts.has(el)) {
        const entry: TableLogEntry = {
          kind: 'toast',
          t,
          f,
          text: el.textContent ?? '',
          className: el.dataset.tone,
          leaving: null,
          removed: null,
        };
        toasts.set(el, entry);
        log.push(entry);
      }
      const entry = toasts.get(el)!;
      if (entry.leaving === null && el.dataset.leaving !== undefined) entry.leaving = t;
    }
    for (const [el, entry] of toasts) if (entry.removed === null && !el.isConnected) entry.removed = t;
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'hidden', 'data-leaving'],
  });
}

/** Records every sound the table asks for, and every audio file actually started. */
async function recordSounds(page: Page) {
  await page.evaluate(() => {
    window.__cjAudio = [];
    window.app.sound.output = file => window.__cjAudio.push({ src: file, t: performance.now() });
    window.__cjPlays = [];
    const play = window.app.sound.play.bind(window.app.sound);
    window.app.sound.play = name => {
      window.__cjPlays.push({ name, t: performance.now(), f: window.__cjFrames?.length ?? 0 });
      play(name);
    };
  });
}

async function openTable(
  page: Page,
  {
    seed,
    settings = {},
    size = PORTRAIT,
    sound = false,
  }: { seed: number; settings?: SavedSettings; size?: typeof PORTRAIT; sound?: boolean },
) {
  await page.setViewportSize(size);
  await seedRandom(page, seed);
  await page.addInitScript(recorder, SELECTOR);
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
  await startGame(page);
  await expect(betOverlay(page)).toBeVisible({ timeout: 15000 });
}

const overlay = betOverlay;
const actionButton = playButton;
const ACTIONS = ['hit', 'stand', 'double', 'split', 'surrender', 'insure', 'pass'];

/** A choice, given the actions on offer and the cards of the hand in play; null waits. */
type Policy = (offered: string[], cards: number[]) => string | null;

/** Choices, given the actions on offer; null waits. */
const POLICY = {
  stand: offered => (offered.includes('pass') ? 'pass' : 'stand'),
  hit: offered => (offered.includes('hit') ? 'hit' : offered.includes('pass') ? 'pass' : 'stand'),
  splitAll: offered => (offered.includes('split') ? 'split' : 'stand'),
  splitOnce: (): Policy => {
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
} satisfies Record<string, Policy | (() => Policy)>;

/** Makes sure the pointer image has arrived, as it has once a player has taken a moment over the bet. */
const pointerImageLoaded = (page: Page) =>
  page.evaluate(async () => {
    const url = '/src/game/table/photos.ts';
    const { loadImage }: typeof import('@/game/table/photos') = await import(url);
    await loadImage('assets/table/pointer.png').ready;
  });

/**
 * Clears the logs, bets the first tile and plays the round with `choose`
 * until betting opens again. Returns what the round drew and logged.
 */
async function playRound(page: Page, choose: Policy = POLICY.stand, { timeout = 45000 } = {}) {
  await page.evaluate(() => {
    window.__cjFrames = [];
    window.__cjLog.length = 0;
    if (window.__cjPlays) window.__cjPlays.length = 0;
    if (window.__cjAudio) window.__cjAudio.length = 0;
  });
  await betGrid(page).click({ position: { x: 25, y: 25 } });
  await expect(overlay(page)).toBeHidden();
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await overlay(page).isVisible()) break;
    // Read every button at once, so a step finishing mid-read cannot hide one.
    const { offered, cards } = await page.evaluate(
      ({ names, sel }) => {
        const last = window.__cjFrames?.at(-1);
        return {
          offered: names.filter(name => {
            const el = document.querySelector<HTMLElement>(`${sel.actions}[data-action="${name}"]`);
            return el && !el.hidden && el.offsetParent !== null;
          }),
          cards: last?.hands.find(hand => hand.key === last.pointer?.hand)?.cards ?? [],
        };
      },
      { names: ACTIONS, sel: SELECTOR },
    );
    const pick = offered.length ? choose(offered, cards) : null;
    if (pick)
      await actionButton(page, pick)
        .click()
        .catch(() => {});
    // Nothing to do yet: wait until the buttons on offer change, or betting opens.
    else
      await page.waitForFunction(
        ({ names, before, sel }) => {
          const bets = document.querySelector(sel.overlay)?.getBoundingClientRect();
          if (bets && bets.width > 0 && bets.height > 0) return true;
          const now = names.filter(name => {
            const el = document.querySelector<HTMLElement>(`${sel.actions}[data-action="${name}"]`);
            return el && !el.hidden && el.offsetParent !== null;
          });
          return now.join() !== before;
        },
        { names: ACTIONS, before: offered.join(), sel: SELECTOR },
        { timeout: Math.max(1, end - Date.now()) },
      );
  }
  await expect(overlay(page)).toBeVisible();
  return page.evaluate(() => ({
    frames: window.__cjFrames ?? [],
    log: window.__cjLog,
    sounds: window.__cjPlays ?? [],
    audio: window.__cjAudio ?? [],
  }));
}

// --- reading the logs -------------------------------------------------------

const has = (frame: Frame, key: string) => frame.hands.some(hand => hand.key === key);
const handIn = (frame: Frame, key: string) => frame.hands.find(hand => hand.key === key)!;
/** The frame the dealer's hole card (or, with no hole card, its second card) is first shown face up. */
const dealerPlays = (frames: Frame[]) =>
  frames.findIndex(f => f.dealer.cards.length >= 2 && f.dealer.faceUp[1] === true);
const firstIndex = (frames: Frame[], pred: (frame: Frame, index: number) => unknown, from = 0) => {
  for (let i = from; i < frames.length; i++) if (pred(frames[i], i)) return i;
  return -1;
};
/** The first frame a hand that was on the table is missing from it. */
const goneAt = (frames: Frame[], key: string) => {
  const there = firstIndex(frames, f => has(f, key));
  return there < 0 ? -1 : firstIndex(frames, f => !has(f, key), there);
};
const chipLog = (log: TableLogEntry[], seat: number) => log.filter(e => e.kind === 'chip' && e.seat === seat);
const pillsOn = (log: TableLogEntry[], seat: number) => chipLog(log, seat).filter(e => e.pill !== null);
const value = (id: number) => Math.min(((id - 1) % 13) + 1, 10);
const total = (cards: number[]) => {
  const hard = cards.reduce((sum, id) => sum + value(id), 0);
  return cards.some(id => value(id) === 1) && hard + 10 <= 21 ? hard + 10 : hard;
};
/** How long the pointer stayed on a hand from the first frame it was drawn there. */
const dwell = (frames: Frame[], key: string) => {
  const start = firstIndex(frames, f => f.pointer?.hand === key);
  if (start < 0) return 0;
  const end = firstIndex(frames, f => f.pointer?.hand !== key, start);
  return (end < 0 ? frames.at(-1)!.t : frames[end].t) - frames[start].t;
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
});

// --- 3. settled at once -----------------------------------------------------

test.describe('a hand settled during play', () => {
  const speeds = { 'mechanics.otherPlayerSpeed': 60, 'mechanics.payoffSpeed': 60 };

  /** Asserts `key` showed `result` and left the table before `beforeIndex`. */
  function sweptBefore(
    frames: Frame[],
    log: TableLogEntry[],
    key: string,
    result: string,
    beforeIndex: number,
    label: string,
  ) {
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
  ] as const) {
    test(`is a pill like the app's pop-ups for a win, a loss and a push, unclipped and sized to its text, in ${name} @layout`, async ({
      page,
    }) => {
      await openTable(page, { seed: 15, settings, size });
      const { log } = await playRound(page);
      const pills = log.filter(e => e.kind === 'chip' && e.pill !== null);
      expect(new Set(pills.map(e => e.tone))).toEqual(new Set(['win', 'lose', 'push']));
      const popUps = await page.evaluate(async sel => {
        const url = '/src/components/game/table-toast.tsx';
        const { tableToast }: typeof import('@/components/game/table-toast') = await import(url);
        const out: Record<string, PillLook['style']> = {};
        for (const tone of ['good', 'error', 'plain'] as const) {
          tableToast(tone, { tone, ms: 60000 });
          let el: HTMLElement | undefined;
          for (let i = 0; i < 100 && !el; i++) {
            await new Promise(requestAnimationFrame);
            el = [...document.querySelectorAll<HTMLElement>(`${sel.toast}:not([data-leaving])`)].find(
              li => li.textContent === tone,
            );
          }
          // The box from the pop-up, the type from its text.
          const c = getComputedStyle(el!);
          const t = getComputedStyle(el!);
          out[tone] = {
            radius: c.borderTopLeftRadius,
            family: t.fontFamily,
            size: t.fontSize,
            weight: t.fontWeight,
            shadow: c.boxShadow === 'none' ? 'none' : 'shadow',
            background: c.backgroundColor,
            color: t.color,
          };
        }
        return out;
      }, SELECTOR);
      const toneOf: Record<string, string> = { win: 'good', lose: 'error', push: 'plain' };
      for (const entry of pills) {
        const look = entry.look!;
        const label = `${entry.pill} on seat ${entry.seat}`;
        expect(look.style, label).toEqual(popUps[toneOf[entry.tone!]]);
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
});

// --- 5 and 6. the turn pointer ---------------------------------------------

test.describe('the turn pointer', () => {
  test('points at every hand in turn, and rests on a computer hand for a step even when it stands @layout', async ({
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
    await pointerImageLoaded(page);
    const { frames } = await playRound(page, POLICY.stand);
    for (const key of ['1-0', '2-0', '3-0', '4-0']) {
      expect(
        frames.some(f => f.pointer?.hand === key),
        `pointer on ${key}`,
      ).toBe(true);
    }
    expect(
      handIn(
        frames.findLast(f => has(f, '4-0') && f.dealer.faceUp[1] !== true)!,
        '4-0',
      ).cards,
    ).toHaveLength(2);
    for (const key of ['3-0', '4-0']) {
      expect(dwell(frames, key), `pointer rests on ${key}`).toBeGreaterThanOrEqual(pauseFor(speed) * 0.85);
    }
    // Drawn just above the hand it points at.
    for (const f of frames) {
      const pointer = f.pointer;
      if (!pointer) continue;
      const top = handIn(f, pointer.hand).slots.at(-1)!;
      expect(pointer.y).toBeLessThan(top.y);
      expect(Math.abs(pointer.x - top.x)).toBeLessThan(60);
    }
    // Gone before the dealer plays.
    const reveal = dealerPlays(frames);
    expect(frames.slice(reveal).flatMap(f => (f.pointer ? [f.pointer.hand] : []))).toEqual([]);
  });

  /** Bets, waits with no input, and returns how long after the turn began the pointer was first drawn. */
  async function firstPointerDelay(page: Page) {
    await page.evaluate(() => {
      window.__cjFrames = [];
      window.__cjLog.length = 0;
    });
    await betGrid(page).click({ position: { x: 25, y: 25 } });
    await expect(actionButton(page, 'stand')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const { frames, log } = await page.evaluate(() => ({ frames: window.__cjFrames ?? [], log: window.__cjLog }));
    const turn = log.find(e => e.kind === 'actions' && e.text.includes('stand'))!;
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
    await betGrid(page).click({ position: { x: 25, y: 25 } });
    await expect(actionButton(page, 'stand')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(() => page.evaluate(() => window.__cjFrames?.at(-1)?.pointer?.hand ?? null), { timeout: 5000 })
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
  const columns = (page: Page) =>
    page.evaluate(async () => {
      const url = '/src/game/table/layout.ts';
      const { tableLayout }: typeof import('@/game/table/layout') = await import(url);
      const felt = document.querySelector<HTMLElement>('[data-testid="felt"]')!;
      const layout = tableLayout({
        width: Math.max(200, Math.round(felt.clientWidth)),
        height: Math.max(200, Math.round(felt.clientHeight)),
        seatCount: window.app.settings.get('table.seatCount'),
        humanSeats: [1],
        decks: window.app.settings.get('table.decks'),
      });
      return {
        cardWidth: layout.cardWidth,
        ...Object.fromEntries(
          layout.seats.map(seat => [
            seat.seat,
            { hands: seat.hands.map(hand => hand[0].x), pair: seat.pair.map(hand => hand[0].x) },
          ]),
        ),
      } as { cardWidth: number } & Record<number, { hands: number[]; pair: number[] }>;
    });

  test('a single split puts the two hands side by side, a card and a gap apart @layout', async ({ page }) => {
    // Seed 14: seat 1 splits once; computer seat 2 splits aces.
    await openTable(page, { seed: 14 });
    const { frames } = await playRound(page, POLICY.splitOnce());
    const cols = await columns(page);
    for (const seat of [1, 2]) {
      const both = frames.filter(f => has(f, `${seat}-0`) && has(f, `${seat}-1`));
      expect(both.length, `seat ${seat} split`).toBeGreaterThan(0);
      for (const f of both) {
        const [first, second] = [handIn(f, `${seat}-0`).slots[0].x, handIn(f, `${seat}-1`).slots[0].x];
        expect([first, second], `seat ${seat}`).toEqual(cols[seat].pair);
        expect(first - second, `seat ${seat}`).toBeGreaterThan(cols.cardWidth);
      }
    }
  });

  test('three hands sit side by side @layout', async ({ page }) => {
    // Seed 22: seat 1 splits, then splits again.
    await openTable(page, { seed: 22 });
    const { frames } = await playRound(page, POLICY.splitAll);
    const cols = await columns(page);
    const three = frames.filter(f => ['1-0', '1-1', '1-2'].every(key => has(f, key)));
    expect(three.length).toBeGreaterThan(0);
    for (const f of three) {
      expect(['1-0', '1-1', '1-2'].map(key => handIn(f, key).slots[0].x)).toEqual(cols[1].hands.slice(0, 3));
    }
  });
});

test.describe('split hands at the payoff', () => {
  for (const [name, seed, choose] of [
    ['one split', 14, POLICY.splitOnce],
    ['two splits', 22, () => POLICY.splitAll],
  ] satisfies [string, number, () => Policy][]) {
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
  const rc = (text: string | null) => text?.match(/RC: (-?[\d.]+)/)?.[1] ?? null;

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
        expect(changes.at(-1)!.t - changes[0].t).toBeGreaterThanOrEqual(pauseFor(speed));
      }
      const shown = rc(await readout(page).textContent());
      expect(shown, `round ${round}`).toBe(await statsRunningCount(page));
    }
  });
});

// --- 10. sounds -------------------------------------------------------------

test.describe('sounds', () => {
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
    const foul = overlayButton(page, 'Foul');
    const claim = async () => {
      await page.evaluate(() => {
        window.__cjPlays.length = 0;
        window.__cjAudio.length = 0;
      });
      await foul.click();
      return page.evaluate(() => ({
        sounds: window.__cjPlays.map(s => s.name),
        audio: window.__cjAudio.map(a => a.src.split('/').pop()),
      }));
    };
    const missed = await claim();
    expect(missed).toEqual({ sounds: ['error'], audio: ['buzz.mp3'] });
    let caught = null;
    for (let round = 0; round < 40 && !caught; round++) {
      await playRound(page, POLICY.hitTo17);
      const heard = await claim();
      if ((await betTitle(page).textContent())?.includes('caught')) caught = heard;
    }
    expect(caught, 'a dealer error was made and caught').not.toBeNull();
    expect(caught).toEqual({ sounds: ['card'], audio: ['click.mp3'] });
  });
});
