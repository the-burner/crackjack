// Seats: how many seats the table has, which are the player's (the others are computer players'), and whether
// other players come and go.

import { useSettings } from '@/react/app-context';
import { useUpright } from '@/react/upright';
import { SeatTable } from '@/components/ui/seat-table';
import { toast } from '@/components/ui/toast';
import { Section, SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { SettingChecks, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import type { SettingValues } from '@/settings/schema';
import { MAX_PORTRAIT_SEATS, visibleSeats } from '@/game/table/layout';

const SEAT_COUNTS: readonly Option<SettingValues['table.seatCount']>[] = [
  { value: 1, label: 'One Seat' },
  { value: 2, label: 'Two Seats' },
  { value: 4, label: 'Four Seats' },
  { value: 6, label: 'Six Seats' },
];

export function Seats() {
  const settings = useSettings();
  const upright = useUpright();
  const seatCount = settings.get('table.seatCount');
  return (
    <SettingsScreen title="Seats" help="game.seats">
      <Section title="Seats">
        <SettingsGroup>
          <SettingSelect
            label="Seats"
            setting="table.seatCount"
            options={SEAT_COUNTS}
            onChange={count =>
              settings.update({
                'table.seatCount': count,
                'table.computerSeats': withPlayerSeat(settings.get('table.computerSeats'), count),
              })
            }
          />
        </SettingsGroup>
      </Section>
      {/* The table is drawn on the page itself, under what it shows. */}
      <div>
        <SettingsNote>{seatsNote(seatCount, upright)}</SettingsNote>
        <SeatPicker upright={upright} />
      </div>
      <SettingsGroup>
        <SettingChecks items={[{ label: 'Players come and go', key: 'table.playersComeAndGo' }]} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

/** The seats at the table, the player's highlighted; the player keeps at least one. */
function SeatPicker({ upright }: { upright: boolean }) {
  const settings = useSettings();
  const seatCount = settings.get('table.seatCount');
  const computer = settings.get('table.computerSeats');
  const shown = new Set(visibleSeats({ seatCount, humanSeats: humanSeats(computer, seatCount), portrait: upright }));
  return (
    <SeatTable
      label="Seats at the table"
      seats={computer.map((isComputer, i) => ({ yours: !isComputer, hidden: i < seatCount && !shown.has(i + 1) }))}
      seatCount={seatCount}
      onToggle={seat => {
        const next = computer.slice();
        next[seat - 1] = !next[seat - 1];
        if (humanSeats(next, seatCount).length === 0) {
          toast('You need at least one seat of your own.', { tone: 'error' });
          return;
        }
        settings.set('table.computerSeats', next);
      }}
    />
  );
}

/** The player's seats among the first `seatCount`, numbered from 1. */
const humanSeats = (computer: readonly boolean[], seatCount: number) =>
  computer.flatMap((isComputer, i) => (i < seatCount && !isComputer ? [i + 1] : []));

/** `computer` with seat 1 the player's if a table of `seatCount` would leave them none. */
export const withPlayerSeat = (computer: readonly boolean[], seatCount: number): boolean[] =>
  humanSeats(computer, seatCount).length
    ? [...computer]
    : computer.map((isComputer, i) => (i === 0 ? false : isComputer));

/** What the seats drawing shows, and (held upright with more seats than fit) which ones the table leaves out. */
export function seatsNote(seatCount: number, upright: boolean): string {
  const note = 'Highlighted seats are yours; the others are computer players. Tap a seat to change it.';
  return upright && seatCount > MAX_PORTRAIT_SEATS
    ? `${note} Held upright, the table shows ${MAX_PORTRAIT_SEATS} of the ${seatCount} seats: yours first, then the nearest from seat 1.`
    : note;
}
