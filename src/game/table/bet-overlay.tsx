// The betting overlay shown between rounds: a panel over the felt with one
// button per bet the player's ramp allows, and the buttons for sitting out (Wong),
// the bankroll, shuffling, side bets, the bet editor and a Foul claim.
// One gap separates every button, row and column.

import { Button } from '@/components/ui/button';
import type { IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { overlayButtons } from './bet-grid';
import type { BetCell, OverlayButtonName } from './bet-grid';
import type { BetOverlayView } from './controller';

export interface BetOverlayHandlers {
  onBet: (bet: BetCell) => void;
  onSideBet: () => void;
  onCustomize: () => void;
  onShuffle: () => void;
  onResetBank: () => void;
  onFoul: () => void;
  onWong: () => void;
}

/** Each button's label, icon and handler. */
const BUTTONS: Record<
  OverlayButtonName,
  { label: string; icon: IconName; handler: Exclude<keyof BetOverlayHandlers, 'onBet'> }
> = {
  wong: { label: 'Wong', icon: 'forward', handler: 'onWong' },
  resetBank: { label: 'Reset Bank', icon: 'refresh', handler: 'onResetBank' },
  shuffle: { label: 'Shuffle', icon: 'shuffle', handler: 'onShuffle' },
  // These two open screens of their own.
  sideBet: { label: 'Side Bet', icon: 'arrow-r', handler: 'onSideBet' },
  customize: { label: 'Customize', icon: 'arrow-r', handler: 'onCustomize' },
  foul: { label: 'Foul', icon: 'minus', handler: 'onFoul' },
};

/** The highlight a gesture moves, on a bet or a button. */
const HIGHLIGHT =
  'data-on:bg-(--check-on) data-on:text-(--check-on-text) data-on:engaged:bg-(--check-on) data-on:engaged:brightness-90';

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
            // The highlight: on the last bet placed, until a swipe moves it.
            data-on={i === selected || undefined}
            className={cn(
              'h-[clamp(38px,14cqw,62px)] min-h-0 px-0 py-0 text-body tabular-nums min-[460px]:text-[20px]',
              HIGHLIGHT,
            )}
            onClick={() => handlers.onBet(cell)}
          >
            {cell.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        {overlayButtons(foul).map((name, i) => {
          const { label, icon, handler } = BUTTONS[name];
          return (
            <Button
              key={name}
              icon={icon}
              data-on={cells.length + i === selected || undefined}
              // Three a row; a shorter last row is centred.
              className={cn(
                'min-h-10 flex-[0_0_calc((100%-8px)/3)] py-1 pr-[26px] pl-1.5 text-caption [&>[data-slot=icon]]:right-2 [&>[data-slot=icon]]:size-3.5',
                HIGHLIGHT,
              )}
              onClick={() => handlers[handler]()}
              data-action={name}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
