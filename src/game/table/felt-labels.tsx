// The labels laid over the felt where the layout puts them: the bankroll, the
// count readout, and one chip label per seat with its result as a pill.

import { CircleCheckIcon, OctagonXIcon } from 'lucide-react';
import { cn } from 'cn';
import { dollars } from '@/core/money';
import { boxStyle } from './labels';
import type { Box } from './layout';
import type { SeatLabel } from './controller';

const LABEL =
  'pointer-events-none absolute flex items-center justify-center whitespace-nowrap font-semibold [text-shadow:0_1px_2px_var(--text-shadow)]';

export function Bankroll({ box, amount }: { box: Box | undefined; amount: number }) {
  return (
    <div
      className={cn(
        LABEL,
        'overflow-hidden text-xl',
        amount < 0 ? 'text-(--bankroll-negative)' : 'text-(--table-text)',
      )}
      style={box && boxStyle(box)}
      data-testid="bankroll"
    >
      {dollars(amount)}
    </div>
  );
}

/** The count readout, just under the status band. */
export function Counts({ box, text }: { box: Box | undefined; text: string }) {
  return (
    <div
      className={cn(LABEL, 'justify-start overflow-hidden text-base text-(--table-accent) [text-shadow:none]')}
      style={box && boxStyle({ ...box, y: box.y + box.height + 2 })}
      data-testid="counts"
    >
      {text}
    </div>
  );
}

/** A hand's result, the same pill as the table's pop-ups. */
function ResultPill({ result, tone }: Pick<SeatLabel, 'result' | 'tone'>) {
  const Icon = tone === 'win' ? CircleCheckIcon : tone === 'lose' ? OctagonXIcon : null;
  return (
    <span
      className={cn(
        'inline-flex flex-none animate-in items-center gap-1.5 rounded-(--radius) px-3 py-1.5 font-sans text-[13px] font-medium whitespace-nowrap shadow-lg duration-200 fade-in slide-in-from-bottom-1 [text-shadow:none]',
        // The pop-ups' tones: a win and a loss as success and error toasts.
        tone === 'win'
          ? 'bg-(--tile-good) text-(--tile-mark-text)'
          : tone === 'lose'
            ? 'bg-(--tile-bad) text-(--tile-mark-text)'
            : 'bg-popover text-popover-foreground',
      )}
      data-testid="seat-result"
      data-tone={tone}
    >
      {Icon && <Icon className="size-4" />}
      {result}
    </span>
  );
}

export function SeatChip({ seat, box, text, result, tone }: SeatLabel) {
  return (
    <div
      // The label box is sized for a bet amount, so a result pill is let out of it.
      className={cn(LABEL, 'text-base text-(--table-text)', result ? 'z-[6] overflow-visible' : 'overflow-hidden')}
      style={boxStyle(box)}
      data-testid="seat-chip"
      data-seat={seat}
    >
      {result ? <ResultPill key={`${result}-${tone}`} result={result} tone={tone} /> : text}
    </div>
  );
}
