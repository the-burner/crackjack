// Every registered screen: that it renders and that opening it logs nothing,
// plus the behaviour of the screens the other specs only pass through.

import { test, expect } from '@playwright/test';
import { barButton, betOverlay, overlayButton } from './support/table';
import type { Page } from '@playwright/test';
import type { SettingKey } from '@/settings/schema';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

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
/** Every screen: those with a URL of their own, and those under another screen's. */
const ALL_SCREENS = [...Object.keys(PATHS), 'settings.betting.select', 'game.betSelect', 'game.stats', 'help'];

/** The URL that opens a screen directly. */
const urlOf = (name: string) =>
  name === 'settings.betting.select' ? '/settings/betting/0' : PATHS[name as ScreenName];

const SCREENS = [
  { name: 'settings', title: 'Options', control: 'role=button[name="Basic Setup"]' },
  { name: 'settings.setup', title: 'Basic Setup', control: 'role=combobox[name="Decks"]' },
  { name: 'settings.commonRules', title: 'Common Rules', control: 'role=combobox[name="Surrender"]' },
  { name: 'settings.ruleVariations', title: 'Rule Variations', control: 'role=switch[name="Triple Down"]' },
  { name: 'settings.playVariations', title: 'Play Variations', control: 'role=switch[name="Dealer wins ties"]' },
  { name: 'settings.bonuses', title: 'Bonuses', control: 'role=switch[name="Blackjack pays 6:5"]' },
  { name: 'settings.unusualGames', title: 'Unusual Games', control: 'role=combobox[name="Game"]' },
  { name: 'settings.mechanics', title: 'Speed/Ops', control: 'role=slider' },
  { name: 'settings.dealerErrors', title: 'Errs/Biases', control: 'role=combobox[name="Dealing bias"]' },
  { name: 'settings.peeking', title: 'Peeking', control: 'role=switch[name="Peek when dealer peeks"]' },
  { name: 'settings.appearance', title: 'Appearance', control: 'role=combobox[name="Theme"]' },
  { name: 'settings.strategy', title: 'Strategies', control: 'role=combobox[name="Strategy"]' },
  { name: 'settings.trueCount', title: 'TC Calcs', control: 'role=combobox[name="True Count Resolution"]' },
  { name: 'settings.betting', title: 'Allowed Bets', control: 'role=table[name="Bets"]' },
  { name: 'settings.betting.select', title: 'Allowed Bets', control: 'role=group[name="Chips"]' },
  { name: 'strategy.tables', title: 'Tables', control: 'role=table[name="Hard Hit/Stand"]' },
  { name: 'drills.flash.options', title: 'Flash Options', control: '[data-action="launch"]' },
  { name: 'drills.depth.options', title: 'Depth Options', control: '[data-action="launch"]' },
  { name: 'drills.count.options', title: 'Count Options', control: '[data-action="launch"]' },
  { name: 'drills.full.options', title: 'Full Table Options', control: '[data-action="launch"]' },
  { name: 'drills.flash.errors', title: 'Error History', control: 'main p' },
];

const DRIVEN_ELSEWHERE = [
  'home',
  'help',
  'game.table',
  'game.stats',
  'game.betSelect',
  'drills.flash',
  'drills.depth',
  'drills.count',
  'drills.full',
];

test('every screen is either opened here or driven through the UI', () => {
  expect([...ALL_SCREENS].sort()).toEqual([...SCREENS.map(s => s.name), ...DRIVEN_ELSEWHERE].sort());
});

for (const { name, title, control } of SCREENS) {
  test(`the ${name} screen renders without logging an error`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page);
    // Its URL, as a bookmark or a reload would open it.
    await page.goto(`/index.html#${urlOf(name)}`);

    const el = showing(page, name);
    await expect(el.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(el.locator(control).first()).toBeVisible();
    expectNoErrors(errors);
  });
}

test('every screen with a Help button has help text behind it', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const topics = await page.evaluate(async () => {
    const help = '/src/data/help.ts';
    const { HELP }: typeof import('@/data/help') = await import(help);
    return Object.keys(HELP);
  });
  expect(topics.length).toBeGreaterThan(20);

  for (const topic of topics) {
    await page.evaluate(async t => {
      const url = '/src/app/help.ts';
      const { openHelp }: typeof import('@/app/help') = await import(url);
      openHelp(t, 'Help');
    }, topic);
    const help = page.locator('[data-screen="help"]');
    await expect(help).not.toContainText('No help is available');
    await expect(help.locator('h2, h3, p').first()).toBeVisible();
  }
  expectNoErrors(errors);
});

test('every screen a Help button names is a screen the app registers', async ({ page }) => {
  await openApp(page);
  const topics = await page.evaluate(async () => {
    const help = '/src/data/help.ts';
    const { HELP }: typeof import('@/data/help') = await import(help);
    return Object.keys(HELP);
  });
  expect(topics.filter(topic => !ALL_SCREENS.includes(topic))).toEqual([]);
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
  page.evaluate(k => (JSON.parse(localStorage.getItem('cj.settings') ?? '{}').state?.values ?? {})[k], key);

test('the theme dropdown switches the theme and keeps it across a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const html = page.locator('html');
  // Mocha is the shipped default.
  await expect(html).toHaveAttribute('data-theme', 'mocha');

  const el = await openFromHub(page, 'Appearance & Customization', 'settings.appearance');
  const theme = el.getByRole('combobox', { name: 'Theme' });
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
  const holeCard = el.getByRole('switch', { name: 'Peek at dealer down card' });
  const whenDealerPeeks = el.getByRole('switch', { name: 'Peek when dealer peeks' });
  // Peeking is off until one of the modes is chosen.
  await expect(holeCard).not.toBeChecked();
  await expect(whenDealerPeeks).not.toBeChecked();

  await holeCard.check();
  expect(await saved(page, 'peeking.mode')).toBe('holeCard');

  // Choosing the other mode clears the first; they are one setting.
  await whenDealerPeeks.check();
  await expect(holeCard).not.toBeChecked();
  expect(await saved(page, 'peeking.mode')).toBe('whenDealerPeeks');

  // The URL keeps the screen across the reload.
  await page.reload();
  el = showing(page, 'settings.peeking');
  await expect(el.getByRole('switch', { name: 'Peek when dealer peeks' })).toBeChecked();
  await expect(el.getByRole('switch', { name: 'Peek at dealer down card' })).not.toBeChecked();

  // Clearing the chosen mode turns peeking off again.
  await el.getByRole('switch', { name: 'Peek when dealer peeks' }).uncheck();
  expect(await saved(page, 'peeking.mode')).toBe('off');
  expectNoErrors(errors);
});

test('choosing an unusual game applies its rules and leaving it puts them back', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const setting = (key: SettingKey) => page.evaluate(k => window.app.settings.get(k), key);
  const el = await openFromHub(page, 'Unusual Games', 'settings.unusualGames');
  const game = el.getByRole('combobox', { name: 'Game' });
  const choose = (label: string) => game.selectOption({ label });
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(false);
  expect(await setting('rules.blackjackPayout')).toBe('3:2');

  await choose('Spanish 21');
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(true);
  expect(await setting('rules.doubleDownRescue')).toBe(true);

  // Blackjack Switch has its own bundle, so the Spanish 21 rules go back to
  // their defaults as its own are applied.
  await choose('Blackjack Switch');
  expect(await setting('rules.playerBlackjackAlwaysWins')).toBe(false);
  expect(await setting('rules.dealerBlackjackWinsAll')).toBe(true);
  expect(await setting('rules.blackjackPayout')).toBe('1:1');

  // A side bet that does not change the rules leaves the bundle behind entirely.
  await choose('Lucky Ladies');
  expect(await setting('rules.dealerBlackjackWinsAll')).toBe(false);
  expect(await setting('rules.blackjackPayout')).toBe('3:2');
  expectNoErrors(errors);
});

test('the True Count screen shows a row for every calculation it sets', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const el = await openFromHub(page, 'True Count Calcs', 'settings.trueCount');
  for (const name of ['True Count Resolution', 'Last Deck Resolution', 'True Count Division', 'Remaining Cards']) {
    await expect(el.getByRole('combobox', { name, exact: true })).toBeVisible();
  }
  await expect(el.getByRole('button', { name: /^Allowed estimation error: / })).toBeVisible();
  await expect(el.getByRole('switch', { name: 'Ace side count' })).toBeVisible();
  await expect(el.getByRole('switch', { name: 'Ten side count' })).toBeVisible();
  expectNoErrors(errors);
});

test('the Betting screen shows the bet ramp as a table', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  const el = await openFromHub(page, 'Betting Strategies', 'settings.betting');
  // The default ramp: six bets, the first of them one chip at a count of 0 or less.
  const rows = el.getByRole('table', { name: 'Bets' }).locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first().getByRole('cell')).toHaveText(['<=0', '1']);
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
  const overlay = betOverlay(page);
  await expect(overlay).toBeVisible();

  // The side-bet picker and the statistics screen are both reached from here.
  await overlayButton(page, 'Side Bet').click();
  await expect(showing(page, 'game.betSelect').getByRole('group', { name: 'Chips' })).toBeVisible();
  await page.locator('[data-screen="game.betSelect"] [data-action="back"]').click();

  await barButton(page, 'Stats').click();
  await expect(showing(page, 'game.stats').getByRole('table')).toBeVisible();
  await page.locator('[data-screen="game.stats"] [data-action="back"]').click();
  await expect(overlay).toBeVisible();
  expectNoErrors(errors);
});
