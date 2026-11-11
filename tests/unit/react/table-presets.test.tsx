// Tables on Table Rules: built in or saved, found by typing part of a name, a place or a rule.
import { describe, it, expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { TableRules } from '@/screens/settings/table-rules';
import { GameOptions } from '@/game/screens/options';
import { TABLE_SETS } from '@/settings/setting-sets';
import { createTestApp, renderScreen } from '../../support/render';

const picker = () => screen.getByRole('combobox', { name: 'Table' });
const options = () =>
  within(screen.getByRole('listbox', { name: 'Table' }))
    .queryAllByRole('option')
    .map(option => option.textContent);

async function search(user: UserEvent, text: string) {
  await user.click(picker());
  await user.clear(picker());
  if (text) await user.type(picker(), text);
}

describe('the table picker', () => {
  it("starts on Crackjack's table, and lists every table with where it is and its rules", async () => {
    const user = userEvent.setup();
    renderScreen(<TableRules />);
    expect(picker()).toHaveDisplayValue("Crackjack's 6D,H17,LS,DAS");
    await search(user, '');
    expect(options()).toHaveLength(TABLE_SETS.kind.builtIns.length);
    expect(screen.getByRole('option', { name: /Emerald Queen 8-Deck Shoe/ })).toHaveTextContent(
      'Tacoma, WA · 8D H17 DAS LS RSA · $15–$500',
    );
  });

  it('narrows the list with every letter typed, by name, place or rule, and loads the one tapped', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    renderScreen(<TableRules />, { app });
    await search(user, 'tacoma');
    expect(options()).toHaveLength(3);
    await user.type(picker(), ' rsa');
    expect(options()[0]).toMatch(/^Emerald Queen 8-Deck Shoe/);
    await user.click(screen.getByRole('option', { name: /Emerald Queen 8-Deck Shoe/ }));
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(8));
    expect(app.settings.get('rules.resplitAces')).toBe(true);
    expect(app.settings.get('table.minBet')).toBe(15);
    expect(app.settings.get('table.preset')).toBe('emerald-queen-8d');
    expect(picker()).toHaveDisplayValue('Emerald Queen 8-Deck Shoe');
    // Escape keeps it.
    await search(user, 'spanish');
    await user.keyboard('{Escape}');
    expect(picker()).toHaveDisplayValue('Emerald Queen 8-Deck Shoe');
    expect(app.settings.get('bonuses.game')).toBe(0);
  });

  it('marks a built-in table edited once a rule changes, and saves the change as a table of your own', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    renderScreen(<TableRules />, { app });
    await search(user, 'emerald double');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(2));
    await user.click(screen.getByRole('switch', { name: 'Resplit aces' }));
    expect(picker()).toHaveDisplayValue('Emerald Queen Double Deck (edited)');
    expect(screen.queryByRole('button', { name: /^Save “/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save as New…' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await user.type(dialog.getByRole('textbox'), 'Emerald Queen DD with RSA');
    await user.click(dialog.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(picker()).toHaveDisplayValue('Emerald Queen DD with RSA'));
    const [saved] = app.tables.getState().value;
    expect(saved.values['rules.resplitAces']).toBe(true);
    expect(saved.values['table.decks']).toBe(2);
    // Only the table's settings: not the seats, the bankroll or the strategy.
    expect(saved.values).not.toHaveProperty('table.seatCount');
    expect(saved.values).not.toHaveProperty('game.strategy.system');
  });

  it('leaves out a saved table with a built-in’s name, so the built-in always wins', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    const fake = TABLE_SETS.kind.make('saved-1', 'emerald queen spanish 21', { 'table.decks': 1 });
    act(() => app.tables.setState({ value: [fake] }));
    renderScreen(<TableRules />, { app });
    await search(user, 'spanish');
    expect(options()).toEqual([expect.stringMatching(/^Emerald Queen Spanish 21Tacoma/)]);
  });

  it('is remembered by a Blackjack configuration', async () => {
    const app = createTestApp();
    renderScreen(<GameOptions />, { app, path: '/game' });
    expect(app.settings.get('table.preset')).toBe('crackjack-6d');
    expect(screen.getByRole('combobox', { name: 'Configuration' })).toHaveDisplayValue("Crackjack's 6D,H17,LS,DAS");
  });
});
