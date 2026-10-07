// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createServices } from '../../../src/app/app.ts';
import type { App, Screen } from '../../../src/app/app.ts';
import { MemoryBackend } from '../../../src/services/storage.ts';
import { GameSession } from '../../../src/game/session.ts';
import { gameStatsScreen } from '../../../src/game/screens/stats.tsx';
import { betSelectScreen } from '../../../src/game/screens/bet-select.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeApp(): App {
  const services = createServices({ backend: new MemoryBackend() });
  return { ...services, router: null as never, help: vi.fn(), open: vi.fn(), back: vi.fn(() => true) };
}

/** The value cell of the stats row labelled `label`. */
const stat = (screen: Screen, label: string) =>
  [...screen.el.querySelectorAll('.stats-table tr:not(.stats-table__head)')]
    .find(tr => tr.querySelector('th')?.textContent === label)
    ?.querySelector('td')?.textContent;

describe('statistics screen', () => {
  it('shows a placeholder without a session', () => {
    const screen = gameStatsScreen(makeApp(), {});
    expect(screen.el.className).toBe('game-stats');
    expect(screen.el.querySelector('.stats-table tbody')?.innerHTML).toBe(
      '<tr class="stats-table__head"><th>Counts</th><td>Counts</td></tr><tr><th>No session</th><td>-</td></tr>',
    );
  });

  it('shows the session, money as the app shows it, and re-reads it when shown', () => {
    const app = makeApp();
    const session = new GameSession(app);
    const screen = gameStatsScreen(app, { session });
    expect(stat(screen, 'Rounds Played')).toBe('0');
    expect(stat(screen, 'Bet Count')).toBeUndefined();
    session.stats.totalBet = 1010;
    session.stats.rounds = 2;
    act(() => screen.onShow?.());
    expect(stat(screen, 'Total Initial Bets')).toBe('$1,010');
    expect(stat(screen, 'Average Bet')).toBe('$505');
    act(() => app.settings.set('trueCount.aceSideCount', true));
    expect(stat(screen, 'Bet Count')).toBeDefined();
  });

  it('the display switches write their settings', () => {
    const app = makeApp();
    const screen = gameStatsScreen(app, {});
    const boxes = screen.el.querySelectorAll<HTMLInputElement>('.checklist input');
    expect(boxes).toHaveLength(4);
    act(() => boxes[3].click());
    expect(app.settings.get('display.showTrueCount')).toBe(true);
  });
});

describe('bet picker', () => {
  const chip = (screen: Screen, n: number) =>
    screen.el.querySelector<HTMLButtonElement>(`.bet-select__chips [data-chips="${n}"]`);

  it('limits the chips to what the chosen number of spots allows', () => {
    const app = makeApp();
    const onPick = vi.fn();
    const screen = betSelectScreen(app, { chipValue: 5, onPick });
    expect(screen.el.querySelector('.topbar__title')?.textContent).toBe('Allowed Bets');
    expect(chip(screen, 200)?.disabled).toBe(false);
    const two = screen.el.querySelector<HTMLButtonElement>('[data-hands="2"]');
    act(() => two?.click());
    expect(two?.classList.contains('is-on')).toBe(true);
    expect(screen.el.querySelector('[data-hands="1"]')?.classList.contains('is-on')).toBe(false);
    expect(chip(screen, 100)?.disabled).toBe(false);
    expect(chip(screen, 200)?.disabled).toBe(true);
    act(() => chip(screen, 3)?.click());
    expect(onPick).toHaveBeenCalledWith({ chips: 3, hands: 2, amount: 15 });
    expect(app.back).toHaveBeenCalledTimes(1);
  });

  it('a side bet is for one spot, and the handler may stay or move on itself', () => {
    const app = makeApp();
    const screen = betSelectScreen(app, { mode: 'sideBet', chipValue: 10, hands: 3, onPick: () => true });
    expect(screen.el.querySelector('.topbar__title')?.textContent).toBe('Side Bet');
    expect(screen.el.querySelector('.bet-select__hands')).toBeNull();
    act(() => chip(screen, 2)?.click());
    expect(app.back).not.toHaveBeenCalled();
    expect(screen.el.querySelector('.bet-select__body > .note:last-child')?.textContent).toBe(
      'One chip is $10. Chips x spots may not exceed 200.',
    );
  });
});
