// Bugs found on the settings and strategy screens.
import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { Betting } from '@/screens/strategy/betting';
import { PlayingStrategy } from '@/screens/strategy/playing-strategy';
import { StrategyTables } from '@/screens/strategy/tables';
import { TrueCount } from '@/screens/strategy/true-count';
import { createTestApp, renderScreen } from '../../support/render';

/** Answers the open number prompt. */
async function answer(user: UserEvent, text: string) {
  const dialog = within(await screen.findByRole('alertdialog'));
  await user.clear(dialog.getByRole('spinbutton'));
  await user.type(dialog.getByRole('spinbutton'), text);
  await user.click(dialog.getByRole('button', { name: 'OK' }));
}

/** The screen's settings groups. */
const groups = (container: HTMLElement) =>
  // eslint-disable-next-line testing-library/no-node-access -- groups have no role
  [...container.querySelectorAll<HTMLElement>('[data-slot="settings-group"]')];

describe('Playing Strategy', () => {
  it('a rule ticked here applies the rules it implies', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<PlayingStrategy />);
    await user.click(screen.getByRole('switch', { name: 'No hole card' }));
    expect(app.settings.get('rules.dealerPeeksTen')).toBe(false);
    expect(app.settings.get('rules.dealerPeeksAce')).toBe(false);
    await user.click(screen.getByRole('switch', { name: 'Double any number of cards' }));
    expect(app.settings.get('rules.doubleOnThreeCards')).toBe(true);
  });

  it('the Index Range cannot be turned the wrong way round', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<PlayingStrategy />);
    await user.click(screen.getByRole('button', { name: 'Index range maximum: 99' }));
    await answer(user, '-4');
    expect(app.settings.get('strategy.indexRangeMax')).toBe(-4);
    await user.click(screen.getByRole('button', { name: 'Index range minimum: -99' }));
    await answer(user, '50');
    expect(app.settings.get('strategy.indexRangeMin')).toBe(-4);
    expect(await screen.findByRole('button', { name: 'Index range minimum: -4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Index range maximum: -4' })).toBeInTheDocument();
  });
});

describe('strategy tables', () => {
  it('tapping a dealer-total column of an extended strategy keeps the picked indices', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('strategy.system', 92);
    renderScreen(<StrategyTables params={{ mode: 'editMask', maskKey: 'strategy.customIndexMask' }} />, { app });
    const grid = screen.getByRole('table', { name: 'Hard Hit/Stand' });
    /** A grid cell; the first cell of each body row is its label. */
    const cell = (row: number, column: number) =>
      within(within(grid).getAllByRole('row').slice(1)[row]).getAllByRole('cell')[column + 1];
    expect(screen.getByText('0 of 100 cells selected')).toBeInTheDocument();
    await user.click(cell(0, 9));
    expect(screen.getByText('1 of 100 cells selected')).toBeInTheDocument();
    // The extra columns hold dealer totals, which have no index to pick.
    await user.click(cell(0, 13));
    expect(screen.getByText('1 of 100 cells selected')).toBeInTheDocument();
    const grids = app.settings.get('strategy.customIndexMask');
    expect(grids.hardStand[0]).toHaveLength(10);
    expect(grids.hardStand[0][9]).toBe(true);
  });
});

describe('grouping', () => {
  it('the TC Calcs rows sit in one inset group', () => {
    const { container } = renderScreen(<TrueCount />);
    const all = groups(container);
    expect(all).toHaveLength(1);
    expect(within(all[0]).getAllByRole('combobox')).toHaveLength(4);
    expect(within(all[0]).getByRole('button', { name: /^Allowed estimation error: / })).toBeInTheDocument();
  });

  it('the Allowed Bets rows sit in one inset group', () => {
    const { container } = renderScreen(<Betting />);
    // The bet rows, then Wonging's own group below the table.
    const all = groups(container);
    expect(all).toHaveLength(2);
    const rows = within(all[0]);
    expect(rows.getByRole('switch', { name: 'Warning on Betting Error' })).toBeInTheDocument();
    expect(rows.getByRole('combobox', { name: 'Chip Value' })).toBeInTheDocument();
    expect(rows.getByRole('button', { name: /^Number of bets: / })).toBeInTheDocument();
    expect(rows.getByRole('button', { name: /^Minimum bet count: / })).toBeInTheDocument();
    expect(within(all[1]).getByRole('switch', { name: 'Wonging' })).toBeInTheDocument();
  });
});

describe('Allowed Bets', () => {
  it('saves the bet ramp it brought back into range', () => {
    const backend = new MemoryBackend();
    const app = createServices({ backend });
    app.settings.set('betting.ramp', { minCount: 1.5, rows: [{ chips: 999, hands: 9 }] });
    renderScreen(<Betting />, { app });
    const saved = JSON.parse(backend.getItem('cj.settings') ?? '{}').state.values['betting.ramp'];
    expect(saved).toEqual({ minCount: 2, rows: [{ chips: 33, hands: 6 }] });
  });
});
