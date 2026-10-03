// Flash Drills: Options.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { alert, confirm } from '../../ui/dialogs.js';
import { drillOptionsScreen, group, row, withButton, TIMER_MODE_OPTIONS } from '../shared/options-screen.js';
import { drillStrategy } from '../shared/drill-settings.js';
import { buildHandList, SITUATIONS, SITUATION_LABELS, errorCellsAsHands, describeEntry } from './logic.js';

const HANDS_OPTIONS = [
  { value: 'default', label: 'Hands: Default Hands' },
  { value: 'illustrious18', label: 'Hands: Illustrious 18' },
  { value: 'withIndices', label: 'Hands: Hands with Indices' },
  { value: 'drillErrors', label: 'Hands: Drill Errors' },
  { value: 'custom', label: 'Hands: Custom' },
];

const COUNT_OPTIONS = [
  { value: 'zero', label: 'Count: Always Zero' },
  { value: 'random', label: 'Count: Random' },
  { value: 'fixed', label: 'Count: Set Count to:' },
  { value: 'indexTest', label: 'Count: Index Test' },
];

const CARDS_OPTIONS = [
  { value: 2, label: 'Cards: Two' },
  { value: 3, label: 'Cards: Two or Three' },
  { value: 4, label: 'Cards: Two to Four' },
  { value: 5, label: 'Cards: Two to Five' },
];

const TEST_MODE_OPTIONS = [
  { value: 'warn', label: 'Test Mode: Warn on error' },
  { value: 'errorsAtEnd', label: 'Test Mode: Number of errors only at end' },
  { value: 'none', label: 'Test Mode: No tests (quick drill)' },
];

const DECK_NAMES = ['Single', 'Double', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** Normal decks first, then the Spanish decks (3 to 8), which have no tens. */
const DECK_OPTIONS = [
  ...DECK_NAMES.map((name, i) => ({ value: `${i + 1}`, label: `${name} Deck${i ? 's' : ''}` })),
  ...DECK_NAMES.slice(2).map((name, i) => ({ value: `${i + 3}s`, label: `${name} Spanish Decks` })),
];

const SITUATION_ITEMS = SITUATIONS.map(flag => ({ flag, label: SITUATION_LABELS[flag] }));

export function flashOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Flash Options', help: 'drills.flash.options', drill: 'drills.flash',
    onLaunch: () => launch(app),
  });
  const { form } = screen;
  const handNote = h('div', { class: 'note drill-options__note' });

  const deckSelect = form.custom('decks', DECK_OPTIONS,
    () => `${form.get('decks')}${form.get('spanishDecks') ? 's' : ''}`,
    value => {
      form.set('decks', Number.parseInt(value, 10));
      form.set('spanishDecks', value.endsWith('s'));
    });

  const customHands = () => app.open('strategy.tables', {
    mode: 'editMask', maskKey: 'drills.flash.customHands',
    decks: form.get('decks'), title: 'Custom Hands',
  });

  screen.append(
    group(
      form.select('maxCards', CARDS_OPTIONS),
      deckSelect,
      withButton(form.select('hands', HANDS_OPTIONS), button('Select', { onClick: customHands })),
      withButton(form.select('countMode', COUNT_OPTIONS), form.number('Count', 'fixedCount', { prompt: 'Count' })),
      form.select('testMode', TEST_MODE_OPTIONS),
      withButton(form.select('timerMode', TIMER_MODE_OPTIONS), form.number('Rounds', 'handsPerDrill', { prompt: 'Rounds' })),
    ),
    handNote,
    h('div', { class: 'note' }, 'Situations'),
    form.flags('situations', SITUATION_ITEMS.slice(0, 3), { horizontal: true }),
    form.flags('situations', SITUATION_ITEMS.slice(3), { horizontal: true }),
    row('Seconds:', form.slider('', 'seconds')),
    form.checks([{ label: 'Progressive Speed', key: 'progressiveSpeed' }]),
    button('Clear error history', { icon: 'back', onClick: () => clearErrors(app, showHandNote) }),
  );

  /** Explains what the chosen hand list contains. */
  function showHandNote() {
    const hands = form.get('hands');
    if (hands === 'drillErrors') {
      const entries = errorCellsAsHands(app.errorTallies.cells());
      handNote.textContent = entries.length
        ? `${entries.length} hand${entries.length === 1 ? '' : 's'} with recorded errors; most often ${describeEntry(entries[0])}.`
        : 'No errors have been recorded yet.';
    } else {
      handNote.textContent = hands === 'custom' ? 'Use Select to pick the hands to drill.' : '';
    }
  }

  form.watch(showHandNote);

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}

async function clearErrors(app, after) {
  if (!(await confirm('Delete the record of all drill errors?'))) return;
  app.errorTallies.clear();
  after();
  await alert('Done.');
}

/** Checks the options and opens the drill. */
async function launch(app) {
  const s = app.settings;
  const situations = s.get('drills.flash.situations');
  if (!SITUATIONS.some(key => situations[key])) {
    await alert('No situations have been selected.');
    return;
  }
  if (s.get('drills.flash.testMode') === 'none' && s.get('drills.flash.timerMode') !== 'auto') {
    await alert('If you do not set Test Mode to Warn on error, you must set Timer Mode to Auto.');
    return;
  }
  const { strategy } = drillStrategy(app, s.get('drills.flash.decks'));
  const { error } = buildHandList({
    hands: s.get('drills.flash.hands'),
    situations,
    strategy,
    customMask: s.get('drills.flash.customHands'),
    tallies: app.errorTallies.load(),
  });
  if (error) {
    await alert(error);
    return;
  }
  app.open('drills.flash');
}
