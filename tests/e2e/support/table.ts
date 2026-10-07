import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** The table's elements, as the specs find them. */
export const tableScreen = (page: Page): Locator => page.locator('[data-screen="game.table"]');
export const felt = (page: Page): Locator => page.getByTestId('felt');
export const tableCanvas = (page: Page): Locator => page.getByTestId('table-canvas');
export const bankroll = (page: Page): Locator => page.getByTestId('bankroll');
export const readout = (page: Page): Locator => page.getByTestId('counts');
export const seatChip = (page: Page, seat: number): Locator =>
  page.locator(`[data-testid="seat-chip"][data-seat="${seat}"]`);
export const results = (page: Page): Locator => page.getByTestId('seat-result');
/** The betting overlay. */
export const betOverlay = (page: Page): Locator => page.getByRole('region', { name: 'Bets' });
export const betGrid = (page: Page): Locator => page.getByTestId('bet-grid');
export const betTitle = (page: Page): Locator => betOverlay(page).getByRole('heading');
export const overlayButton = (page: Page, name: string): Locator =>
  betOverlay(page).getByRole('button', { name, exact: true });
/** A button on the bar above the felt: Back, Stats, Error or Help. */
export const barButton = (page: Page, name: string): Locator =>
  tableScreen(page).getByRole('button', { name, exact: true });

const PLAY_LABELS: Record<string, string> = {
  hit: 'Hit',
  stand: 'Stand',
  double: 'Double',
  split: 'Split',
  surrender: 'Surrender',
  insure: 'Insure',
  pass: 'Pass',
};
/** A play button by its action name ('hit', 'stand', ..., 'insure', 'pass'). */
export const playButton = (page: Page, action: string): Locator =>
  page.getByTestId('table-actions').getByRole('button', { name: PLAY_LABELS[action], exact: true });

/** In-page selectors, for the specs' recorders and evaluate() calls. */
export const SELECTOR = {
  felt: '[data-testid="felt"]',
  overlay: '[data-slot="bet-overlay"]',
  actions: '[data-testid="table-actions"] [data-action]',
  chip: '[data-testid="seat-chip"]',
  result: '[data-testid="seat-result"]',
  bankroll: '[data-testid="bankroll"]',
  counts: '[data-testid="counts"]',
  toast: '[data-sonner-toast]',
} as const;

/** The table's pop-up showing (the newest, not one on its way out), of a tone if given. */
export const tableToast = (page: Page, tone?: 'plain' | 'good' | 'error'): Locator => {
  const type = tone && { plain: 'default', good: 'success', error: 'error' }[tone];
  return page.locator(
    `${SELECTOR.toast}[data-front="true"]:not([data-removed="true"])${type ? `[data-type="${type}"]` : ''}`,
  );
};

/** The open dialog (a confirmation or a message). */
export const dialog = (page: Page): Locator => page.getByRole('alertdialog');

/** Taps a tile of the bet grid (0 is the smallest bet) and waits for the deal to start. */
export async function tapBetTile(page: Page, index = 0): Promise<void> {
  const grid = betGrid(page);
  const box = await grid.boundingBox();
  await grid.click({ position: { x: 25 + (index * (box?.width ?? 0)) / 6, y: 25 } });
  await expect(betOverlay(page)).toBeHidden();
}

const statsScreen = (page: Page): Locator => page.locator('[data-screen="game.stats"]');

/** The value in the statistics row labelled `label`. */
export const statValue = (page: Page, label: string): Locator =>
  statsScreen(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');

/** Opens the Statistics screen from the table. */
export async function openStats(page: Page): Promise<Locator> {
  await barButton(page, 'Stats').click();
  await expect(statsScreen(page)).toBeVisible();
  return statsScreen(page);
}

/** Goes back from the Statistics screen to the table. */
export async function closeStats(page: Page): Promise<void> {
  await statsScreen(page).getByRole('button', { name: 'Back', exact: true }).click();
  await expect(tableScreen(page)).toBeVisible();
}

/** The running count the Statistics screen reports: the session's own. */
export async function statsRunningCount(page: Page): Promise<string> {
  await openStats(page);
  const value = ((await statValue(page, 'Running Count').textContent()) ?? '').trim();
  await closeStats(page);
  return value;
}

/** The running count the table's readout shows. */
export const readoutRunningCount = async (page: Page): Promise<string | undefined> =>
  ((await readout(page).textContent()) ?? '').match(/RC: (-?[\d.]+)/)?.[1];
