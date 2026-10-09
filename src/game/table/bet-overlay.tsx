// The betting overlay shown between rounds: a panel over the felt with one
// button per bet the player's ramp allows, and the buttons for side bets, the
// bet editor, shuffling, the bankroll, a Foul claim and the last strategy error.
// One gap separates every button, row and column.

import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import type { BetCell } from './bet-grid';
import type { BetOverlayView } from './controller';

export interface BetOverlayHandlers {
  onBet: (bet: BetCell) => void;
  onSideBet: () => void;
  onCustomize: () => void;
  onShuffle: () => void;
  onResetBank: () => void;
  onFoul: () => void;
  onLastError: () => void;
}

function OverlayButton({
  label,
  icon,
  action,
  onClick,
  hidden,
}: {
  label: string;
  icon: IconName;
  action: string;
  onClick: () => void;
  hidden?: boolean;
}) {
  return (
    <Button
      icon={icon}
      // Three a row; a shorter last row is centred.
      className="min-h-10 flex-[0_0_calc((100%-8px)/3)] py-1 pr-[26px] pl-1.5 text-caption [&>[data-slot=icon]]:right-2 [&>[data-slot=icon]]:size-3.5"
      onClick={onClick}
      hidden={hidden}
      data-action={action}
    >
      {label}
    </Button>
  );
}

export function BetOverlay({
  view: { visible, title, cells, selected, foul },
  ...handlers
}: { view: BetOverlayView } & BetOverlayHandlers) {
  return (
    <section
      hidden={!visible}
      aria-label="Bets"
      data-slot="bet-overlay"
      className="@container absolute bottom-1.5 left-1/2 z-10 flex w-[min(598px,calc(100%-8px))] -translate-x-1/2 flex-col gap-1 rounded-(--radius) bg-(--page-bg) p-1.5"
    >
      <h2 className="m-0 pt-0.5 text-center text-title font-semibold text-(--text)">{title}</h2>
      <div role="group" aria-label="Bet amounts" data-testid="bet-grid" className="grid grid-cols-6 gap-1">
        {cells.map((cell, i) => (
          <Button
            key={i}
            aria-label={`Bet ${cell.label}`}
            // The highlighted bet: the last one placed, until a swipe moves it.
            data-on={i === selected || undefined}
            className="h-[clamp(38px,14cqw,62px)] min-h-0 px-0 py-0 text-body tabular-nums min-[460px]:text-[20px] data-on:bg-(--check-on) data-on:text-(--check-on-text) data-on:engaged:bg-(--check-on) data-on:engaged:brightness-90"
            onClick={() => handlers.onBet(cell)}
          >
            {cell.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        <OverlayButton label="Side Bet" icon="plus" action="side-bet" onClick={handlers.onSideBet} />
        <OverlayButton label="Reset Bank" icon="refresh" action="reset-bank" onClick={handlers.onResetBank} />
        <OverlayButton label="Shuffle" icon="arrow-r" action="shuffle" onClick={handlers.onShuffle} />
        <OverlayButton label="Customize" icon="grid" action="customize" onClick={handlers.onCustomize} />
        <OverlayButton label="Last Error" icon="info" action="last-error" onClick={handlers.onLastError} />
        <OverlayButton label="Foul" icon="minus" action="foul" onClick={handlers.onFoul} hidden={!foul} />
      </div>
    </section>
  );
}
