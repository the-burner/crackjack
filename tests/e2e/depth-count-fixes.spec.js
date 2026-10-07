// Fixes to the Depth and Count drills, driven through the running app: the
// cards must be covered when a test starts, a pending next test must not
// outlive Pause or Restart, and the end of a shoe must show its last cards.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Opens the app with the given settings already saved. */
async function open(page, settings = {}) {
  await page.addInitScript(values => {
    localStorage.clear();
    localStorage.setItem('cj.settings', JSON.stringify(values));
  }, settings);
  await page.goto('/index.html');
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

const DEPTH = { button: 'Depth Drills', options: 'drills.depth.options', play: 'drills.depth' };
const COUNT = { button: 'Count Drills', options: 'drills.count.options', play: 'drills.count' };

/** Launches a drill and waits out the "2, 1" countdown. */
async function launch(page, drill) {
  await page.getByRole('button', { name: drill.button }).click();
  const options = page.locator(`[data-screen="${drill.options}"]`);
  await expect(options).toBeVisible();
  await options.locator('[data-action="launch"]').click();
  const screen = page.locator(`[data-screen="${drill.play}"]`);
  await expect(screen).toBeVisible();
  await expect(screen.locator('.drill__countdown')).toBeHidden({ timeout: 5000 });
  return screen;
}

const statsText = screen => screen.locator('.drill__stats').innerText();

/** How many pixels of a canvas are not the felt it was filled with. */
const nonFeltPixels = canvas =>
  canvas.evaluate(el => {
    const { data } = el.getContext('2d').getImageData(0, 0, el.width, el.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - data[0]) > 8 || Math.abs(data[i + 1] - data[1]) > 8 || Math.abs(data[i + 2] - data[2]) > 8)
        count += 1;
    }
    return count;
  });

/** The percentage of a box at the middle of a canvas that is felt (the corner is felt). */
const feltAtCentre = canvas =>
  canvas.evaluate(el => {
    const ctx = el.getContext('2d');
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const box = { width: Math.round(el.width / 4), height: Math.round(el.height / 10) };
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
const answerThen = (page, label) =>
  page.evaluate(name => {
    const screen = document.querySelector('[data-screen="drills.depth"]');
    const answers = screen.querySelector('canvas.drill__answers');
    const box = answers.getBoundingClientRect();
    answers.dispatchEvent(
      new MouseEvent('click', {
        clientX: box.left + box.width * 0.5,
        clientY: box.top + box.height * 0.5,
      }),
    );
    [...screen.querySelectorAll('button')].find(b => b.textContent.trim() === name)?.click();
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
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);
    const tray = screen.locator('canvas.drill__tray');
    expect(await nonFeltPixels(tray)).toBeGreaterThan(0);

    await answerThen(page, 'Pause');
    await expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible();
    // Past the pause the answer leaves before the next test is built.
    await page.waitForTimeout(400);
    expect(await nonFeltPixels(tray)).toBe(0);
  });

  test('a restarted drill shows no test during its countdown', async ({ page }) => {
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);

    await answerThen(page, 'Restart');
    await expect(screen.locator('.drill__countdown')).toBeVisible();
    await page.waitForTimeout(400);
    expect(await nonFeltPixels(screen.locator('canvas.drill__tray'))).toBe(0);
  });

  test('counts one test for two quick taps on the right answer', async ({ page }) => {
    await open(page, TWO_DECK_DEPTH);
    const screen = await launch(page, DEPTH);
    expect(await statsText(screen)).toContain('Tests: 1');

    await screen.locator('canvas.drill__answers').dblclick({ position: await rightCell(screen) });
    await page.waitForTimeout(400);
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
    await expect(screen.locator('.drill__message')).toHaveText('No tests can be shown with these options.');
  });
});

/** The middle of the only answer cell of a two-deck full-resolution grid. */
async function rightCell(screen) {
  const box = await screen.locator('canvas.drill__answers').boundingBox();
  return { x: box.width * 0.5, y: box.height * 0.5 };
}

test.describe('count drill', () => {
  test('covers the cards for a test too deep for a tray photo', async ({ page }) => {
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
      const next = [...el.querySelectorAll('button')].find(b => b.textContent.trim() === 'Next');
      const answers = el.querySelector('canvas.drill__answers');
      const wrap = el.querySelector('.drill__answers-wrap');
      const cards = el.querySelector('canvas.drill__cards');
      const sleep = ms =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        });
      const nonFelt = () => {
        const { data } = cards.getContext('2d').getImageData(0, 0, cards.width, cards.height);
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
      let last = null;
      for (let step = 0; step < 2000; step++) {
        if (wrap.hidden) {
          if (next.hidden) break;
          next.click();
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
    const cards = screen.locator('canvas.drill__cards');

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
    const cards = screen.locator('canvas.drill__cards');

    // The flashed cards cover the middle of the felt, where the warning goes.
    await expect.poll(() => feltAtCentre(cards)).toBeLessThan(10);
    // So the warning needs felt of its own to be read on.
    await expect.poll(() => feltAtCentre(cards), { timeout: 7000 }).toBeGreaterThan(50);
  });
});
