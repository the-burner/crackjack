import { test, expect } from '@playwright/test';
import { startGame } from './support/table';
import type { Locator, Page } from '@playwright/test';
import { hubOf, openFromHub, openHubFromHome } from './support/settings';

test.use({ serviceWorkers: 'block' });

/** Opens the app (on a clean install when `fresh`) and shows the hub `screen` is opened from. */
async function openHub(page: Page, screen: string, { fresh = false } = {}) {
  await page.goto('/index.html');
  if (fresh) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await openHubFromHome(page, hubOf(screen));
}

const select = (screen: Locator, name: string) => screen.getByRole('combobox', { name, exact: true });
const check = (screen: Locator, label: string) => screen.getByRole('switch', { name: label });

/** The option a select shows. */
const chosen = (screen: Locator, name: string) => select(screen, name).locator('option:checked');

/** Picks one of a select's options. */
async function choose(screen: Locator, name: string, option: string) {
  await select(screen, name).selectOption({ label: option });
}

/** One case per option screen: a change to make and the state it must keep. */
const CASES: {
  button: string;
  screen: string;
  change(el: Locator): Promise<void>;
  verify(el: Locator): Promise<void>;
}[] = [
  {
    button: 'Basic Setup',
    screen: 'game.setup',
    async change(el) {
      await choose(el, 'Decks', 'Double Deck');
    },
    async verify(el) {
      await expect(chosen(el, 'Decks')).toHaveText('Double Deck');
    },
  },
  {
    button: 'Common Rules',
    screen: 'game.commonRules',
    async change(el) {
      await check(el, 'Cards dealt face down').check();
      await choose(el, 'Surrender', 'Late Surrender (common)');
    },
    async verify(el) {
      await expect(check(el, 'Cards dealt face down')).toBeChecked();
      await expect(chosen(el, 'Surrender')).toHaveText('Late Surrender (common)');
    },
  },
  {
    button: 'Rule Variations',
    screen: 'game.ruleVariations',
    async change(el) {
      await check(el, 'Triple Down').check();
    },
    async verify(el) {
      await expect(check(el, 'Triple Down')).toBeChecked();
    },
  },
  {
    button: 'Speed/Mechanics',
    screen: 'game.mechanics',
    async change(el) {
      await check(el, 'Hide shoe').check();
    },
    async verify(el) {
      await expect(check(el, 'Hide shoe')).toBeChecked();
    },
  },
  {
    button: 'Bonuses',
    screen: 'game.bonuses',
    async change(el) {
      await check(el, 'Blackjack pays 6:5').check();
    },
    async verify(el) {
      await expect(check(el, 'Blackjack pays 6:5')).toBeChecked();
    },
  },
  {
    button: 'Play Variations',
    screen: 'game.playVariations',
    async change(el) {
      await check(el, 'Dealer wins ties').check();
    },
    async verify(el) {
      await expect(check(el, 'Dealer wins ties')).toBeChecked();
    },
  },
  {
    button: 'Unusual Games',
    screen: 'game.unusualGames',
    async change(el) {
      await choose(el, 'Game', 'Lucky Ladies');
    },
    async verify(el) {
      await expect(chosen(el, 'Game')).toHaveText('Lucky Ladies');
    },
  },
  {
    button: 'Dealer Errs/Biases',
    screen: 'game.dealerErrors',
    async change(el) {
      await choose(el, 'Dealing bias', 'Repeat errors');
      await check(el, 'Lose on a push').check();
    },
    async verify(el) {
      await expect(chosen(el, 'Dealing bias')).toHaveText('Repeat errors');
      await expect(check(el, 'Lose on a push')).toBeChecked();
    },
  },
  {
    button: 'Peeking',
    screen: 'game.peeking',
    async change(el) {
      await check(el, 'Peek when dealer peeks').check();
      await choose(el, 'Percent of the time', '50%');
    },
    async verify(el) {
      await expect(check(el, 'Peek when dealer peeks')).toBeChecked();
      await expect(chosen(el, 'Percent of the time')).toHaveText('50%');
    },
  },
  {
    button: 'Appearance & Sound',
    screen: 'settings.appearance',
    async change(el) {
      await choose(el, 'Theme', 'Catppuccin Latte');
      await check(el, 'Sound on').check();
    },
    async verify(el) {
      await expect(chosen(el, 'Theme')).toHaveText('Catppuccin Latte');
      await expect(check(el, 'Sound on')).toBeChecked();
      await expect(el.page().locator('html')).toHaveAttribute('data-theme', 'latte');
    },
  },
];

for (const hub of ['settings', 'game.options'] as const) {
  test(`the ${hub} hub reaches each of its option screens`, async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    const el = await openHubFromHome(page, hub);
    const cases = CASES.filter(c => hubOf(c.screen) === hub);
    expect(cases.length).toBeGreaterThan(0);
    for (const { button, screen } of cases) {
      await openFromHub(page, button, screen);
      await page.locator(`[data-screen="${screen}"] [data-action="back"]`).click();
      await expect(el).toBeVisible();
    }
  });
}

test('Settings holds what the whole app shares; Game Options what only the game uses', async ({ page }) => {
  await page.goto('/index.html');
  const settings = await openHubFromHome(page, 'settings');
  // The strategy screens are covered by their own tests, so only check that the links are there.
  for (const button of ['Playing Strategies', 'True Count Calcs', 'Appearance & Sound']) {
    await expect(settings.getByRole('button', { name: button, exact: true })).toBeVisible();
  }
  await expect(settings.getByRole('button', { name: 'Betting Strategies' })).toHaveCount(0);
  await expect(settings.locator('[data-action="play"]')).toHaveCount(0);

  await settings.locator('[data-action="back"]').click();
  const game = await openHubFromHome(page, 'game.options');
  await expect(game.getByRole('button', { name: 'Betting Strategies', exact: true })).toBeVisible();
  await expect(game.getByRole('switch', { name: 'Warning on Strategy Error' })).toBeVisible();
  await expect(game.getByRole('button', { name: 'Playing Strategies' })).toHaveCount(0);
});

for (const testCase of CASES) {
  test(`${testCase.button} keeps its settings across a reload`, async ({ page }) => {
    await openHub(page, testCase.screen, { fresh: true });
    await testCase.change(await openFromHub(page, testCase.button, testCase.screen));

    await page.reload();
    await openHub(page, testCase.screen);
    await testCase.verify(await openFromHub(page, testCase.button, testCase.screen));
  });
}

test('turning off the ace peek turns off the ten peek', async ({ page }) => {
  await openHub(page, 'game.playVariations', { fresh: true });
  const el = await openFromHub(page, 'Play Variations', 'game.playVariations');
  await expect(check(el, 'Dealer peeks on ten')).toBeChecked();
  await check(el, 'Dealer peeks on ace').uncheck();
  await expect(check(el, 'Dealer peeks on ten')).not.toBeChecked();
});

test('the blackjack payout rows are mutually exclusive', async ({ page }) => {
  await openHub(page, 'game.bonuses', { fresh: true });
  const el = await openFromHub(page, 'Bonuses', 'game.bonuses');
  await check(el, 'Blackjack pays 2:1').check();
  await check(el, 'No Blackjack bonus').check();
  await expect(check(el, 'Blackjack pays 2:1')).not.toBeChecked();
  await expect(check(el, 'No Blackjack bonus')).toBeChecked();
});

test('Double Exposure applies its rule bundle', async ({ page }) => {
  await openHub(page, 'game.unusualGames', { fresh: true });
  const games = await openFromHub(page, 'Unusual Games', 'game.unusualGames');
  await choose(games, 'Game', 'Double Exposure');
  await games.locator('[data-action="back"]').click();

  const rules = await openFromHub(page, 'Common Rules', 'game.commonRules');
  await expect(chosen(rules, 'Insurance')).toHaveText('No Insurance');
  await rules.locator('[data-action="back"]').click();

  const play = await openFromHub(page, 'Play Variations', 'game.playVariations');
  await expect(check(play, 'Dealer wins ties')).toBeChecked();
});

test('Play Blackjack keeps the saved seat count and opens the table', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await startGame(page);
  await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
  const saved = await page.evaluate(
    () => (JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state?.values ?? {})['table.seatCount'],
  );
  expect(saved ?? 4).toBe(4);
});

test('Escape closes an open dialog and leaves the screen working', async ({ page }) => {
  await openHub(page, 'game.setup', { fresh: true });
  const el = await openFromHub(page, 'Basic Setup', 'game.setup');
  const burnCards = el.getByRole('button', { name: /^Burn Cards: / });
  await burnCards.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(el).toBeVisible();
  await burnCards.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('a slider value can be typed into its number box', async ({ page }) => {
  await openHub(page, 'game.mechanics', { fresh: true });
  const el = await openFromHub(page, 'Speed/Mechanics', 'game.mechanics');
  const box = el.getByRole('spinbutton', { name: 'Dealer Speed' });
  const range = el.getByRole('slider', { name: 'Dealer Speed' });
  const saved = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state.values['mechanics.dealerSpeed']);

  await box.fill('72');
  await box.press('Enter');
  await expect(range).toHaveValue('72');
  expect(await saved()).toBe(72);

  // Out-of-range values are kept within the slider's range.
  await box.fill('500');
  await box.press('Enter');
  await expect(box).toHaveValue('100');
  expect(await saved()).toBe(100);

  // A blank entry is put back to the current value.
  await box.fill('');
  await box.press('Enter');
  await expect(box).toHaveValue('100');

  // The box is vertically centred: equal padding above and below its text.
  const metrics = await box.evaluate(input => {
    const style = getComputedStyle(input);
    return {
      height: input.getBoundingClientRect().height,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
    };
  });
  expect(metrics.height).toBe(32);
  expect(metrics.paddingTop).toBe(metrics.paddingBottom);
});
