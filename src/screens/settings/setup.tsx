// Basic Setup: seats, shoe, burn cards and bankroll.

import { toast } from '@/components/ui/toast';
import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { SettingNumber, SettingSelect, SettingsScreen } from '@/components/settings-controls';
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
        <SettingsNote>Below, highlighted seats are computer players. Click to change.</SettingsNote>
        <SeatPicker />
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
        <Button
          icon="refresh"
          block
          onClick={() => {
            app.bankroll.setState({ value: settings.get('table.startingBankroll') });
            toast('Bankroll refreshed');
          }}
        >
          Refresh Bankroll
        </Button>
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
    <CheckList
      layout="horizontal"
      aria-label="Computer players"
      items={order.map(seat => ({
        label: `#${seat}`,
        checked: seats[seat - 1],
        onChange: computer => {
          const next = settings.get('table.computerSeats').slice();
          next[seat - 1] = computer;
          settings.set('table.computerSeats', next);
        },
      }))}
    />
  );
}
