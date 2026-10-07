import { describe, it, expect } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Betting, BetSelect } from '@/screens/strategy/betting';
import { StrategyTables } from '@/screens/strategy/tables';
import { TrueCount } from '@/screens/strategy/true-count';
import { PlayingStrategy } from '@/screens/strategy/playing-strategy';
import { createTestApp, renderScreen } from '../../support/render';

/** The body rows of the first table on the screen (its first row is the header). */
const bodyRows = () => within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1);

/** A strategy grid cell; the first cell of each row is its label. */
const cell = (row: number, column: number) => within(bodyRows()[row]).getAllByRole('cell')[column + 1];

describe('Allowed Bets', () => {
  it('shows counts and the minimum count row only when betting errors are flagged', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting />);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('<=0');
    expect(screen.getByText('Minimum bet count:')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Warning on Betting Error' }));
    expect(app.settings.get('betting.warnOnError')).toBe(false);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('-');
    expect(screen.getByText('Minimum bet count:')).not.toBeVisible();
  });

  it('follows ramp changes and opens the picker for a row', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting />);
    expect(bodyRows()).toHaveLength(6);
    act(() => app.settings.set('betting.ramp', { minCount: 0, rows: [{ chips: 3, hands: 2 }] }));
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getAllByRole('cell')[1]).toHaveTextContent('2x3');
    await user.click(bodyRows()[0]);
    expect(app.open).toHaveBeenCalledWith('settings.betting.select', { row: 0 });
  });

  it('writes the chip value', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chip Value:' }), '$100');
    expect(app.settings.get('betting.chipValue')).toBe(100);
  });
});

describe('bet picker', () => {
  it('limits chips to the hands chosen and writes the row', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<BetSelect params={{ row: 1 }} />);
    const spots = within(screen.getByRole('group', { name: 'Spots' }));
    const chips = within(screen.getByRole('group', { name: 'Chips' }));
    expect(spots.getByRole('button', { name: '1' })).toHaveClass('is-on');
    await user.click(spots.getByRole('button', { name: '3x' }));
    expect(spots.getByRole('button', { name: '3x' })).toHaveClass('is-on');
    expect(spots.getByRole('button', { name: '1' })).not.toHaveClass('is-on');
    expect(chips.getByRole('button', { name: '200' })).toBeDisabled();
    expect(chips.getByRole('button', { name: '25' })).toBeEnabled();
    await user.click(chips.getByRole('button', { name: '25' }));
    expect(app.settings.get('betting.ramp').rows[1]).toEqual({ chips: 25, hands: 3 });
    expect(app.back).toHaveBeenCalled();
  });
});

describe('strategy tables', () => {
  it('toggles mask cells and counts them', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<StrategyTables params={{ mode: 'editMask', maskKey: 'strategy.customIndexMask' }} />);
    expect(screen.getByText('0 of 80 cells selected')).toBeInTheDocument();
    expect(screen.getAllByRole('table')[0]).toHaveClass('tables__grid--editable');
    await user.click(cell(1, 8));
    expect(screen.getByText('1 of 80 cells selected')).toBeInTheDocument();
    expect(app.settings.get('strategy.customIndexMask').hardStand[1][8]).toBe(true);
    await user.click(cell(1, 8));
    expect(app.settings.get('strategy.customIndexMask').hardStand[1][8]).toBe(false);
  });

  it('ignores taps outside mask editing', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<StrategyTables params={{}} />);
    const before = app.settings.get('strategy.customIndexMask');
    await user.click(cell(1, 8));
    expect(app.settings.get('strategy.customIndexMask')).toEqual(before);
    expect(screen.queryByText(/cells selected/)).not.toBeInTheDocument();
  });

  it('opens a named view with a marked cell', () => {
    const { container } = renderScreen(
      <StrategyTables params={{ view: 'split', highlight: { row: 2, column: 3 }, title: 'Last Error' }} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Last Error');
    expect(bodyRows()).toHaveLength(10);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the mark is colour only
    expect(container.querySelectorAll('.grid__cell--marked')).toHaveLength(1);
    expect(cell(2, 3)).toHaveClass('grid__cell--marked');
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the legend is colour boxes with no role
    expect([...container.querySelectorAll('.tables__legend-box')].map(b => b.textContent)).toEqual([
      'Split',
      'No Split',
      'Split >= Value',
      'Split < Value',
    ]);
  });

  it('shades error counts and hides the legend', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.errorTallies.record('hardStand', 1, 8);
    renderScreen(<StrategyTables params={{}} />, { app });
    expect(screen.getByText('Hit < Value')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Shade error counts' }));
    expect(cell(1, 8)).toHaveTextContent(/^1$/);
    expect(cell(1, 7)).toBeEmptyDOMElement();
    expect(screen.getByText('Hit < Value')).not.toBeVisible();
  });

  it('switches to the counts view', async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(<StrategyTables params={{}} />);
    await user.selectOptions(screen.getByDisplayValue('Hard Hit/Stand'), 'Insurance/Counts');
    expect(screen.getByText('Card Point Values')).toBeInTheDocument();
    expect(screen.queryByText('Specialty Plays')).not.toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the strategy grid has no accessible name
    expect(container.querySelector('.tables__grid')).not.toBeInTheDocument();
  });
});

describe('TC Calcs', () => {
  it('writes the selects and side counts', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<TrueCount />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'True Count Resolution:' }), 'Quarter Deck');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Remaining Cards:' }), 'Cards dealt');
    await user.click(screen.getByRole('checkbox', { name: 'Ten side count' }));
    expect(app.settings.get('trueCount.resolution')).toBe('quarter');
    expect(app.settings.get('trueCount.remainingCards')).toBe('dealt');
    expect(app.settings.get('trueCount.tenSideCount')).toBe(true);
  });
});

describe('Playing Strategy', () => {
  it('writes rules through their constraints and shows changes made elsewhere', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('rules.dealerPeeksAce', true);
    renderScreen(<PlayingStrategy />, { app });
    await user.click(screen.getByRole('checkbox', { name: 'No hole card' }));
    expect(app.settings.get('rules.noHoleCard')).toBe(true);
    expect(app.settings.get('rules.dealerPeeksAce')).toBe(false);
    act(() => app.settings.set('strategy.indexRangeMin', -4));
    expect(screen.getByRole('button', { name: '-4' })).toBeInTheDocument();
  });
});
