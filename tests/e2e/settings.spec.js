import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** Opens the app on a clean install and shows the settings hub. */
async function openHub(page, { fresh = false } = {}) {
  await page.goto('/index.html');
  if (fresh) {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
}

/** Opens one option screen from the hub. */
async function openOption(page, button, screen) {
  await page.locator('[data-screen="settings"]').getByRole('button', { name: button, exact: true }).click();
  const el = page.locator(`[data-screen="${screen}"]`);
  await expect(el).toBeVisible();
  return el;
}

const select = (screen, key) => screen.locator(`select[name="${key}"]`);
const check = (screen, label) => screen.getByRole('checkbox', { name: label });

/** One case per option screen: a change to make and the state it must keep. */
const CASES = [
  {
    button: 'Basic Setup',
    screen: 'settings.setup',
    async change(el) { await select(el, 'table.decks').selectOption({ label: 'Double Deck' }); },
    async verify(el) { await expect(select(el, 'table.decks')).toHaveValue('Double Deck'); },
  },
  {
    button: 'Common Rules',
    screen: 'settings.commonRules',
    async change(el) {
      await check(el, 'Cards dealt face down').check();
      await select(el, 'rules.surrender').selectOption({ label: 'Late Surrender (common)' });
    },
    async verify(el) {
      await expect(check(el, 'Cards dealt face down')).toBeChecked();
      await expect(select(el, 'rules.surrender')).toHaveValue('Late Surrender (common)');
    },
  },
  {
    button: 'Rule Variations',
    screen: 'settings.ruleVariations',
    async change(el) { await check(el, 'Triple Down').check(); },
    async verify(el) { await expect(check(el, 'Triple Down')).toBeChecked(); },
  },
  {
    button: 'Speed/Mechanics',
    screen: 'settings.mechanics',
    async change(el) { await check(el, 'Sound on').check(); },
    async verify(el) { await expect(check(el, 'Sound on')).toBeChecked(); },
  },
  {
    button: 'Bonuses',
    screen: 'settings.bonuses',
    async change(el) { await check(el, 'Blackjack pays 6:5').check(); },
    async verify(el) { await expect(check(el, 'Blackjack pays 6:5')).toBeChecked(); },
  },
  {
    button: 'Play Variations',
    screen: 'settings.playVariations',
    async change(el) { await check(el, 'Dealer wins ties').check(); },
    async verify(el) { await expect(check(el, 'Dealer wins ties')).toBeChecked(); },
  },
  {
    button: 'Unusual Games',
    screen: 'settings.unusualGames',
    async change(el) { await select(el, 'bonuses.game').selectOption({ label: 'Lucky Ladies' }); },
    async verify(el) { await expect(select(el, 'bonuses.game')).toHaveValue('Lucky Ladies'); },
  },
  {
    button: 'Dealer Errs/Biases',
    screen: 'settings.dealerErrors',
    async change(el) {
      await select(el, 'dealerErrors.dealingBias').selectOption({ label: 'Repeat errors' });
      await check(el, 'Lose on a push').check();
    },
    async verify(el) {
      await expect(select(el, 'dealerErrors.dealingBias')).toHaveValue('Repeat errors');
      await expect(check(el, 'Lose on a push')).toBeChecked();
    },
  },
  {
    button: 'Peeking',
    screen: 'settings.peeking',
    async change(el) {
      await check(el, 'Peek when dealer peeks').check();
      await select(el, 'peeking.percent').selectOption({ label: '50%' });
    },
    async verify(el) {
      await expect(check(el, 'Peek when dealer peeks')).toBeChecked();
      await expect(select(el, 'peeking.percent')).toHaveValue('50%');
    },
  },
  {
    button: 'Appearance & Customization',
    screen: 'settings.appearance',
    async change(el) { await select(el, 'display.theme').selectOption({ label: 'Catppuccin Latte' }); },
    async verify(el) {
      await expect(select(el, 'display.theme')).toHaveValue('Catppuccin Latte');
      await expect(el.page().locator('html')).toHaveAttribute('data-theme', 'latte');
    },
  },
];

test('the hub reaches every option screen', async ({ page }) => {
  await openHub(page, { fresh: true });
  for (const { button, screen } of CASES) {
    await openOption(page, button, screen);
    await page.locator(`[data-screen="${screen}"] [data-action="back"]`).click();
    await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  }
  // The hub also links to the screens the strategy area owns; those screens are
  // covered by their own tests, so only check that the links are there.
  const hub = page.locator('[data-screen="settings"]');
  for (const button of ['Playing Strategies', 'Betting Strategies', 'True Count Calcs']) {
    await expect(hub.getByRole('button', { name: button, exact: true })).toBeVisible();
  }
  // The game is launched from the home screen only.
  await expect(hub.locator('[data-action="launch"]')).toHaveCount(0);
});

for (const testCase of CASES) {
  test(`${testCase.button} keeps its settings across a reload`, async ({ page }) => {
    await openHub(page, { fresh: true });
    await testCase.change(await openOption(page, testCase.button, testCase.screen));

    await page.reload();
    await openHub(page);
    await testCase.verify(await openOption(page, testCase.button, testCase.screen));
  });
}

test('turning off the ace peek turns off the ten peek', async ({ page }) => {
  await openHub(page, { fresh: true });
  const el = await openOption(page, 'Play Variations', 'settings.playVariations');
  await expect(check(el, 'Dealer peeks on ten')).toBeChecked();
  await check(el, 'Dealer peeks on ace').uncheck();
  await expect(check(el, 'Dealer peeks on ten')).not.toBeChecked();
});

test('the blackjack payout rows are mutually exclusive', async ({ page }) => {
  await openHub(page, { fresh: true });
  const el = await openOption(page, 'Bonuses', 'settings.bonuses');
  await check(el, 'Blackjack pays 2:1').check();
  await check(el, 'No Blackjack bonus').check();
  await expect(check(el, 'Blackjack pays 2:1')).not.toBeChecked();
  await expect(check(el, 'No Blackjack bonus')).toBeChecked();
});

test('Double Exposure applies its rule bundle', async ({ page }) => {
  await openHub(page, { fresh: true });
  const games = await openOption(page, 'Unusual Games', 'settings.unusualGames');
  await select(games, 'bonuses.game').selectOption({ label: 'Double Exposure' });
  await games.locator('[data-action="back"]').click();

  const rules = await openOption(page, 'Common Rules', 'settings.commonRules');
  await expect(select(rules, 'rules.insurance')).toHaveValue('No Insurance');
  await rules.locator('[data-action="back"]').click();

  const play = await openOption(page, 'Play Variations', 'settings.playVariations');
  await expect(check(play, 'Dealer wins ties')).toBeChecked();
});

test('Play Blackjack keeps the saved seat count and opens the table', async ({ page }) => {
  await openHub(page, { fresh: true });
  await page.evaluate(() => window.app.router.home());
  await page.locator('[data-screen="home"] [data-action="play"]').click();
  await expect(page.locator('[data-screen="game.table"]')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cj.settings') ?? '{}')['table.seatCount']);
  expect(saved ?? 4).toBe(4);
});

test('going back closes an open dialog, not the screen behind it', async ({ page }) => {
  await openHub(page, { fresh: true });
  const el = await openOption(page, 'Basic Setup', 'settings.setup');
  await el.locator('.value-btn').first().click();
  await expect(page.locator('.dialog-overlay')).toBeVisible();

  await page.goBack();
  await expect(page.locator('.dialog-overlay')).toHaveCount(0);
  // The screen is still there and still works.
  await expect(el).toBeVisible();
  await el.locator('.value-btn').first().click();
  await expect(page.locator('.dialog-overlay')).toBeVisible();
});

test('a slider value can be typed into its number box', async ({ page }) => {
  await openHub(page, { fresh: true });
  const el = await openOption(page, 'Speed/Mechanics', 'settings.mechanics');
  const box = el.getByRole('spinbutton', { name: 'Dealer Speed' });
  const range = el.locator('.slider').filter({ hasText: 'Dealer Speed' }).locator('input[type="range"]');
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('cj.settings'))['mechanics.dealerSpeed']);

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

  // The box is vertically centred: its text box and the input share a midline.
  const metrics = await box.evaluate(input => {
    const style = getComputedStyle(input);
    return { height: input.getBoundingClientRect().height, lineHeight: style.lineHeight, paddingTop: style.paddingTop };
  });
  expect(metrics.height).toBe(32);
  expect(metrics.paddingTop).toBe('0px');
});
