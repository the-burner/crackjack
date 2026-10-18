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
  it('sets a gesture’s key from the next key pressed, swapping with the gesture that had it, and Escape keeps it', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Gestures />);
    await user.click(screen.getByRole('button', { name: 'Portrait Double tap key: /' }));
    expect(screen.getByRole('button', { name: 'Portrait Double tap key: Press a key' })).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(app.settings.get('gestures.keys')).toMatchObject({ doubleTap: 'ArrowUp', up: '/' });
    expect(screen.getByRole('button', { name: 'Portrait Swipe up key: /' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Portrait Swipe down key: ↓' }));
    await user.keyboard('{Shift>}K{/Shift}');
    expect(app.settings.get('gestures.keys')).toMatchObject({ down: 'k' });
    await user.click(screen.getByRole('button', { name: 'Portrait Swipe down key: K' }));
    await user.keyboard('{Escape}');
    expect(app.settings.get('gestures.keys')).toMatchObject({ down: 'k' });
    expect(screen.getByRole('button', { name: 'Portrait Swipe down key: K' })).toBeInTheDocument();
  });

  it('swaps plays between gestures, and picks a configuration for both orientations at once', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Gestures />);
    await choose(user, 'Portrait Swipe up', 'Hit');
    expect(app.settings.get('gestures.portrait')).toMatchObject({ up: 'hit', down: 'double' });
    expect(select('Configuration')).toHaveDisplayValue('Standard (edited)');
    await choose(user, 'Configuration', 'Landscape left');
    // The edit is unsaved, so it is only dropped once agreed to.
    await user.click(await screen.findByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.settings.get('gestures.portrait')).toEqual(STANDARD));
    expect(app.settings.get('gestures.landscape')).toEqual(rotated(STANDARD, 3));
  });

  it('saves both orientations under one name, offers it, and deletes it', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<Gestures />);
    await choose(user, 'Portrait Swipe up', 'Hit');
    await choose(user, 'Landscape Swipe left', 'Split');
    await user.click(screen.getByRole('button', { name: 'Save as New…' }));
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
    app.settings.reset();
    expect(app.settings.get('gestures.landscape')).toEqual(STANDARD);
    await waitFor(() => expect(select('Configuration')).toHaveDisplayValue('Standard'));
  });
});

describe('navigation screens', () => {
  it('Settings holds only what the whole app shares', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<SettingsHub />);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual([
      'Back',
      'Help',
      'Appearance & Sound',
      'Gestures',
      'Reset Defaults',
    ]);
    await user.click(screen.getByRole('button', { name: 'Gestures' }));
    expect(location().pathname).toBe('/settings/gestures');
  });

  it("Game Options opens the game's own screens", async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<GameOptions />, { path: '/game' });
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([
      'Table and Rules',
      'Strategy',
      'Peeking and Warnings',
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
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(location().pathname).toBe('/game/play');
    expect(app.settings.get('table.computerSeats').some(computer => !computer)).toBe(true);
  });

  it('Blackjack on the home screen opens Game Options', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<Home />);
    await user.click(screen.getByRole('button', { name: 'Blackjack' }));
    expect(location().pathname).toBe('/game');
  });

  it('Reset Defaults (in Settings) says what it erases, asks, then erases everything saved and starts afresh', async () => {
    const user = userEvent.setup();
    const app = createTestApp();
    app.restart = vi.fn();
    app.settings.set('table.decks', 2);
    app.bankroll.setState({ value: 50 });
    app.gestureConfigs.setState({ value: [{ id: 'x', name: 'Mine', portrait: STANDARD, landscape: STANDARD }] });
    app.errorTallies.record('hardStand', 0, 0);
    renderScreen(<SettingsHub />, { app });
    await user.click(screen.getByRole('button', { name: 'Reset Defaults' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Erase everything saved');
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(app.restart).toHaveBeenCalled());
    // Nothing of the app's is left saved; it reads everything afresh as it starts again.
    const backend = app.storage.backend;
    expect(Array.from({ length: backend.length }, (_, i) => backend.key(i)).filter(k => k?.startsWith('cj.'))).toEqual(
      [],
    );
  });

  it('shows Reset Defaults in the theme’s red', () => {
    renderScreen(<SettingsHub />);
    expect(screen.getByRole('button', { name: 'Reset Defaults' })).toHaveClass('text-(--warning)');
  });

  it('the home screen lists every module alike, under its slogan', () => {
    renderScreen(<Home />);
    expect(screen.getByText('Get cracked at blackjack')).toBeInTheDocument();
    // No heading over them.
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    const NAMES = [
      'Blackjack',
      'Playing Strategy Flash Cards',
      'Deck Estimation and TC Conversion',
      'Simple Running Count',
      'Compound Running Count',
      'Playing Strategy Charts',
    ];
    const modules = screen.getAllByRole('button', { name: new RegExp(`^(${NAMES.join('|')})`) });
    expect(modules.map(b => NAMES.find(name => b.textContent?.startsWith(name)))).toEqual(NAMES);
  });

  it('Playing Strategy Charts on the home screen opens the strategy tables to look at', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(<Home />);
    await user.click(screen.getByRole('button', { name: /^Playing Strategy Charts/ }));
    expect(location().pathname).toBe('/strategy/tables');
    expect(new URLSearchParams(location().search).get('title')).toBe('Playing Strategy Charts');
  });

  it('the home screen draws the wordmark and has no Reset Defaults', () => {
    renderScreen(<Home />);
    expect(screen.getByRole('img', { name: 'Crackjack' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset Defaults' })).not.toBeInTheDocument();
  });

  it('the home screen shows the build: the last commit’s date and hash', () => {
    renderScreen(<Home />);
    const version = screen.getByText(/^Crackjack \d{4}\.\d{2}\.\d{2} · [0-9a-f]{7,}$/);
    // The copyright is on the line above.
    const copyright = screen.getByText('Copyright 2025 Crackjack, all rights reserved');
    expect(copyright.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(help()).toEqual({ topic: 'game.options', title: 'Blackjack' });
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
