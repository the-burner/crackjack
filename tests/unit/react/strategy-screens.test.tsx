import { describe, it, expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { Betting, BetSelect } from '@/screens/strategy/betting';
import { bettingPresets, bettingValues } from '@/settings/betting-strategies';
import { StrategyTables } from '@/screens/strategy/tables';
import { TrueCount } from '@/screens/strategy/true-count';
import { PlayingStrategy } from '@/screens/strategy/playing-strategy';
import { createTestApp, renderScreen } from '../../support/render';

/** Opens a select and picks one of its options. */
async function choose(user: UserEvent, name: string, option: string) {
  const select = screen.getByRole('combobox', { name });
  await user.selectOptions(select, within(select).getByRole('option', { name: option }));
}

/** Answers the open number prompt. */
async function answer(user: UserEvent, text: string) {
  const dialog = within(await screen.findByRole('alertdialog'));
  await user.clear(dialog.getByRole('spinbutton'));
  await user.type(dialog.getByRole('spinbutton'), text);
  await user.click(dialog.getByRole('button', { name: 'OK' }));
}

/** The body rows of the first table on the screen (its first row is the header). */
const bodyRows = () => within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1);

/** A strategy grid cell; the first cell of each row is its label. */
const cell = (row: number, column: number) => within(bodyRows()[row]).getAllByRole('cell')[column + 1];

describe('Allowed Bets', () => {
  it('shows counts and the minimum count row only when betting errors are flagged', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="game" />);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('<=0');
    expect(screen.getByRole('button', { name: 'Minimum bet count: 0' })).toBeVisible();
    await user.click(screen.getByRole('switch', { name: 'Warning on Betting Error' }));
    expect(app.settings.get('game.betting.warnOnError')).toBe(false);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('-');
    expect(screen.getByRole('button', { name: 'Minimum bet count: 0', hidden: true })).not.toBeVisible();
  });

  it('shows the wonging settings below the bets only while wonging is switched on', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="game" />);
    await user.click(screen.getByRole('switch', { name: 'Wonging' }));
    expect(app.settings.get('game.betting.wonging')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Wong in: 1' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Wonging' }));
    expect(app.settings.get('game.betting.wonging')).toBe(true);
    expect(screen.getByRole('button', { name: 'Wong in: 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Wong out: -2' })).toBeVisible();
    await user.click(screen.getByRole('switch', { name: 'Begin shoe wonged out' }));
    expect(app.settings.get('game.betting.wongStartOut')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Wong out: -2' }));
    await answer(user, '-4');
    expect(app.settings.get('game.betting.wongOut')).toBe(-4);
  });

  it('saves the betting strategy under a name and loads it back', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="game" />);
    const picker = () => screen.getByRole('combobox', { name: 'Betting strategy' });
    const multi = "Crackjack's Multi-Hand Strategy";
    expect(picker()).toHaveDisplayValue(multi);
    act(() => app.settings.update({ 'game.betting.chipValue': 5, 'game.betting.wonging': false }));
    expect(picker()).toHaveDisplayValue(`${multi} (edited)`);
    await user.click(screen.getByRole('button', { name: 'Save as New…' }));
    await user.type(await screen.findByRole('textbox'), 'Spread');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(picker()).toHaveDisplayValue('Spread'));
    await choose(user, 'Betting strategy', multi);
    expect(app.settings.get('game.betting.chipValue')).toBe(25);
    expect(app.settings.get('game.betting.ramp').rows[2]).toEqual({ chips: 2, hands: 2 });
    await choose(user, 'Betting strategy', "Crackjack's Single-Hand Strategy");
    expect(app.settings.get('game.betting.ramp').rows[2]).toEqual({ chips: 4, hands: 1 });
    await choose(user, 'Betting strategy', 'Spread');
    expect(app.settings.get('game.betting.chipValue')).toBe(5);
    expect(app.settings.get('game.betting.wonging')).toBe(false);
  });

  it('follows ramp changes and opens the picker for a row', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<Betting scope="game" />, { path: '/game/betting' });
    expect(bodyRows()).toHaveLength(6);
    act(() => app.settings.set('game.betting.ramp', { minCount: 0, rows: [{ chips: 3, hands: 2 }] }));
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getAllByRole('cell')[1]).toHaveTextContent('2x3');
    // Its count only labels it: a tap there does nothing.
    await user.click(within(bodyRows()[0]).getAllByRole('cell')[0]);
    expect(location().pathname).toBe('/game/betting');
    await user.click(within(bodyRows()[0]).getAllByRole('cell')[1]);
    expect(location().pathname).toBe('/game/betting/0');
  });

  it('resizes the table from the number of bets', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="game" />);
    await user.click(screen.getByRole('button', { name: 'Number of bets: 6' }));
    await answer(user, '3');
    expect(app.settings.get('game.betting.ramp').rows).toHaveLength(3);
    expect(bodyRows()).toHaveLength(3);
  });

  it('writes the chip value', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="game" />);
    await choose(user, 'Chip Value', '$100');
    expect(app.settings.get('game.betting.chipValue')).toBe(100);
  });
});

describe('Deck Estimation’s Betting Strategy', () => {
  it('shows only the bets, with their counts, the chip value and Wong out, writing its own', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Betting scope="depth" />);
    expect(screen.queryByRole('switch', { name: 'Warning on Betting Error' })).not.toBeInTheDocument();
    await choose(user, 'Chip Value', '$100');
    expect(app.settings.get('drills.depth.betting.chipValue')).toBe(100);
    expect(app.settings.get('game.betting.chipValue')).toBe(25);
    expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('<=0');
    expect(screen.getByRole('button', { name: 'Minimum bet count: 0' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Wong out: -2' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Wong in/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Begin shoe wonged out' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wong out: -2' }));
    await answer(user, '5');
    expect(app.settings.get('drills.depth.betting.wongOut')).toBe(5);
    expect(app.settings.get('game.betting.wongOut')).toBe(-2);
    await choose(user, 'Betting strategy', "Crackjack's Single-Hand Strategy");
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.settings.get('drills.depth.betting.wonging')).toBe(false));
    expect(app.settings.get('game.betting.strategy')).toBe('multi-hand');
  });

  it('follows a saved strategy edited in the game, unless it has its own edit', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    const spread = bettingPresets('game').make(
      'spread',
      'Spread',
      bettingValues(key => app.settings.get(key)),
    );
    app.bettingStrategies.setState({ value: [spread] });
    app.settings.update({ 'game.betting.strategy': 'spread', 'drills.depth.betting.strategy': 'spread' });
    renderScreen(<Betting scope="game" />, { app });
    await user.click(screen.getByRole('button', { name: 'Wong out: -2' }));
    await answer(user, '-3');
    await user.click(screen.getByRole('button', { name: 'Save “Spread”' }));
    expect(app.settings.get('drills.depth.betting.wongOut')).toBe(-3);

    // Moved off it, Deck Estimation keeps its own.
    act(() => app.settings.set('drills.depth.betting.wongOut', 0));
    await user.click(screen.getByRole('button', { name: 'Wong out: -3' }));
    await answer(user, '-5');
    await user.click(screen.getByRole('button', { name: 'Save “Spread”' }));
    expect(app.settings.get('drills.depth.betting.wongOut')).toBe(0);
  });

  it('picks its own rows', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<BetSelect scope="depth" params={{ row: 0 }} />);
    await user.click(within(screen.getByRole('group', { name: 'Chips' })).getByRole('button', { name: '3' }));
    expect(app.settings.get('drills.depth.betting.ramp').rows[0]).toEqual({ chips: 3, hands: 1 });
    expect(app.settings.get('game.betting.ramp').rows[0]).toEqual({ chips: 1, hands: 1 });
  });
});

describe('bet picker', () => {
  it('limits chips to the hands chosen and writes the row', async () => {
    const user = userEvent.setup();
    const { app, location } = renderScreen(<BetSelect scope="game" params={{ row: 1 }} />);
    const spots = within(screen.getByRole('group', { name: 'Spots' }));
    const chips = within(screen.getByRole('group', { name: 'Chips' }));
    expect(spots.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(spots.getByRole('button', { name: '3x' }));
    expect(spots.getByRole('button', { name: '3x' })).toHaveAttribute('aria-pressed', 'true');
    expect(spots.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'false');
    // Tapping the chosen number again keeps it.
    await user.click(spots.getByRole('button', { name: '3x' }));
    expect(spots.getByRole('button', { name: '3x' })).toHaveAttribute('aria-pressed', 'true');
    expect(chips.getByRole('button', { name: '200' })).toBeDisabled();
    expect(chips.getByRole('button', { name: '25' })).toBeEnabled();
    await user.click(chips.getByRole('button', { name: '25' }));
    expect(app.settings.get('game.betting.ramp').rows[1]).toEqual({ chips: 25, hands: 3 });
    expect(location().pathname).toBe('/');
  });
});

describe('Playing Strategy Charts', () => {
  const charts = () => <StrategyTables params={{ pick: true, title: 'Playing Strategy Charts' }} />;
  /** Each cell's action (its colour) and index. */
  const tableText = () =>
    bodyRows()
      .flatMap(row => within(row).getAllByRole('cell'))
      .map(cell => `${cell.style.backgroundColor}:${cell.textContent}`)
      .join('|');

  it('builds the tables for the rules switched on, its own and not the game’s', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(charts());
    const das = screen.getByRole('switch', { name: 'Double after split' });
    expect(das).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Hit soft 17' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'No hole card' })).not.toBeChecked();
    await choose(user, 'Table', 'Split');
    const withDas = tableText();
    await user.click(das);
    expect(app.settings.get('charts.rules.doubleAfterSplit')).toBe(false);
    expect(app.settings.get('rules.doubleAfterSplit')).toBe(true);
    expect(tableText()).not.toBe(withDas);
    // The game's rules leave the Charts alone.
    const withoutDas = tableText();
    act(() => app.settings.set('rules.doubleAfterSplit', true));
    expect(tableText()).toBe(withoutDas);
  });

  it('keeps the strategy, decks, rules and table picked on it, and shows no error history', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    const { unmount } = renderScreen(charts(), { app });
    await choose(user, 'Decks', '2');
    await choose(user, 'Table', 'Split');
    await user.click(screen.getByRole('switch', { name: 'No hole card' }));
    expect(screen.queryByRole('switch', { name: 'Shade error counts' })).not.toBeInTheDocument();
    const system = within(screen.getByRole('combobox', { name: 'Strategy' })).getAllByRole('option')[1];
    await user.selectOptions(screen.getByRole('combobox', { name: 'Strategy' }), system);
    unmount();

    renderScreen(charts(), { app });
    expect(screen.getByRole('combobox', { name: 'Decks' })).toHaveDisplayValue('2');
    expect(screen.getByRole('combobox', { name: 'Table' })).toHaveDisplayValue('Split');
    expect(screen.getByRole('switch', { name: 'No hole card' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Strategy' })).toHaveDisplayValue(system.textContent!);
    expect(app.settings.get('table.decks')).toBe(6);
  });

  it('shows the index set picked on it, of those a strategy has built in', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(charts());
    const indices = screen.getByRole('combobox', { name: 'Indices' });
    expect(
      within(indices)
        .getAllByRole('option')
        .map(o => o.textContent),
    ).toEqual(['All Indices', 'Illustrious 18', 'Sweet 16', 'Catch 20', 'Crack 33', 'No Indices']);
    // 16 vs ten stands from a count of 0.
    expect(cell(1, 8)).toHaveTextContent('0');
    await choose(user, 'Indices', 'No Indices');
    expect(app.settings.get('charts.strategy.indexSet')).toBe('none');
    expect(app.settings.get('game.strategy.indexSet')).toBe('crack33');
    expect(cell(1, 8)).toHaveTextContent(/^$/);
  });

  /** The rows of one side: the Charts' own ("Strategy") or the one laid over it ("Compare with"). */
  const side = (name: 'Strategy' | 'Compare with') => within(screen.getByRole('group', { name }));
  /** Picks an option in one side's select. */
  async function pick(user: UserEvent, group: 'Strategy' | 'Compare with', select: string, option: string) {
    const element = side(group).getByRole('combobox', { name: select });
    await user.selectOptions(element, within(element).getByRole('option', { name: option }));
  }

  it('starts Compare as a copy of the first side, so only a change splits the cells', async () => {
    const user = userEvent.setup();
    const { app, container } = renderScreen(charts());
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- a split is drawn, not named
    const differing = () => container.querySelectorAll('[data-differs]').length;
    await pick(user, 'Strategy', 'Decks', '2');
    expect(side('Compare with').queryByRole('combobox', { name: 'Strategy' })).not.toBeInTheDocument();
    await user.click(side('Compare with').getByRole('switch', { name: 'Compare' }));
    expect(app.settings.get('charts.compare.on')).toBe(true);
    expect(side('Compare with').getByRole('combobox', { name: 'Decks' })).toHaveDisplayValue('2');
    expect(differing()).toBe(0);

    // The same strategy, standing on soft 17 instead: only the plays that rule changes split (High-Low's surrenders).
    await user.click(side('Compare with').getByRole('switch', { name: 'Hit soft 17' }));
    expect(app.settings.get('charts.compare.rules.dealerHitsSoft17')).toBe(false);
    expect(app.settings.get('charts.rules.dealerHitsSoft17')).toBe(true);
    await choose(user, 'Table', 'Surrender');
    expect(differing()).toBeGreaterThan(0);
    const key = within(screen.getByRole('list', { name: 'Compared strategies' }));
    expect(key.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'High-Low · Hit soft 17',
      'High-Low · Stand soft 17',
    ]);

    await user.click(side('Compare with').getByRole('switch', { name: 'Compare' }));
    expect(differing()).toBe(0);
    expect(screen.queryByRole('list', { name: 'Compared strategies' })).not.toBeInTheDocument();
  });

  it('compares two strategies, each with its own decks and indices', async () => {
    const user = userEvent.setup();
    const { container } = renderScreen(charts());
    await user.click(side('Compare with').getByRole('switch', { name: 'Compare' }));
    await pick(user, 'Compare with', 'Strategy', 'Basic Strategy');
    await pick(user, 'Compare with', 'Indices', 'No Indices');
    // 16 v X: High-Low stands from 0, Basic Strategy always hits.
    expect(cell(1, 8)).toHaveAttribute('data-differs');
    expect(cell(1, 8)).toHaveTextContent(/^0$/);
    const key = within(screen.getByRole('list', { name: 'Compared strategies' }));
    expect(key.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'High-Low · Crack 33',
      'Basic Strategy · No Indices',
    ]);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- a split is drawn, not named
    expect(container.querySelectorAll('[data-differs]').length).toBeGreaterThan(0);
  });

  it('splits the counts the two sides differ on', async () => {
    const user = userEvent.setup();
    const { app, container } = renderScreen(charts());
    act(() => app.settings.set('charts.table', 'counts'));
    await user.click(side('Compare with').getByRole('switch', { name: 'Compare' }));
    await pick(user, 'Compare with', 'Strategy', 'KO Rookie');
    // KO starts its count below zero, High-Low at it.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- a split is drawn, not named
    expect(container.querySelectorAll('[data-differs]').length).toBeGreaterThan(0);
  });

  it('offers no rule switches when showing a module’s own tables', () => {
    renderScreen(<StrategyTables params={{}} />);
    expect(screen.queryByRole('switch', { name: 'Double after split' })).not.toBeInTheDocument();
  });
});

describe('strategy tables', () => {
  it('toggles mask cells and counts them', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(
      <StrategyTables params={{ mode: 'editMask', maskKey: 'game.strategy.customIndexMask' }} />,
    );
    expect(screen.getByText('0 of 80 cells selected')).toBeInTheDocument();
    await user.click(cell(1, 8));
    expect(screen.getByText('1 of 80 cells selected')).toBeInTheDocument();
    expect(app.settings.get('game.strategy.customIndexMask').hardStand[1][8]).toBe(true);
    await user.click(cell(1, 8));
    expect(app.settings.get('game.strategy.customIndexMask').hardStand[1][8]).toBe(false);
  });

  it('ignores taps outside mask editing', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<StrategyTables params={{}} />);
    const before = app.settings.get('game.strategy.customIndexMask');
    await user.click(cell(1, 8));
    expect(app.settings.get('game.strategy.customIndexMask')).toEqual(before);
    expect(screen.queryByText(/cells selected/)).not.toBeInTheDocument();
  });

  it('opens a named view with a marked cell', () => {
    const { container } = renderScreen(
      <StrategyTables params={{ view: 'split', highlight: { row: 2, column: 3 }, title: 'Last Error' }} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Last Error');
    expect(screen.getByRole('combobox', { name: 'Table' })).toHaveTextContent('Split');
    expect(bodyRows()).toHaveLength(10);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the mark is colour only
    expect(container.querySelectorAll('[data-marked]')).toHaveLength(1);
    expect(cell(2, 3)).toHaveAttribute('data-marked');
    const legend = within(screen.getByRole('list', { name: 'Legend' }));
    expect(legend.getAllByRole('listitem').map(b => b.textContent)).toEqual([
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
    await user.click(screen.getByRole('switch', { name: 'Shade error counts' }));
    expect(cell(1, 8)).toHaveTextContent(/^1$/);
    expect(cell(1, 7)).toHaveTextContent(/^$/);
    expect(screen.getByText('Hit < Value')).not.toBeVisible();
  });

  it('switches to the counts view', async () => {
    const user = userEvent.setup();
    renderScreen(<StrategyTables params={{}} />);
    expect(screen.getByRole('table', { name: 'Hard Hit/Stand' })).toBeInTheDocument();
    await choose(user, 'Table', 'Insurance/Counts');
    expect(screen.getByRole('table', { name: 'Card Point Values' })).toBeInTheDocument();
    expect(screen.queryByText('Specialty Plays')).not.toBeInTheDocument();
    // Its own legend: the counts, and the insurance indices.
    expect(
      within(screen.getByRole('list', { name: 'Legend' }))
        .getAllByRole('listitem')
        .map(i => i.textContent),
    ).toEqual(['Count Value', 'Take Insurance >= Value']);
    expect(screen.queryByRole('table', { name: 'Hard Hit/Stand' })).not.toBeInTheDocument();
  });
});

describe('TC Calcs', () => {
  it('writes the selects and side counts', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<TrueCount scope="game" />);
    await choose(user, 'True Count Resolution', 'Quarter Deck');
    await choose(user, 'Remaining Cards', 'Cards dealt');
    await user.click(screen.getByRole('switch', { name: 'Ten side count' }));
    await user.click(screen.getByRole('button', { name: 'Allowed estimation error: 13' }));
    await answer(user, '3');
    expect(app.settings.get('game.trueCount.resolution')).toBe('quarter');
    expect(app.settings.get('game.trueCount.remainingCards')).toBe('dealt');
    expect(app.settings.get('game.trueCount.tenSideCount')).toBe(true);
    expect(app.settings.get('game.trueCount.allowedErrorCards')).toBe(3);
  });
});

describe('Playing Strategy', () => {
  it('writes rules through their constraints and shows changes made elsewhere', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('rules.dealerPeeksAce', true);
    const { location } = renderScreen(<PlayingStrategy scope="game" />, { app });
    await user.click(screen.getByRole('switch', { name: 'No hole card' }));
    expect(app.settings.get('rules.noHoleCard')).toBe(true);
    expect(app.settings.get('rules.dealerPeeksAce')).toBe(false);
    act(() => app.settings.set('game.strategy.indexRangeMin', -4));
    expect(screen.getByRole('button', { name: 'Index range minimum: -4' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Display Tables' }));
    expect(location().pathname).toBe('/strategy/tables');
    const opened = new URLSearchParams(location().search);
    // The game's own strategy, built for its decks.
    expect([opened.get('scope'), opened.get('system'), opened.get('decks')]).toEqual(['game', '30', '6']);
  });
});
