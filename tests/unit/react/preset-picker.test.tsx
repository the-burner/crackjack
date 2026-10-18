// The preset picker's edge cases, on the Allowed Bets screen (Gestures uses the same picker).
import { describe, it, expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { Betting } from '@/screens/strategy/betting';
import { BETTING_PRESETS, BUILT_IN_BETTING } from '@/settings/betting-strategies';
import { createTestApp, renderScreen } from '../../support/render';

const SINGLE = BUILT_IN_BETTING[0].name;
const picker = () => screen.getByRole('combobox', { name: 'Betting strategy' });
const row = (name: string) => screen.queryByRole('button', { name });

/** Answers the open text prompt. */
async function answer(user: UserEvent, text: string) {
  const dialog = within(await screen.findByRole('alertdialog'));
  await user.clear(dialog.getByRole('textbox'));
  if (text) await user.type(dialog.getByRole('textbox'), text);
  await user.click(dialog.getByRole('button', { name: 'OK' }));
}
const yes = async (user: UserEvent) => user.click(await screen.findByRole('button', { name: 'Yes' }));
const no = async (user: UserEvent) => user.click(await screen.findByRole('button', { name: 'No' }));

/** Allowed Bets with one saved strategy, Spread ($5 chips), selected and unedited. */
function withSpread() {
  const app = createTestApp();
  const values = { ...BETTING_PRESETS.current(key => app.settings.get(key)), 'game.betting.chipValue': 5 as const };
  app.bettingStrategies.setState({ value: [BETTING_PRESETS.make('spread', 'Spread', values)] });
  app.settings.update({ ...values, 'game.betting.strategy': 'spread' });
  renderScreen(<Betting />, { app });
  return app;
}

describe('the preset picker', () => {
  it('marks the selected strategy edited, and saves the edit back into it', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    expect(row('Save “Spread”')).not.toBeInTheDocument();
    act(() => app.settings.set('game.betting.chipValue', 10));
    expect(picker()).toHaveDisplayValue('Spread (edited)');
    await user.click(row('Save “Spread”')!);
    expect(picker()).toHaveDisplayValue('Spread');
    expect(app.bettingStrategies.getState().value[0].values['game.betting.chipValue']).toBe(10);
  });

  it('reverts an edit to what was saved', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    act(() => app.settings.set('game.betting.chipValue', 10));
    await user.click(row('Revert')!);
    expect(app.settings.get('game.betting.chipValue')).toBe(5);
    expect(picker()).toHaveDisplayValue('Spread');
  });

  it('asks before an edit is dropped by choosing another, and keeps it when told no', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    act(() => app.settings.set('game.betting.chipValue', 10));
    await user.selectOptions(picker(), SINGLE);
    await no(user);
    expect(app.settings.get('game.betting.chipValue')).toBe(10);
    expect(picker()).toHaveDisplayValue('Spread (edited)');
    await user.selectOptions(picker(), SINGLE);
    await yes(user);
    await waitFor(() => expect(picker()).toHaveDisplayValue(SINGLE));
    expect(app.settings.get('game.betting.chipValue')).toBe(25);
  });

  it('asks before Save as New replaces a strategy of the same name, ignoring case', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    act(() => app.settings.set('game.betting.chipValue', 100));
    await user.click(row('Save as New…')!);
    await answer(user, 'SPREAD');
    expect(await screen.findByText('Replace “Spread” with these settings?')).toBeInTheDocument();
    await no(user);
    expect(app.bettingStrategies.getState().value[0].values['game.betting.chipValue']).toBe(5);
    await user.click(row('Save as New…')!);
    await answer(user, 'SPREAD');
    await yes(user);
    await waitFor(() => expect(app.bettingStrategies.getState().value[0].values['game.betting.chipValue']).toBe(100));
    expect(app.bettingStrategies.getState().value).toHaveLength(1);
  });

  it('refuses an empty name and a built-in one', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    await user.click(row('Save as New…')!);
    await answer(user, '');
    await user.click(row('Save as New…')!);
    await answer(user, SINGLE.toLowerCase());
    expect(app.bettingStrategies.getState().value).toHaveLength(1);
  });

  it('renames a strategy, refusing a name another one has', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    act(() =>
      app.bettingStrategies.setState({
        value: [
          ...app.bettingStrategies.getState().value,
          { ...app.bettingStrategies.getState().value[0], id: 'flat', name: 'Flat' },
        ],
      }),
    );
    await user.click(row('Rename…')!);
    await answer(user, 'flat');
    expect(app.bettingStrategies.getState().value.map(s => s.name)).toEqual(['Spread', 'Flat']);
    await user.click(row('Rename…')!);
    await answer(user, 'Wide');
    await waitFor(() => expect(picker()).toHaveDisplayValue('Wide'));
  });

  it('tells two strategies with the same settings apart by which was chosen', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    await user.click(row('Save as New…')!);
    await answer(user, 'Twin');
    await waitFor(() => expect(picker()).toHaveDisplayValue('Twin'));
    expect(app.settings.get('game.betting.strategy')).not.toBe('spread');
  });

  it('keeps the settings as unsaved Custom ones when the strategy in use is deleted', async () => {
    const user = userEvent.setup();
    const app = withSpread();
    await user.click(row('Delete “Spread”')!);
    await yes(user);
    await waitFor(() => expect(picker()).toHaveDisplayValue('Custom'));
    expect(app.settings.get('game.betting.chipValue')).toBe(5);
    expect(row('Rename…')).not.toBeInTheDocument();
  });

  it('leaves the built-in strategies read-only, and Reset Defaults back on the single-hand one', async () => {
    const app = withSpread();
    act(() => app.settings.update({ 'game.betting.strategy': 'single-hand', 'game.betting.chipValue': 10 }));
    expect(picker()).toHaveDisplayValue(`${SINGLE} (edited)`);
    expect(row(`Save “${SINGLE}”`)).not.toBeInTheDocument();
    expect(row('Rename…')).not.toBeInTheDocument();
    expect(row('Revert')).toBeInTheDocument();
    act(() => app.settings.reset());
    expect(picker()).toHaveDisplayValue(SINGLE);
    expect(app.bettingStrategies.getState().value).toHaveLength(1);
  });
});
