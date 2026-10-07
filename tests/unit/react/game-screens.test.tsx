import { describe, it, expect, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameSession } from '../../../src/game/session.ts';
import { GameStats } from '../../../src/game/screens/stats.tsx';
import { BetSelect } from '../../../src/game/screens/bet-select.tsx';
import { createTestApp, renderScreen } from '../../support/render.tsx';

/** The value shown in the stats row labelled `label`, or null without one. */
function stat(label: string): string | null {
  const row = screen.queryByRole('row', { name: new RegExp(`^${label} `) });
  return row ? within(row).getByRole('cell').textContent : null;
}

describe('statistics screen', () => {
  it('shows a placeholder without a session', () => {
    renderScreen(<GameStats params={{}} />);
    expect(screen.getAllByRole('row').map(row => row.textContent)).toEqual(['CountsCounts', 'No session-']);
  });

  it('shows the session, money as the app shows it, and re-reads it when shown', () => {
    const app = createTestApp();
    const session = new GameSession(app);
    const { show } = renderScreen(<GameStats params={{ session }} />, { app });
    expect(stat('Rounds Played')).toBe('0');
    expect(stat('Bet Count')).toBeNull();
    session.stats.totalBet = 1010;
    session.stats.rounds = 2;
    show();
    expect(stat('Total Initial Bets')).toBe('$1,010');
    expect(stat('Average Bet')).toBe('$505');
    act(() => app.settings.set('trueCount.aceSideCount', true));
    expect(stat('Bet Count')).not.toBeNull();
  });

  it('the display switches write their settings', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(<GameStats params={{}} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    await user.click(screen.getByRole('checkbox', { name: 'Display True Count' }));
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
    const { app } = renderScreen(<BetSelect params={{ chipValue: 5, onPick }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Allowed Bets');
    expect(chip(200)).toBeEnabled();
    const two = spots('2x');
    await user.click(two);
    expect(two).toHaveClass('is-on');
    expect(spots('1')).not.toHaveClass('is-on');
    expect(chip(100)).toBeEnabled();
    expect(chip(200)).toBeDisabled();
    await user.click(chip(3));
    expect(onPick).toHaveBeenCalledWith({ chips: 3, hands: 2, amount: 15 });
    expect(app.back).toHaveBeenCalledTimes(1);
  });

  it('a side bet is for one spot, and the handler may stay or move on itself', async () => {
    const user = userEvent.setup();
    const { app } = renderScreen(
      <BetSelect params={{ mode: 'sideBet', chipValue: 10, hands: 3, onPick: () => true }} />,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Side Bet');
    expect(screen.queryByRole('group', { name: 'Spots' })).not.toBeInTheDocument();
    await user.click(chip(2));
    expect(app.back).not.toHaveBeenCalled();
    expect(screen.getByText('One chip is $10. Chips x spots may not exceed 200.')).toBeInTheDocument();
  });
});
