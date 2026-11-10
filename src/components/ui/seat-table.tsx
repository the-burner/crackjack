// The seats at the table, drawn as the game draws them: bet circles along the arc below the dealer, on
// plain felt (the photo's printed rules could contradict the table's), seat 1 at the right. A filled circle is the player's, an outlined one a computer player's;
// a seat the table cannot show (held upright) is faded and struck through. Seats slide as their number changes.

import { cn } from '@/lib/utils';
import { seatPositions } from '@/lib/seat-arc';

export interface SeatState {
  yours: boolean;
  /** Not shown at the table as the device is held. */
  hidden?: boolean;
}

export function SeatTable({
  seats,
  onToggle,
  label,
}: {
  /** One per seat at the table, seat 1 first. */
  seats: readonly SeatState[];
  onToggle: (seat: number) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="seat-table"
      className="relative mx-auto my-2.5 aspect-[2/1] w-[calc(100%-1.75rem)] max-w-[340px] overflow-hidden rounded-b-full border-x-2 border-b-2 border-(--bet-circle)/40 bg-(--felt-fallback)"
    >
      <span className="absolute top-[6%] left-1/2 -translate-x-1/2 text-caption font-semibold tracking-[0.04em] text-(--bet-circle) uppercase">
        Dealer
      </span>
      {seatPositions(seats.length).map(({ seat, x, y }) => {
        const { yours, hidden } = seats[seat - 1];
        return (
          <button
            key={seat}
            type="button"
            aria-pressed={yours}
            aria-label={`Seat ${seat}, ${yours ? 'yours' : 'computer'}${hidden ? ', not shown upright' : ''}`}
            onClick={() => onToggle(seat)}
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
            className={cn(
              'absolute flex size-11 -translate-1/2 cursor-pointer items-center justify-center rounded-full border-[3px] border-(--bet-circle) text-body font-semibold tabular-nums transition-[left,top,opacity] duration-300 motion-reduce:transition-none',
              'engaged:brightness-110 active:scale-95',
              yours ? 'bg-(--bet-circle) text-(--felt-fallback)' : 'bg-transparent text-(--bet-circle)',
              hidden &&
                'opacity-45 after:absolute after:inset-x-[-4px] after:top-1/2 after:h-[3px] after:-rotate-45 after:bg-(--bet-circle)',
            )}
          >
            {seat}
          </button>
        );
      })}
    </div>
  );
}
