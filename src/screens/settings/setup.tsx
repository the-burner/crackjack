// Basic Setup: seats, shoe, burn cards and bankroll.

import { useApp, useSettings } from '../../react/app-context.ts';
import { Button, CheckList } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';
import { SettingNumber, SettingSelect, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import { DECKS } from '../../settings/schema.ts';
import type { SettingValues } from '../../settings/schema.ts';
import type { SelectOption } from '../../ui/components.ts';
import { toast } from '../../ui/toast.ts';

/** Storage key holding the current bankroll, which the game screen restores. */
const BANKROLL_KEY = 'bankroll';

const NOTE =
  'Set the basic configuation on this screen. Seats can have computer players ' +
  'or can be available for you to play. You can bet in any number of the available seats.';

const SEAT_COUNTS: readonly SelectOption<SettingValues['table.seatCount']>[] = [
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

const SHUFFLE_MODES: readonly SelectOption<SettingValues['table.shuffleMode']>[] = [
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
        <SettingSelect setting="table.seatCount" options={SEAT_COUNTS} />
        <p className="note settings-note">Below, highlighted seats are computer players. Click to change.</p>
        <SeatPicker />
      </SettingsGroup>
      <SettingsGroup>
        <SettingSelect
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
            app.storage.set(BANKROLL_KEY, settings.get('table.startingBankroll'));
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
  const items = [];
  for (let seat = MAX_SEATS; seat >= 1; seat -= 1) {
    items.push({
      label: `#${seat}`,
      checked: Boolean(seats[seat - 1]),
      onChange: (computer: boolean) => {
        const next = settings.get('table.computerSeats').slice();
        next[seat - 1] = computer;
        settings.set('table.computerSeats', next);
      },
    });
  }
  return <CheckList horizontal items={items} />;
}

export const setupScreen = reactScreen(Setup, { className: 'settings' });
