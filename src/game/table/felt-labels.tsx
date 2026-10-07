// The labels laid over the felt where the layout puts them: the bankroll, the
// count readout, and one chip label per seat with its result as a pill.

import { cn } from '@/lib/utils';
import { dollars } from '@/core/money';
import { boxStyle } from './labels';
import type { Box } from './layout';
import type { SeatLabel } from './controller';

const LABEL =
  'pointer-events-none absolute flex items-center justify-center whitespace-nowrap font-semibold leading-normal [text-shadow:0_1px_2px_var(--text-shadow)]';

export function Bankroll({ box, amount }: { box: Box | undefined; amount: number }) {
  return (
    <div
      className={cn(
        LABEL,
        'overflow-hidden text-[20px]',
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
      className={cn(LABEL, 'justify-start overflow-hidden text-[16px] text-(--table-accent) [text-shadow:none]')}
      style={box && boxStyle({ ...box, y: box.y + box.height + 2 })}
      data-testid="counts"
    >
      {text}
    </div>
  );
}

/** A hand's result: the same pill as the app's pop-ups, and the same tones. */
function ResultPill({ result, tone }: Pick<SeatLabel, 'result' | 'tone'>) {
  return (
    <span
      className={cn(
        'flex-none animate-result-in rounded-full px-3.5 py-1.5 text-[14px] font-medium whitespace-nowrap shadow-[0_6px_24px_var(--dialog-shadow)] [text-shadow:none]',
        tone === 'win'
          ? 'bg-(--tile-good) text-(--tile-mark-text)'
          : tone === 'lose'
            ? 'bg-(--tile-bad) text-(--toast-error-text)'
            : 'bg-(--text) text-(--page-bg)',
      )}
      data-testid="seat-result"
      data-tone={tone}
    >
      {result}
    </span>
  );
}

export function SeatChip({ seat, box, text, result, tone }: SeatLabel) {
  return (
    <div
      // The label box is sized for a bet amount, so a result pill is let out of it.
      className={cn(LABEL, 'text-[16px] text-(--table-text)', result ? 'z-[6] overflow-visible' : 'overflow-hidden')}
      style={boxStyle(box)}
      data-testid="seat-chip"
      data-seat={seat}
    >
      {result ? <ResultPill key={`${result}-${tone}`} result={result} tone={tone} /> : text}
    </div>
  );
}
