import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Setup } from '@/screens/settings/setup';
import { CommonRules } from '@/screens/settings/common-rules';
import { PlayVariations } from '@/screens/settings/play-variations';
import { Bonuses } from '@/screens/settings/bonuses';
import { UnusualGames } from '@/screens/settings/unusual-games';
import { SettingsHub } from '@/screens/settings/hub';
import { Home } from '@/screens/home';
import { Help } from '@/screens/help';
import { createTestApp, renderScreen } from '../../support/render';

vi.mock('@/ui/dialogs', async importOriginal => ({
  ...(await importOriginal<typeof import('@/ui/dialogs')>()),
  confirm: vi.fn(async () => true),
}));

vi.mock('@/data/help', async importOriginal => {
  const { HELP } = await importOriginal<typeof import('@/data/help')>();
  return { HELP: { ...HELP, 'test.links': '<p><a href="https://example.com">site</a></p>' } };
});

const checkbox = (name: string) => screen.getByRole('checkbox', { name });

describe('Basic Setup', () => {
  it('fewer decks pull the cut card back inside the shoe', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.cardsBehindCutCard', 300);
    renderScreen(<Setup />, { app });
    await user.selectOptions(screen.getByDisplayValue('Six Decks'), 'Double Deck');
    expect(app.settings.get('table.decks')).toBe(2);
    expect(app.settings.get('table.cardsBehindCutCard')).toBe(103);
    expect(screen.getByRole('button', { name: '103' })).toBeVisible();
  });

  it('shows the cut card row or the rounds row by shuffle mode', async () => {
    const user = userEvent.setup();
    renderScreen(<Setup />);
    expect(screen.getByText('Shuffle Point/Cards:')).toBeVisible();
    expect(screen.getByText('Rounds:')).not.toBeVisible();
    await user.selectOptions(screen.getByDisplayValue('Shuffle after a Cut Card'), 'Shuffle after Fixed Rounds');
    expect(screen.getByText('Shuffle Point/Cards:')).not.toBeVisible();
    expect(screen.getByText('Rounds:')).toBeVisible();
  });

  it('seats run 6..1 and toggle computer players', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Setup />);
    const seats = ['#6', '#5', '#4', '#3', '#2', '#1'].map(checkbox);
    expect(screen.getAllByRole('checkbox')).toEqual(seats);
    await user.click(checkbox('#3'));
    expect(app.settings.get('table.computerSeats')).toEqual([true, false, true, false, false, false]);
    expect(checkbox('#3')).toBeChecked();
    // eslint-disable-next-line testing-library/no-node-access -- the row's look comes from its class
    expect(checkbox('#3').closest('label')).toHaveClass('is-on');
  });

  it('Refresh Bankroll stores the starting bankroll', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.startingBankroll', 500);
    renderScreen(<Setup />, { app });
    await user.click(screen.getByRole('button', { name: 'Refresh Bankroll' }));
    expect(app.storage.get('bankroll')).toBe(500);
  });
});

describe('rule interactions', () => {
  it('unchecking peek on ace unchecks peek on ten', async () => {
    const user = userEvent.setup();
    renderScreen(<PlayVariations />);
    expect(checkbox('Dealer peeks on ten')).toBeChecked();
    await user.click(checkbox('Dealer peeks on ace'));
    expect(checkbox('Dealer peeks on ten')).not.toBeChecked();
    // eslint-disable-next-line testing-library/no-node-access -- the row's look comes from its class
    expect(checkbox('Dealer peeks on ten').closest('label')).not.toHaveClass('is-on');
  });

  it('the blackjack payout rows are one setting', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Bonuses />);
    await user.click(checkbox('Blackjack pays 2:1'));
    await user.click(checkbox('No Blackjack bonus'));
    expect(app.settings.get('rules.blackjackPayout')).toBe('1:1');
    expect(checkbox('Blackjack pays 2:1')).not.toBeChecked();
    await user.click(checkbox('No Blackjack bonus'));
    expect(app.settings.get('rules.blackjackPayout')).toBe('3:2');
  });

  it('a game applies its rules, and a select keeps a value the game forbids', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    const view = renderScreen(<UnusualGames />, { app });
    await user.selectOptions(screen.getByDisplayValue('Standard Blackjack'), 'Double Exposure');
    expect(app.settings.get('rules.insurance')).toBe('none');
    view.unmount();
    renderScreen(<CommonRules />, { app });
    const insurance = screen.getByDisplayValue('No Insurance');
    await user.selectOptions(insurance, 'Insurance');
    expect(app.settings.get('rules.insurance')).toBe('none');
    expect(insurance).toHaveDisplayValue('No Insurance');
  });
});

describe('navigation screens', () => {
  it('the hub opens each option screen', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<SettingsHub />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Common Rules' }));
    expect(app.open).toHaveBeenCalledWith('settings.commonRules');
  });

  it('Reset Defaults asks, then resets', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.decks', 2);
    renderScreen(<Home />, { app });
    expect(screen.getByRole('img', { name: 'Crackjack' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Defaults' }));
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(6));
  });

  it('help opens its links outside the app, and says when there is none', () => {
    const { unmount } = renderScreen(<Help params={{ topic: 'test.links', title: 'Links' }} />);
    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument();
    unmount();
    renderScreen(<Help params={{ topic: 'nothing' }} />);
    expect(screen.getByText(/No help is available/)).toBeInTheDocument();
  });
});
