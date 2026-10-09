import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableActions, TableBar } from '@/game/table/table-controls';
import { BetOverlay } from '@/game/table/bet-overlay';
import type { BetOverlayHandlers } from '@/game/table/bet-overlay';
import type { ControlsView } from '@/game/table/controller';
import type { AvailableActions } from '@/game/engine/game';

const NONE: AvailableActions = { hit: false, stand: false, double: false, split: false, surrender: false };
const controls = (over: Partial<ControlsView> = {}): ControlsView => ({
  hidden: false,
  busy: false,
  actions: { ...NONE, hit: true, stand: true },
  insurance: false,
  canInsure: false,
  ...over,
});
const shown = () => screen.queryAllByRole('button').map(button => button.textContent);

describe('the play buttons', () => {
  it('offer the plays the hand allows, and play them', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<TableActions controls={controls()} onAction={onAction} onInsurance={vi.fn()} />);
    expect(shown()).toEqual(['Stand', 'Hit']);
    await user.click(screen.getByRole('button', { name: 'Hit' }));
    expect(onAction).toHaveBeenCalledWith('hit');
  });

  it('all hide while a timeline plays, and when the player plays by gesture', () => {
    const { rerender } = render(
      <TableActions controls={controls({ busy: true })} onAction={vi.fn()} onInsurance={vi.fn()} />,
    );
    expect(shown()).toEqual([]);
    rerender(<TableActions controls={controls({ hidden: true })} onAction={vi.fn()} onInsurance={vi.fn()} />);
    expect(shown()).toEqual([]);
  });

  it('offer Insure and Pass while insurance is offered; Insure only when it can be afforded', async () => {
    const user = userEvent.setup();
    const onInsurance = vi.fn();
    render(
      <TableActions
        controls={controls({ actions: NONE, insurance: true, canInsure: false })}
        onAction={vi.fn()}
        onInsurance={onInsurance}
      />,
    );
    expect(shown()).toEqual(['Insure', 'Pass']);
    expect(screen.getByRole('button', { name: 'Insure' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Pass' }));
    expect(onInsurance).toHaveBeenCalledWith(false);
  });

  it('the bar has Back, Stats, Error and Help', async () => {
    const user = userEvent.setup();
    const handlers = { onBack: vi.fn(), onStats: vi.fn(), onError: vi.fn(), onHelp: vi.fn() };
    render(<TableBar {...handlers} />);
    expect(shown()).toEqual(['Back', 'Stats', 'Error', 'Help']);
    await user.click(screen.getByRole('button', { name: 'Stats' }));
    expect(handlers.onStats).toHaveBeenCalled();
  });
});

describe('the betting overlay', () => {
  beforeEach(() => {
    // jsdom has no canvas; the tiles are drawn into a stand-in.
    const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as CanvasRenderingContext2D);
  });

  const handlers = (): BetOverlayHandlers => ({
    onBet: vi.fn(),
    onSideBet: vi.fn(),
    onCustomize: vi.fn(),
    onShuffle: vi.fn(),
    onResetBank: vi.fn(),
    onFoul: vi.fn(),
    onLastError: vi.fn(),
  });
  const cells = [
    { chips: 1, hands: 1, amount: 5, label: '5' },
    { chips: 2, hands: 2, amount: 10, label: '2x10' },
  ];
  const view = { visible: true, title: 'Place your bets.', cells, selected: 0, foul: false };

  it('shows the heading, a bet per tile and the side buttons; Foul only when it can be claimed', async () => {
    const user = userEvent.setup();
    const on = handlers();
    const { rerender } = render(<BetOverlay view={view} {...on} />);
    const panel = screen.getByRole('region', { name: 'Bets' });
    expect(within(panel).getByRole('heading')).toHaveTextContent('Place your bets.');
    await user.click(within(panel).getByRole('button', { name: 'Bet 2x10' }));
    expect(on.onBet).toHaveBeenCalledWith(cells[1]);
    expect(within(panel).queryByRole('button', { name: 'Foul' })).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Shuffle' }));
    expect(on.onShuffle).toHaveBeenCalled();
    rerender(<BetOverlay view={{ ...view, foul: true }} {...on} />);
    await user.click(within(panel).getByRole('button', { name: 'Foul' }));
    expect(on.onFoul).toHaveBeenCalled();
  });

  it('highlights the selected bet, and still takes taps on any bet', async () => {
    const user = userEvent.setup();
    const on = handlers();
    render(<BetOverlay view={{ ...view, selected: 1 }} {...on} />);
    expect(screen.getByRole('button', { name: 'Bet 2x10' })).toHaveAttribute('data-on');
    expect(screen.getByRole('button', { name: 'Bet 5' })).not.toHaveAttribute('data-on');
    await user.click(screen.getByRole('button', { name: 'Bet 5' }));
    expect(on.onBet).toHaveBeenCalledWith(cells[0]);
  });

  it('is hidden between bets', () => {
    render(<BetOverlay view={{ ...view, visible: false }} {...handlers()} />);
    expect(screen.queryByRole('region', { name: 'Bets' })).not.toBeInTheDocument();
  });
});
