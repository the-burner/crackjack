// Basic Setup: seats, shoe, burn cards and bankroll.

import { h } from '../../ui/dom.js';
import { button, checkList } from '../../ui/components.js';
import { alert } from '../../ui/dialogs.js';
import { DECKS } from '../../settings/schema.js';
import { group, settingsScreen } from './controls.js';

/** Storage key holding the current bankroll, which the game screen restores. */
const BANKROLL_KEY = 'bankroll';

const NOTE = 'Set the basic configuation on this screen. Seats can have computer players '
  + 'or can be available for you to play. You can bet in any number of the available seats.';

const SEAT_COUNTS = [
  { value: 1, label: 'One Seat' },
  { value: 2, label: 'Two Seats' },
  { value: 4, label: 'Four Seats' },
  { value: 6, label: 'Six Seats' },
];

const DECK_LABELS = ['Single Deck', 'Double Deck', 'Three Decks', 'Four Decks', 'Five Decks', 'Six Decks', 'Seven Decks', 'Eight Decks'];

const SHUFFLE_MODES = [
  { value: 'cutCard', label: 'Shuffle after a Cut Card' },
  { value: 'rounds', label: 'Shuffle after Fixed Rounds' },
];

const MAX_SEATS = 6;

export function setupScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Basic Setup', help: 'settings.setup', note: NOTE });
  const settings = app.settings;

  /** The cut card cannot sit beyond the shoe. */
  const maxCardsBehindCutCard = () => 52 * settings.get('table.decks') - 1;
  const clampCutCard = () => settings.set('table.cardsBehindCutCard',
    Math.min(settings.get('table.cardsBehindCutCard'), maxCardsBehindCutCard()));

  // The shuffle point and the number of rounds share one row: which one is
  // shown depends on the shuffle mode.
  const cutCardRow = form.number('Shuffle Point/Cards:', 'table.cardsBehindCutCard', {
    prompt: 'Cards after the cut card',
    clamp: value => Math.min(value, maxCardsBehindCutCard()),
  });
  const roundsRow = form.number('Rounds:', 'table.roundsPerShoe', { prompt: 'Rounds' });
  const showShuffleRow = () => {
    const byCutCard = settings.get('table.shuffleMode') === 'cutCard';
    cutCardRow.hidden = !byCutCard;
    roundsRow.hidden = byCutCard;
  };

  columns.append(
    group(
      form.select('table.seatCount', SEAT_COUNTS),
      h('p', { class: 'note settings-note' }, 'Below, blue seats are computer players. Click to change.'),
      seatPicker(app),
    ),
    group(
      form.select('table.decks', DECKS.map((decks, i) => ({ value: decks, label: DECK_LABELS[i] })), {
        onChange: (key, value) => { settings.set(key, value); clampCutCard(); form.refresh(); },
      }),
      form.select('table.shuffleMode', SHUFFLE_MODES, { onChange: (key, value) => { settings.set(key, value); showShuffleRow(); } }),
      cutCardRow,
      roundsRow,
      form.number('Burn Cards:', 'table.burnCards', { prompt: 'Burn Cards' }),
      form.number('Starting Bankroll:', 'table.startingBankroll', { prompt: 'Starting Bankroll' }),
      button('Refresh Bankroll', { icon: 'refresh', block: true, onClick: () => refreshBankroll(app) }),
    ),
  );
  showShuffleRow();
  return { el };
}

/** Segmented control showing seats 6..1; a highlighted seat is a computer player. */
function seatPicker(app) {
  const seats = () => app.settings.get('table.computerSeats');
  const items = [];
  for (let seat = MAX_SEATS; seat >= 1; seat -= 1) {
    items.push({
      label: `#${seat}`,
      checked: seats()[seat - 1],
      onChange: computer => {
        const next = seats().slice();
        next[seat - 1] = computer;
        app.settings.set('table.computerSeats', next);
      },
    });
  }
  return checkList(items, { horizontal: true });
}

async function refreshBankroll(app) {
  app.storage.set(BANKROLL_KEY, app.settings.get('table.startingBankroll'));
  await alert('Done.');
}
