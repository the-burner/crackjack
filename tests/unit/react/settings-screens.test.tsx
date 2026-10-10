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
import { Gestures } from '@/screens/settings/gestures';
import { STANDARD, rotated } from '@/core/gestures';
import { GameOptions } from '@/game/screens/options';
import { Home } from '@/screens/home';
import { HelpSheet } from '@/screens/help';
import { helpState } from '@/app/help';
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
    expect(screen.getByText('Shuffle Point/Cards')).toBeVisible();
    expect(screen.getByText('Rounds')).not.toBeVisible();
    expect(select('Shuffle')).toHaveDisplayValue('Shuffle after a Cut Card');
    await choose(user, 'Shuffle', 'Shuffle after Fixed Rounds');
    expect(screen.getByText('Shuffle Point/Cards')).not.toBeVisible();
    expect(screen.getByText('Rounds')).toBeVisible();
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

describe('Gestures', () => {
  it('swaps plays between gestures, and picks a configuration for both orientations at once', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Gestures />);
    await choose(user, 'Portrait Swipe up', 'Hit');
    expect(app.settings.get('gestures.portrait')).toMatchObject({ up: 'hit', down: 'double' });
    expect(select('Configuration')).toHaveDisplayValue('Custom');
    await choose(user, 'Configuration', 'Landscape left');
    expect(app.settings.get('gestures.portrait')).toEqual(STANDARD);
    expect(app.settings.get('gestures.landscape')).toEqual(rotated(STANDARD, 3));
  });

  it('saves both orientations under one name, offers it, and deletes it', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Gestures />);
    await choose(user, 'Portrait Swipe up', 'Hit');
    await choose(user, 'Landscape Swipe left', 'Split');
    await user.click(screen.getByRole('button', { name: 'Save as…' }));
    await user.type(await screen.findByRole('textbox'), 'Ring');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(app.gestureConfigs.getState().value.map(c => c.name)).toEqual(['Ring']));
    const [ring] = app.gestureConfigs.getState().value;
    expect(ring.portrait).toMatchObject({ up: 'hit' });
    expect(ring.landscape).toMatchObject({ left: 'split' });
    expect(select('Configuration')).toHaveDisplayValue('Ring');
    await user.click(screen.getByRole('button', { name: 'Delete “Ring”' }));
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.gestureConfigs.getState().value).toEqual([]));
    // Reset Defaults keeps saved sets: they are not settings.
    app.gestureConfigs.setState({ value: [{ id: 'x', name: 'Kept', portrait: STANDARD, landscape: STANDARD }] });
    app.settings.reset();
    expect(app.gestureConfigs.getState().value).toHaveLength(1);
    expect(app.settings.get('gestures.landscape')).toEqual(STANDARD);
  });
});

describe('navigation screens', () => {
  it('Settings holds only what the whole app shares', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<SettingsHub />);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual([
      'Back',
      'Help',
      'Playing Strategies',
      'True Count Calcs',
      'Appearance & Sound',
      'Gestures',
      'Reset Defaults',
    ]);
    await user.click(screen.getByRole('button', { name: 'True Count Calcs' }));
    expect(location().pathname).toBe('/settings/true-count');
  });

  it("Game Options opens the game's own screens", async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<GameOptions />, { path: '/game' });
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      'Table and Rules',
      'Betting and Peeking',
      'Table',
    ]);
    expect(screen.getByRole('switch', { name: 'Warning on Strategy Error' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Common Rules' }));
    expect(location().pathname).toBe('/game/common-rules');
  });

  it('Game Options starts the game, freeing a seat for the player', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.computerSeats', [true, true, true, true, true, true]);
    const { location } = renderScreen(<GameOptions />, { app, path: '/game' });
    await user.click(screen.getByRole('button', { name: 'Play Blackjack' }));
    expect(location().pathname).toBe('/game/play');
    expect(app.settings.get('table.computerSeats').some(computer => !computer)).toBe(true);
  });

  it('Play Blackjack on the home screen opens Game Options', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<Home />);
    await user.click(screen.getByRole('button', { name: 'Play Blackjack' }));
    expect(location().pathname).toBe('/game');
  });

  it('Reset Defaults (in Settings) says what it resets, asks, then resets every setting', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.settings.set('table.decks', 2);
    app.settings.set('drills.flash.decks', 2);
    renderScreen(<SettingsHub />, { app });
    expect(screen.getByText(/Resets every setting in the app/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Defaults' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Reset every setting');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.settings.get('table.decks')).toBe(6));
    expect(app.settings.get('drills.flash.decks')).toBe(app.settings.schema['drills.flash.decks'].default);
  });

  it('the home screen draws the wordmark and has no Reset Defaults', () => {
    renderScreen(<Home />);
    expect(screen.getByRole('img', { name: 'Crackjack' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset Defaults' })).not.toBeInTheDocument();
  });

  it('help opens its links outside the app, and says when there is none', () => {
    const { router } = renderScreen(<HelpSheet />);
    act(() => void router.navigate(router.state.location, { state: helpState('test.links', 'Links') }));
    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(screen.getByRole('heading', { level: 1, name: 'Links' })).toBeInTheDocument();
    act(() => void router.navigate(router.state.location, { state: helpState('nothing') }));
    expect(screen.getByText(/No help is available/)).toBeInTheDocument();
  });

  it('help is a history entry over the screen: going back (a swipe, Back, Escape) closes it in place', async () => {
    const user = userEvent.setup();
    const { router, location, help } = renderScreen(
      <>
        <GameOptions />
        <HelpSheet />
      </>,
      { path: '/game' },
    );
    await user.click(screen.getAllByRole('button', { name: 'Help' })[0]);
    expect(help()).toEqual({ topic: 'game.options', title: 'Game Options' });
    act(() => void router.navigate(-1));
    expect(help()).toBeNull();
    expect(location().pathname).toBe('/game');
    expect(screen.queryByRole('heading', { level: 1, name: 'Help' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Help' })[0]);
    await user.keyboard('{Escape}');
    expect(help()).toBeNull();
    expect(location().pathname).toBe('/game');
  });
});
