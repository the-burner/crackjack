// Saving the game's and a drill's settings under a name, on their options screens.
import { describe, it, expect } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { GameOptions } from '@/game/screens/options';
import { DepthOptions } from '@/drills/depth/options';
import { createTestApp, renderScreen } from '../../support/render';

const picker = () => screen.getByRole('combobox', { name: 'Configuration' });

async function saveAs(user: UserEvent, name: string) {
  await user.click(screen.getByRole('button', { name: 'Save as New…' }));
  const dialog = within(await screen.findByRole('alertdialog'));
  await user.type(dialog.getByRole('textbox'), name);
  await user.click(dialog.getByRole('button', { name: 'OK' }));
}

describe('a game configuration', () => {
  it('saves the game’s settings, not the betting strategy, and loads Default back', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    renderScreen(<GameOptions />, { app, path: '/game' });
    expect(picker()).toHaveDisplayValue('Default');
    act(() => app.settings.update({ 'table.decks': 2, 'rules.surrender': 'early', 'betting.chipValue': 10 }));
    expect(picker()).toHaveDisplayValue('Default (edited)');
    await saveAs(user, 'Two decks');
    await waitFor(() => expect(picker()).toHaveDisplayValue('Two decks'));
    const [saved] = app.gameConfigs.getState().value;
    expect(saved.values).toMatchObject({ 'table.decks': 2, 'rules.surrender': 'early' });
    expect(saved.values).not.toHaveProperty('betting.chipValue');
    await user.selectOptions(picker(), 'Default');
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(6));
    expect(app.settings.get('rules.surrender')).toBe('late');
    // The betting strategy is its own.
    expect(app.settings.get('betting.chipValue')).toBe(10);
    await user.selectOptions(picker(), 'Two decks');
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(2));
  });
});

describe('a drill configuration', () => {
  it('saves that drill’s settings only', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    renderScreen(<DepthOptions />, { app, path: '/drills/depth' });
    expect(picker()).toHaveDisplayValue('Default');
    act(() => app.settings.update({ 'drills.depth.decks': 2, 'drills.flash.decks': 2 }));
    expect(picker()).toHaveDisplayValue('Default (edited)');
    await saveAs(user, 'Short shoe');
    await waitFor(() => expect(app.drillConfigs.depth.getState().value).toHaveLength(1));
    const [saved] = app.drillConfigs.depth.getState().value;
    expect(saved.values['drills.depth.decks']).toBe(2);
    expect(saved.values).not.toHaveProperty('drills.flash.decks');
    expect(app.drillConfigs.flash.getState().value).toEqual([]);
  });
});
