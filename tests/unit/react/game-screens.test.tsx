import { describe, it, expect, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSession } from '@/game/session';
import { GameStats } from '@/game/screens/stats';
import { BetSelect } from '@/game/screens/bet-select';
import { createTestApp, renderScreen } from '../../support/render';

/** The value shown in the stats row labelled `label`, or null without one. */
function stat(label: string): string | null {
  const row = screen.queryByRole('row', { name: new RegExp(`^${label} `) });
  return row ? within(row).getByRole('cell').textContent : null;
}

describe('statistics screen', () => {
  it('shows a placeholder without a session', () => {
    renderScreen(<GameStats params={{}} />);
    // A section row shows its name in both columns, as the original's did.
    expect(screen.getAllByRole('row').map(row => row.textContent)).toEqual(['CountsCounts', 'No session-']);
  });

  it('shows the session, money as the app shows it, and follows its saves', () => {
    const app = createTestApp();
    const session = new GameSession(app);
    renderScreen(<GameStats params={{ session }} />, { app });
    expect(stat('Rounds Played')).toBe('0');
    expect(stat('Bet Count')).toBeNull();
    session.stats.totalBet = 1010;
    session.stats.rounds = 2;
    act(() => session.save());
    expect(stat('Total Initial Bets')).toBe('$1,010');
    expect(stat('Average Bet')).toBe('$505');
    act(() => app.settings.set('trueCount.aceSideCount', true));
    expect(stat('Bet Count')).not.toBeNull();
  });

  it('shows the advanced count, the cards left the true count uses in bold', () => {
    const app = createTestApp();
    app.settings.set('trueCount.remainingCards', 'inTray');
    const session = new GameSession(app);
    renderScreen(<GameStats params={{ session }} />, { app });
    expect(screen.getAllByRole('columnheader', { name: 'Advanced Count' })).toHaveLength(2);
    const left = session.advancedCounts().cardsLeft;
    expect(stat('Cards Remaining \\(Dealt\\)')).toBe(String(left.dealt));
    expect(stat('Cards Remaining \\(In Tray\\)')).toBe(String(left.inTray));
    // The row sets its cells in bold.
    expect(screen.getByRole('row', { name: /^Cards Remaining \(In Tray\) / })).toHaveClass('*:font-semibold');
    expect(screen.getByRole('row', { name: /^Cards Remaining \(Dealt\) / })).not.toHaveClass('*:font-semibold');
    expect(stat('Exact Decks Remaining')).toMatch(/^\d+\.\d\d$/);
    expect(stat('Exact True Count')).toMatch(/^-?\d+\.\d\d$/);
    // No round yet.
    expect(stat('True Count \\(Round Start\\)')).toBe('-');
    act(() => {
      session.startBetting();
      session.startRound({ betPerHand: 25 });
    });
    act(() => session.save());
    expect(stat('Running Count \\(Round Start\\)')).toMatch(/^-?\d+(\.\d)?$/);
    expect(stat('Remaining Decks \\(Round Start\\)')).toBe(String(session.roundStartCounts!.decksRemaining));
    expect(stat('True Count \\(Round Start\\)')).toBe(String(session.roundStartCounts!.trueCount));
  });

  it('the display switches write their settings', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<GameStats params={{}} />);
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    await user.click(screen.getByRole('switch', { name: 'Display True Count' }));
    expect(app.settings.get('display.showTrueCount')).toBe(true);
  });
});

describe('bet picker', () => {
  const chip = (n: number) =>
    within(screen.getByRole('group', { name: 'Chips' })).getByRole('button', { name: String(n) });
  const spots = (name: string) => within(screen.getByRole('group', { name: 'Spots' })).getByRole('button', { name });

  it('limits the chips to what the chosen number of spots allows', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { location } = renderScreen(<BetSelect params={{ chipValue: 5, onPick }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Allowed Bets');
    expect(chip(200)).toBeEnabled();
    const two = spots('2x');
    await user.click(two);
    expect(two).toHaveAttribute('aria-pressed', 'true');
    expect(spots('1')).toHaveAttribute('aria-pressed', 'false');
    expect(chip(100)).toBeEnabled();
    expect(chip(200)).toBeDisabled();
    await user.click(chip(3));
    expect(onPick).toHaveBeenCalledWith({ chips: 3, hands: 2, amount: 15 });
    expect(location().pathname).toBe('/');
  });

  it('a side bet is for one spot, and the handler may stay or move on itself', async () => {
    const user = userEvent.setup();
    const { location } = renderScreen(
      <BetSelect params={{ mode: 'sideBet', chipValue: 10, hands: 3, onPick: () => true }} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Side Bet');
    expect(screen.queryByRole('group', { name: 'Spots' })).not.toBeInTheDocument();
    await user.click(chip(2));
    expect(location().pathname).toBe('/screen');
    expect(screen.getByText('One chip is $10. Chips x spots may not exceed 200.')).toBeInTheDocument();
  });
});
