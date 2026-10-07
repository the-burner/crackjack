// Every registered screen: that it renders and that opening it logs nothing,
// plus the behaviour of the screens the other specs only pass through.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SettingKey } from '../../src/settings/schema.ts';

test.use({ serviceWorkers: 'block' });

/** Collects anything the page reports as an error, for expectNoErrors(). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

const expectNoErrors = (errors: string[]) => expect(errors).toEqual([]);

/** Opens the app on a clean install, leaving later reloads to keep what was saved. */
async function openApp(page: Page) {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
}

/** The visible copy of a screen; screens below it stay in the DOM, hidden. */
const showing = (page: Page, name: string) => page.locator(`[data-screen="${name}"]:not([hidden])`);

/**
 * The screens that can be opened on their own, each with its title and a
 * control that proves its body was built. The rest need a live session or a
 * caller's callback, so they are driven through the UI below or in game.spec.js
 * and drills.spec.js.
 */
/** The router keeps its factories to itself. */
const registeredScreens = () => [
  ...(window.app.router as unknown as { factories: Map<string, unknown> }).factories.keys(),
];

const SCREENS = [
  { name: 'settings', title: 'Options', control: '.settings-hub' },
  { name: 'settings.setup', title: 'Basic Setup', control: 'select[name="table.decks"]' },
  { name: 'settings.commonRules', title: 'Common Rules', control: 'select[name="rules.surrender"]' },
  { name: 'settings.ruleVariations', title: 'Rule Variations', control: '.settings-group' },
  { name: 'settings.playVariations', title: 'Play Variations', control: '.settings-group' },
  { name: 'settings.bonuses', title: 'Bonuses', control: '.settings-group' },
  { name: 'settings.unusualGames', title: 'Unusual Games', control: 'select[name="bonuses.game"]' },
  { name: 'settings.mechanics', title: 'Speed/Ops', control: '.slider' },
  { name: 'settings.dealerErrors', title: 'Errs/Biases', control: 'select[name="dealerErrors.dealingBias"]' },
  { name: 'settings.peeking', title: 'Peeking', control: '.peeking-modes' },
  { name: 'settings.appearance', title: 'Appearance', control: 'select[name="display.theme"]' },
  { name: 'settings.strategy', title: 'Strategies', control: 'select' },
  { name: 'settings.trueCount', title: 'TC Calcs', control: '.tc-row' },
  { name: 'settings.betting', title: 'Allowed Bets', control: '.bet-table' },
  { name: 'settings.betting.select', title: 'Allowed Bets', control: '.bet-pad' },
  { name: 'strategy.tables', title: 'Tables', control: '.tables__grid' },
  { name: 'drills.flash.options', title: 'Flash Options', control: '[data-action="launch"]' },
  { name: 'drills.depth.options', title: 'Depth Options', control: '[data-action="launch"]' },
  { name: 'drills.count.options', title: 'Count Options', control: '[data-action="launch"]' },
  { name: 'drills.full.options', title: 'Full Table Options', control: '[data-action="launch"]' },
  { name: 'drills.flash.errors', title: 'Error History', control: '.note' },
  { name: 'game.betSelect', title: 'Allowed Bets', control: '.bet-select__chips' },
];

const DRIVEN_ELSEWHERE = [
  'home',
  'help',
  'game.table',
  'game.stats',
  'drills.flash',
  'drills.depth',
  'drills.count',
  'drills.full',
];

test('every registered screen is either opened here or driven through the UI', async ({ page }) => {
  await openApp(page);
  const registered = await page.evaluate(registeredScreens);
  expect(registered.sort()).toEqual([...SCREENS.map(s => s.name), ...DRIVEN_ELSEWHERE].sort());
});

for (const { name, title, control } of SCREENS) {
  test(`the ${name} screen renders without logging an error`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    await page.evaluate(screen => window.app.open(screen), name);

    const el = showing(page, name);
    await expect(el.locator('.topbar__title')).toHaveText(title);
    await expect(el.locator(control).first()).toBeVisible();
    expectNoErrors(errors);
  });
}

test('every screen with a Help button has help text behind it', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const topics = await page.evaluate(async () => {
    const help = '/src/data/help.ts';
    const { HELP }: typeof import('../../src/data/help.ts') = await import(help);
    return Object.keys(HELP);
  });
  expect(topics.length).toBeGreaterThan(20);

  for (const topic of topics) {
    await page.evaluate(t => window.app.help(t, 'Help'), topic);
    const el = showing(page, 'help');
    await expect(el.locator('.screen__body')).not.toContainText('No help is available');
    await expect(el.locator('h2, h3, p').first()).toBeVisible();
  }
  expectNoErrors(errors);
});

test('every screen a Help button names is a screen the app registers', async ({ page }) => {
  await openApp(page);
  const topics = await page.evaluate(async () => {
    const help = '/src/data/help.ts';
    const { HELP }: typeof import('../../src/data/help.ts') = await import(help);
    return Object.keys(HELP);
  });
  const registered = await page.evaluate(registeredScreens);
  expect(topics.filter(topic => !registered.includes(topic))).toEqual([]);
});

/** Opens one screen from the settings hub, the way the user does. */
async function openFromHub(page: Page, button: string, screen: string) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('[data-screen="settings"]').getByRole('button', { name: button, exact: true }).click();
  const el = showing(page, screen);
  await expect(el).toBeVisible();
  return el;
}

const saved = (page: Page, key: string) =>
  page.evaluate(k => (JSON.parse(localStorage.getItem('cj.settings') ?? '{}').values ?? {})[k], key);

test('the theme dropdown switches the theme and keeps it across a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const html = page.locator('html');
  // Mocha is the shipped default.
  await expect(html).toHaveAttribute('data-theme', 'mocha');

  const el = await openFromHub(page, 'Appearance & Customization', 'settings.appearance');
  const theme = el.locator('select[name="display.theme"]');
  for (const [label, name] of [
    ['Classic', 'classic'],
    ['Catppuccin Latte', 'latte'],
    ['Catppuccin Mocha', 'mocha'],
    ['Classic', 'classic'],
  ]) {
    await theme.selectOption({ label });
    await expect(html).toHaveAttribute('data-theme', name);
    expect(await saved(page, 'display.theme')).toBe(name);
  }

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'classic');
  expectNoErrors(errors);
});

test('the two peek modes exclude each other and survive a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  let el = await openFromHub(page, 'Peeking', 'settings.peeking');
  const holeCard = el.getByRole('checkbox', { name: 'Peek at dealer down card' });
  const whenDealerPeeks = el.getByRole('checkbox', { name: 'Peek when dealer peeks' });
  // Peeking is off until one of the modes is chosen.
  await expect(holeCard).not.toBeChecked();
  await expect(whenDealerPeeks).not.toBeChecked();

  await holeCard.check();
  expect(await saved(page, 'peeking.mode')).toBe('holeCard');

  // Choosing the other mode clears the first; they are one setting.
  await whenDealerPeeks.check();
  await expect(holeCard).not.toBeChecked();
  expect(await saved(page, 'peeking.mode')).toBe('whenDealerPeeks');

  await page.reload();
  el = await openFromHub(page, 'Peeking', 'settings.peeking');
  await expect(el.getByRole('checkbox', { name: 'Peek when dealer peeks' })).toBeChecked();
  await expect(el.getByRole('checkbox', { name: 'Peek at dealer down card' })).not.toBeChecked();

  // Clearing the chosen mode turns peeking off again.
  await el.getByRole('checkbox', { name: 'Peek when dealer peeks' }).uncheck();
  expect(await saved(page, 'peeking.mode')).toBe('off');
  expectNoErrors(errors);
});

test('choosing an unusual game applies its rules and leaving it puts them back', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const setting = (key: SettingKey) => page.evaluate(k => window.app.settings.get(k), key);
  const el = await openFromHub(page, 'Unusual Games', 'settings.unusualGames');
  const game = el.locator('select[name="bonuses.game"]');
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(false);
  expect(await setting('rules.blackjackPayout')).toBe('3:2');

  await game.selectOption({ label: 'Spanish 21' });
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(true);
  expect(await setting('rules.doubleDownRescue')).toBe(true);

  // Blackjack Switch has its own bundle, so the Spanish 21 rules go back to
  // their defaults as its own are applied.
  await game.selectOption({ label: 'Blackjack Switch' });
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(false);
  expect(await setting('rules.dealerBlackjackWinsAll')).toBe(true);
  expect(await setting('rules.blackjackPayout')).toBe('1:1');

  // A side bet that does not change the rules leaves the bundle behind entirely.
  await game.selectOption({ label: 'Lucky Ladies' });
  expect(await setting('rules.dealerBlackjackWinsAll')).toBe(false);
  expect(await setting('rules.blackjackPayout')).toBe('3:2');
  expectNoErrors(errors);
});

test('the True Count screen shows a row for every calculation it sets', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');
  await expect(el.locator('.tc-row .label')).toHaveText([
    'True Count Resolution:',
    'Last Deck Resolution:',
    'True Count Division:',
    'Remaining Cards:',
    'Allowed estimation error:',
  ]);
  await expect(el.getByRole('checkbox', { name: 'Ace side count' })).toBeVisible();
  await expect(el.getByRole('checkbox', { name: 'Ten side count' })).toBeVisible();
  expectNoErrors(errors);
});

test('the Betting screen shows the bet ramp as a table', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
  // The default ramp: six bets, the first of them one chip at a count of 0 or less.
  await expect(el.locator('.bet-table tbody tr')).toHaveCount(6);
  await expect(el.locator('.bet-table tbody tr').first().locator('td')).toHaveText(['<=0', '1']);
  expectNoErrors(errors);
});

test('the game table and the screens it opens log nothing while a round is played', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      'cj.settings',
      JSON.stringify({
        'mechanics.dealerSpeed': 99,
        'mechanics.otherPlayerSpeed': 99,
        'mechanics.payoffSpeed': 99,
        'bonuses.game': 8,
      }),
    );
  });
  await page.goto('/index.html');
  await page.locator('[data-action="play"]').click();
  const overlay = page.locator('.bet-overlay');
  await expect(overlay).toBeVisible();

  // The side-bet picker and the statistics screen are both reached from here.
  await overlay.locator('[data-action="side-bet"]').click();
  await expect(showing(page, 'game.betSelect').locator('.bet-select__chips')).toBeVisible();
  await page.locator('[data-screen="game.betSelect"] [data-action="back"]').click();

  await page.locator('[data-action="stats"]').click();
  await expect(showing(page, 'game.stats').locator('.stats-table')).toBeVisible();
  await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
  await expect(overlay).toBeVisible();
  expectNoErrors(errors);
});
