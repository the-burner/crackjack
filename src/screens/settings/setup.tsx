// Basic Setup: seats, shoe, burn cards and bankroll.

import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useApp, useSettings } from '@/react/app-context';
import { reactScreen } from '@/react/screen';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SettingNumber, SettingSelect, SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import { DECKS } from '@/settings/schema';
import type { SettingValues } from '@/settings/schema';

const NOTE =
  'Set the basic configuation on this screen. Seats can have computer players ' +
  'or can be available for you to play. You can bet in any number of the available seats.';

const SEAT_COUNTS: readonly Option<SettingValues['table.seatCount']>[] = [
  { value: 1, label: 'One Seat' },
  { value: 2, label: 'Two Seats' },
  { value: 4, label: 'Four Seats' },
  { value: 6, label: 'Six Seats' },
];

const DECK_LABELS = [
  'Single Deck',
  'Double Deck',
  'Three Decks',
  'Four Decks',
  'Five Decks',
  'Six Decks',
  'Seven Decks',
  'Eight Decks',
];

const DECK_OPTIONS = DECKS.map((decks, i) => ({ value: decks, label: DECK_LABELS[i] }));

const SHUFFLE_MODES: readonly Option<SettingValues['table.shuffleMode']>[] = [
  { value: 'cutCard', label: 'Shuffle after a Cut Card' },
  { value: 'rounds', label: 'Shuffle after Fixed Rounds' },
];

const MAX_SEATS = 6;

/** The cut card cannot sit beyond the shoe. */
const maxCardsBehindCutCard = (decks: number) => 52 * decks - 1;

export function Setup() {
  const app = useApp();
  const settings = useSettings();
  const decks = settings.get('table.decks');
  // The shuffle point and the number of rounds share one row: which one is
  // shown depends on the shuffle mode.
  const byCutCard = settings.get('table.shuffleMode') === 'cutCard';
  return (
    <SettingsScreen title="Basic Setup" help="settings.setup" note={NOTE}>
      <SettingsGroup>
        <SettingSelect label="Seats" setting="table.seatCount" options={SEAT_COUNTS} />
        <div className="space-y-2 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Below, highlighted seats are computer players. Click to change.
          </p>
          <SeatPicker />
        </div>
      </SettingsGroup>
      <SettingsGroup>
        <SettingSelect
          label="Decks"
          setting="table.decks"
          options={DECK_OPTIONS}
          onChange={value => {
            settings.set('table.decks', value);
            settings.set(
              'table.cardsBehindCutCard',
              Math.min(settings.get('table.cardsBehindCutCard'), maxCardsBehindCutCard(value)),
            );
          }}
        />
        <SettingSelect
          label="Shuffle"
          setting="table.shuffleMode"
          options={SHUFFLE_MODES}
          onChange={value => settings.set('table.shuffleMode', value)}
        />
        <SettingNumber
          label="Shuffle Point/Cards:"
          setting="table.cardsBehindCutCard"
          prompt="Cards after the cut card"
          clamp={value => Math.min(value, maxCardsBehindCutCard(decks))}
          hidden={!byCutCard}
        />
        <SettingNumber label="Rounds:" setting="table.roundsPerShoe" prompt="Rounds" hidden={byCutCard} />
        <SettingNumber label="Burn Cards:" setting="table.burnCards" prompt="Burn Cards" />
        <SettingNumber label="Starting Bankroll:" setting="table.startingBankroll" prompt="Starting Bankroll" />
        <div className="px-4 py-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              app.bankroll.setState({ value: settings.get('table.startingBankroll') });
              toast('Bankroll refreshed');
            }}
          >
            <RefreshCwIcon />
            Refresh Bankroll
          </Button>
        </div>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/** Segmented control showing seats 6..1; a highlighted seat is a computer player. */
function SeatPicker() {
  const settings = useSettings();
  const seats = settings.get('table.computerSeats');
  const order = Array.from({ length: MAX_SEATS }, (_, i) => MAX_SEATS - i);
  return (
    <ToggleGroup
      multiple
      variant="outline"
      spacing={0}
      aria-label="Computer players"
      className="w-full"
      value={order.filter(seat => seats[seat - 1]).map(String)}
      onValueChange={(value: string[]) => {
        const next = settings.get('table.computerSeats').slice();
        for (const seat of order) next[seat - 1] = value.includes(String(seat));
        settings.set('table.computerSeats', next);
      }}
    >
      {order.map(seat => (
        <ToggleGroupItem
          key={seat}
          value={String(seat)}
          className="flex-1 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
        >
          {`#${seat}`}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export const setupScreen = reactScreen(Setup);
