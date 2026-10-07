import { describe, it, expect, vi } from 'vitest';
import type { UserEvent } from '@testing-library/user-event';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Setup } from '@/screens/settings/setup';
import { CommonRules } from '@/screens/settings/common-rules';
import { PlayVariations } from '@/screens/settings/play-variations';
import { Bonuses } from '@/screens/settings/bonuses';
import { UnusualGames } from '@/screens/settings/unusual-games';
import { SettingsHub } from '@/screens/settings/hub';
import { Home } from '@/screens/home';
import { HelpSheet } from '@/screens/help';
import { openHelp } from '@/app/help';
import { createTestApp, renderScreen } from '../../support/render';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ toast, Toaster: () => null }));

vi.mock('@/data/help', async importOriginal => {
  const { HELP } = await importOriginal<typeof import('@/data/help')>();
  return { HELP: { ...HELP, 'test.links': '<p><a href="https://example.com">site</a></p>' } };
});

const toggle = (name: string) => screen.getByRole('switch', { name });
const select = (name: string) => screen.getByRole('combobox', { name });

/** Picks one of a select's options. */
async function choose(user: UserEvent, name: string, option: string) {
  await user.selectOptions(select(name), option);
}

describe('Basic Setup', () => {
  it('fewer decks pull the cut card back inside the shoe', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.cardsBehindCutCard', 300);
    renderScreen(<Setup />, { app });
    expect(select('Decks')).toHaveDisplayValue('Six Decks');
    await choose(user, 'Decks', 'Double Deck');
    expect(app.settings.get('table.decks')).toBe(2);
    expect(app.settings.get('table.cardsBehindCutCard')).toBe(103);
    expect(screen.getByRole('button', { name: 'Shuffle Point/Cards: 103' })).toBeVisible();
  });

  it('shows the cut card row or the rounds row by shuffle mode', async () => {
    const user = userEvent.setup();
    renderScreen(<Setup />);
    expect(screen.getByText('Shuffle Point/Cards:')).toBeVisible();
    expect(screen.getByText('Rounds:')).not.toBeVisible();
    expect(select('Shuffle')).toHaveDisplayValue('Shuffle after a Cut Card');
    await choose(user, 'Shuffle', 'Shuffle after Fixed Rounds');
    expect(screen.getByText('Shuffle Point/Cards:')).not.toBeVisible();
    expect(screen.getByText('Rounds:')).toBeVisible();
  });

  it('seats run 6..1 and toggle computer players', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Setup />);
    const picker = within(screen.getByRole('group', { name: 'Computer players' }));
    expect(picker.getAllByText(/^#\d$/).map(seat => seat.textContent)).toEqual(['#6', '#5', '#4', '#3', '#2', '#1']);
    await user.click(picker.getByRole('checkbox', { name: '#3' }));
    expect(app.settings.get('table.computerSeats')).toEqual([true, false, true, false, false, false]);
    expect(picker.getByRole('checkbox', { name: '#3' })).toBeChecked();
    expect(picker.getByRole('checkbox', { name: '#1' })).toBeChecked();
    expect(picker.getByRole('checkbox', { name: '#2' })).not.toBeChecked();
  });

  it('Refresh Bankroll stores the starting bankroll', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.startingBankroll', 500);
    renderScreen(<Setup />, { app });
    await user.click(screen.getByRole('button', { name: 'Refresh Bankroll' }));
    expect(app.bankroll.getState().value).toBe(500);
    expect(toast).toHaveBeenCalledWith('Bankroll refreshed');
  });
});

describe('rule interactions', () => {
  it('unchecking peek on ace unchecks peek on ten', async () => {
    const user = userEvent.setup();
    renderScreen(<PlayVariations />);
    expect(toggle('Dealer peeks on ten')).toBeChecked();
    await user.click(toggle('Dealer peeks on ace'));
    expect(toggle('Dealer peeks on ten')).not.toBeChecked();
  });

  it('the blackjack payout rows are one setting', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Bonuses />);
    await user.click(toggle('Blackjack pays 2:1'));
    await user.click(toggle('No Blackjack bonus'));
    expect(app.settings.get('rules.blackjackPayout')).toBe('1:1');
    expect(toggle('Blackjack pays 2:1')).not.toBeChecked();
    await user.click(toggle('No Blackjack bonus'));
    expect(app.settings.get('rules.blackjackPayout')).toBe('3:2');
  });

  it('a game applies its rules, and a select keeps a value the game forbids', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    const view = renderScreen(<UnusualGames />, { app });
    expect(select('Game')).toHaveDisplayValue('Standard Blackjack');
    await choose(user, 'Game', 'Double Exposure');
    expect(app.settings.get('rules.insurance')).toBe('none');
    view.unmount();
    renderScreen(<CommonRules />, { app });
    expect(select('Insurance')).toHaveDisplayValue('No Insurance');
    await choose(user, 'Insurance', 'Insurance');
    expect(app.settings.get('rules.insurance')).toBe('none');
    expect(select('Insurance')).toHaveDisplayValue('No Insurance');
  });
});

describe('navigation screens', () => {
  it('the hub opens each option screen', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<SettingsHub />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Common Rules' }));
    expect(location().pathname).toBe('/settings/common-rules');
  });

  it('Reset Defaults asks, then resets', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.decks', 2);
    renderScreen(<Home />, { app });
    expect(screen.getByRole('img', { name: 'Crackjack' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Defaults' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('reset all options');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(6));
  });

  it('help opens its links outside the app, and says when there is none', () => {
    renderScreen(<HelpSheet />);
    act(() => openHelp('test.links', 'Links'));
    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(screen.getByRole('heading', { level: 1, name: 'Links' })).toBeInTheDocument();
    act(() => openHelp('nothing'));
    expect(screen.getByText(/No help is available/)).toBeInTheDocument();
  });
});
