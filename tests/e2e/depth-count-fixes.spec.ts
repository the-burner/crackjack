// Fixes to the Depth and Count drills, driven through the running app: the
// cards must be covered when a test starts, a pending next test must not
// outlive Pause or Restart, and the end of a shoe must show its last cards.
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { openWithSettings as open, seedRandom } from './support/app';
import { DRILLS, countdownOf, launchDrill as launch, statsText } from './support/drills';

const DEPTH = DRILLS.depth;
const COUNT = DRILLS.count;

test.use({ serviceWorkers: 'block' });

/** How many pixels of a canvas are not the felt it was filled with. */
const nonFeltPixels = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - data[0]) > 8 || Math.abs(data[i + 1] - data[1]) > 8 || Math.abs(data[i + 2] - data[2]) > 8)
        count += 1;
    }
    return count;
  });

/**
 * The percentage of a small box at the middle of a canvas that is felt (the
 * corner is felt). The box is a fixed size, smaller than the warning's plate on
 * any screen.
 */
const feltAtCentre = (canvas: Locator) =>
  canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const scale = el.width / el.clientWidth;
    const box = { width: Math.round(60 * scale), height: Math.round(16 * scale) };
    const { data } = ctx.getImageData(
      Math.round((el.width - box.width) / 2),
      Math.round((el.height - box.height) / 2),
      box.width,
      box.height,
    );
    let felt = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - r) <= 8 && Math.abs(data[i + 1] - g) <= 8 && Math.abs(data[i + 2] - b) <= 8) felt += 1;
    }
    return Math.round((100 * felt) / (data.length / 4));
  });

/**
 * Answers the one depth cell that can be right, then presses a drill button in
 * the same tick, so the press lands inside the pause before the next test.
 */
const answerThen = (page: Page, label: string) =>
  page.evaluate(name => {
    const screen = document.querySelector('[data-screen="drills.depth"]')!;
    const answers = screen.querySelector('canvas[aria-label="Answer grid"]')!;
    const box = answers.getBoundingClientRect();
    answers.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: box.left + box.width * 0.5,
        clientY: box.top + box.height * 0.5,
      }),
    );
    [...screen.querySelectorAll('button')].find(b => b.textContent?.trim() === name)?.click();
  }, label);

/** Two decks at full resolution: the only answer is "1", half a column in. */
const TWO_DECK_DEPTH = {
  'drills.depth.decks': 2,
  'drills.depth.resolution': 'full',
  'drills.depth.trayStyle': 'sixDeckFront',
  'drills.depth.timerMode': 'auto',
  'drills.depth.seconds': 60,
  'drills.depth.testsPerDrill': 50,
  'drills.depth.accuracy': 0,
};

test.describe('depth drill', () => {
  test('a paused drill stays blank, with no test waiting from the answer before it', async ({ page }) => {
    await page.clock.install();
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);
    const tray = screen.getByRole('img', { name: 'Discard tray' });
    expect(await nonFeltPixels(tray)).toBeGreaterThan(0);

    await answerThen(page, 'Pause');
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    // Past the pause the answer leaves before the next test is built.
    await page.clock.runFor(400);
    expect(await nonFeltPixels(tray)).toBe(0);
  });

  test('a restarted drill shows no test during its countdown', async ({ page }) => {
    await page.clock.install();
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);

    await answerThen(page, 'Restart');
    await expect(countdownOf(screen)).toBeVisible();
    await page.clock.runFor(400);
    expect(await nonFeltPixels(screen.getByRole('img', { name: 'Discard tray' }))).toBe(0);
  });

  test('counts one test for two quick taps on the right answer', async ({ page }) => {
    await page.clock.install();
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);
    expect(await statsText(screen)).toContain('Tests: 1');

    await screen.getByRole('img', { name: 'Answer grid' }).dblclick({ position: await rightCell(screen) });
    // Past the pause after an answer, by which a second advance would have come.
    await page.clock.runFor(400);
    expect(await statsText(screen)).toContain('Tests: 2');
  });

  test('says when the options allow no tests at all', async ({ page }) => {
    await open(page, {
      'drills.depth.drill': 'trueCount',
      'drills.depth.decks': 1,
      'drills.depth.resolution': 'half',
      'drills.depth.countRangeMin': 30,
      'drills.depth.countRangeMax': 64,
      'drills.depth.timerMode': 'auto',
      'drills.depth.seconds': 60,
    });
    const screen = await launch(page, DEPTH);
    await expect(screen.getByRole('status')).toHaveText('No tests can be shown with these options.');
  });
});

/** The middle of the only answer cell of a two-deck full-resolution grid. */
async function rightCell(screen: Locator) {
  const box = (await screen.getByRole('img', { name: 'Answer grid' }).boundingBox())!;
  return { x: box.width * 0.5, y: box.height * 0.5 };
}

test.describe('count drill', () => {
  test('covers the cards for a test too deep for a tray photo', async ({ page }) => {
    // A shoe whose last test comes in its last quarter deck, past the last photo
    // (unseeded, one shoe in five or so tests last at a depth that has a photo).
    await seedRandom(page, 7);
    await open(page, {
      'drills.count.decks': 8,
      'drills.count.trayStyle': 'eightDeckFront',
      'drills.count.cardsPerFlash': '4',
      'drills.count.testEvery': 'about16',
      'drills.count.dealByHand': true,
      'drills.count.accuracy': 0,
      'drills.count.alarmSeconds': 1799,
      'strategy.system': 30,
    });
    const screen = await launch(page, COUNT);

    // The deepest test of the shoe is past the last tray photo, so nothing can
    // be shown with it - least of all the cards it is about.
    const run = await screen.evaluate(async el => {
      const next = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Next')!;
      const answers = el.querySelector('canvas[aria-label="Answer grid"]')!;
      const wrap = el.querySelector<HTMLElement>('[data-slot="answer-grid"]')!;
      const cards = el.querySelector<HTMLCanvasElement>('canvas[aria-label="Cards"]')!;
      const sleep = (ms: number) =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        });
      const nonFelt = () => {
        const { data } = cards.getContext('2d')!.getImageData(0, 0, cards.width, cards.height);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (
            Math.abs(data[i] - data[0]) > 8 ||
            Math.abs(data[i + 1] - data[1]) > 8 ||
            Math.abs(data[i + 2] - data[2]) > 8
          )
            count += 1;
        }
        return count;
      };
      let tests = 0;
      let last: number | null = null;
      for (let step = 0; step < 2000; step++) {
        if (wrap.hidden) {
          if (next.hidden) break;
          next.click();
          // The screen shows the deal once React has rendered it.
          await sleep(0);
          continue;
        }
        tests += 1;
        last = nonFelt();
        // Every cell of the grid, so the right answer is certainly among them.
        const box = answers.getBoundingClientRect();
        for (let row = 0; row < 3; row++) {
          for (let column = 0; column < 6; column++) {
            answers.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                clientX: box.left + (box.width / 6) * (column + 0.5),
                clientY: box.top + (box.height / 3) * (row + 0.5),
              }),
            );
          }
        }
        for (let wait = 0; wait < 50 && !wrap.hidden; wait++) await sleep(20);
      }
      return { tests, last };
    });

    expect(run.tests).toBeGreaterThan(5);
    expect(run.last).toBe(0);
  });

  test('shows the last cards of a shoe before it is done', async ({ page }) => {
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.trayStyle': 'sixDeckFront',
      'drills.count.cardsPerFlash': '3',
      'drills.count.testEvery': 'never',
      'drills.count.dealByHand': true,
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, COUNT);
    const next = screen.getByRole('button', { name: 'Next' });
    const cards = screen.getByRole('img', { name: 'Cards' });

    // Seventeen flashes of three leave one card of the deck to come.
    for (let flash = 0; flash < 17; flash++) await next.click();
    const three = await nonFeltPixels(cards);
    expect(three).toBeGreaterThan(0);

    await next.click();
    await expect(next).toBeVisible();
    expect(await nonFeltPixels(cards)).toBeGreaterThan(three / 4);

    // The shoe is only done once that card has been seen.
    await next.click();
    await expect(next).toBeHidden();
  });

  test('keeps the end warning readable over the cards', async ({ page }) => {
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.trayStyle': 'sixDeckFront',
      'drills.count.cardsPerFlash': '2',
      'drills.count.testEvery': 'never',
      'drills.count.endWarning': 'twoCardsLeft',
      'drills.count.positions': 'vertical',
      'drills.count.dealTenths': 1,
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, COUNT);
    const cards = screen.getByRole('img', { name: 'Cards' });

    // The flashed cards cover the middle of the felt, where the warning goes.
    await expect.poll(() => feltAtCentre(cards)).toBeLessThan(10);
    // So the warning needs felt of its own to be read on.
    await expect.poll(() => feltAtCentre(cards), { timeout: 7000 }).toBeGreaterThan(50);
  });
});

/** Records when each drill card is dealt, in `window.__cjDeals`. */
const recordDeals = (page: Page) =>
  page.evaluate(async () => {
    const url = '/src/drills/shared/shoe.ts';
    const { DrillShoe }: typeof import('@/drills/shared/shoe') = await import(url);
    const deal = DrillShoe.prototype.deal;
    window.__cjDeals = [];
    DrillShoe.prototype.deal = function recordedDeal(this: InstanceType<typeof DrillShoe>) {
      window.__cjDeals.push(performance.now());
      return deal.call(this);
    };
  });

/** Taps every cell of a count grid twice in one tick, so the right one is among them. */
const tapEveryCellTwice = (page: Page) =>
  page.evaluate(() => {
    const answers = document.querySelector('[data-screen="drills.count"] canvas[aria-label="Answer grid"]')!;
    const box = answers.getBoundingClientRect();
    for (let pass = 0; pass < 2; pass++) {
      for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 6; column++) {
          answers.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: box.left + (box.width / 6) * (column + 0.5),
              clientY: box.top + (box.height / 3) * (row + 0.5),
            }),
          );
        }
      }
    }
  });

test.describe('count drill answers', () => {
  test('deals once after a right answer tapped twice', async ({ page }) => {
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.cardsPerFlash': '1',
      'drills.count.testEvery': 'everyCard',
      'drills.count.dealByHand': true,
      'drills.count.accuracy': 0,
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, COUNT);
    await recordDeals(page);
    const next = screen.getByRole('button', { name: 'Next' });
    await next.click();
    await next.click();
    await expect(screen.getByRole('img', { name: 'Answer grid' })).toBeVisible();

    await tapEveryCellTwice(page);
    // One card comes, then the player deals the next test by hand.
    await expect(screen.getByRole('img', { name: 'Answer grid' })).toBeHidden();
    await expect(next).toBeVisible();
    expect(await page.evaluate(() => window.__cjDeals.length)).toBe(2);
  });

  test('a Restart right after a right answer deals at the set speed', async ({ page }) => {
    await page.clock.install();
    await open(page, {
      'drills.count.decks': 1,
      'drills.count.cardsPerFlash': '1',
      'drills.count.testEvery': 'everyCard',
      'drills.count.accuracy': 0,
      'drills.count.dealTenths': 5,
      'drills.count.timerMode': 'countUp',
      'drills.count.alarmSeconds': 1799,
    });
    const screen = await launch(page, COUNT);
    await expect(screen.getByRole('img', { name: 'Answer grid' })).toBeVisible();
    await tapEveryCellTwice(page);
    await screen.getByRole('button', { name: 'Restart' }).click();
    await recordDeals(page);
    await expect(countdownOf(screen)).toBeHidden({ timeout: 5000 });
    await page.clock.runFor(2000);
    const deals = await page.evaluate(() => window.__cjDeals);
    const gaps = deals.slice(1).map((t, i) => t - deals[i]);
    // Every half second, never two deal loops at once.
    expect(gaps.every(gap => gap > 350)).toBe(true);
  });
});

test('a finished drill offers no Pause', async ({ page }) => {
  await open(page, {
    'drills.depth.drill': 'trueCount',
    'drills.depth.decks': 1,
    'drills.depth.resolution': 'half',
    'drills.depth.countRangeMin': 30,
    'drills.depth.countRangeMax': 64,
    'drills.depth.timerMode': 'auto',
    'drills.depth.seconds': 60,
  });
  const screen = await launch(page, DEPTH);
  await expect(screen.getByRole('status')).toHaveText('No tests can be shown with these options.');
  await expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
});
