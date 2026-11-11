// The seats at the table, drawn as the game draws them: bet circles along the arc below the dealer, on
// a felt of the theme's green, seat 1 at the right. A filled circle is the player's, an outlined one a computer player's;
// a seat the table cannot show (held upright) is faded and struck through. Seats move along the arc as
// their number changes (lib/seat-arc.ts).

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { arcAtRest, arcFrame, pointAt } from '@/lib/seat-arc';
import type { ArcSeat } from '@/lib/seat-arc';

/** The seats as drawn, moving along the arc to `seatCount` of them whenever it changes. */
function useArc(seatCount: number): ArcSeat[] {
  const [frame, setFrame] = useState(() => arcAtRest(seatCount));
  const shown = useRef(frame);
  useEffect(() => {
    const from = shown.current;
    const show = (seats: ArcSeat[]) => {
      shown.current = seats;
      setFrame(seats);
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      show(arcAtRest(seatCount));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const { seats, done } = arcFrame(from, seatCount, now - start);
      show(seats);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seatCount]);
  return frame;
}

export interface SeatState {
  yours: boolean;
  /** Not shown at the table as the device is held. */
  hidden?: boolean;
}

export function SeatTable({
  seats,
  seatCount,
  onToggle,
  label,
}: {
  /** Every seat a table can have, seat 1 first; the first `seatCount` are at the table. */
  seats: readonly SeatState[];
  seatCount: number;
  onToggle: (seat: number) => void;
  label: string;
}) {
  const frame = useArc(seatCount);
  return (
    // As wide as the column, measured in its width (cqw): a padded rail 3.5 wide all round, and the felt inside
    // it, a half circle under rounded top corners. Each of the rail's radii is the felt's plus the rail, so the
    // rail is as wide everywhere; the felt's edge is a solid line drawn inside it, as even as its radii.
    <div className="@container w-full">
      <div className="rounded-t-[7.5cqw] rounded-b-[50cqw] bg-(--seat-rail) p-[3.5cqw]">
        <div
          role="group"
          aria-label={label}
          data-slot="seat-table"
          className="relative h-[50.5cqw] w-full overflow-hidden rounded-t-[4cqw] rounded-b-[46.5cqw] bg-(--seat-felt) shadow-[inset_0_0_0_2px_var(--seat-edge)]"
        >
          <span className="absolute top-[6%] left-1/2 -translate-x-1/2 text-caption font-semibold tracking-[0.04em] text-(--seat-text) uppercase">
            Dealer
          </span>
          {frame.map(({ seat, angle, opacity }) => {
            const leaving = seat > seatCount;
            const { yours, hidden } = seats[seat - 1];
            const { x, y } = pointAt(angle);
            return (
              <button
                key={seat}
                type="button"
                aria-pressed={yours}
                aria-label={`Seat ${seat}, ${yours ? 'yours' : 'computer'}${hidden ? ', not shown upright' : ''}`}
                aria-hidden={leaving || undefined}
                tabIndex={leaving ? -1 : undefined}
                onClick={leaving ? undefined : () => onToggle(seat)}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: hidden ? opacity * 0.45 : opacity }}
                className={cn(
                  'absolute flex size-11 -translate-1/2 cursor-pointer items-center justify-center rounded-full border-[3px] border-(--seat-ring) text-body font-semibold tabular-nums',
                  'engaged:brightness-110 active:scale-95',
                  leaving && 'pointer-events-none',
                  yours ? 'bg-(--seat-ring) text-(--seat-mine-text)' : 'bg-transparent text-(--seat-text)',
                  hidden &&
                    'after:absolute after:inset-x-[-4px] after:top-1/2 after:h-[3px] after:-rotate-45 after:bg-(--seat-ring)',
                )}
              >
                {seat}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
