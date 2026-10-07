// @ts-nocheck
// Flash Drills: Options.

import { button } from '../../ui/components.ts';
import { alert, confirm } from '../../ui/dialogs.ts';
import { toast } from '../../ui/toast.ts';
import { drillOptionsScreen, group, section, withButton, COUNT_DOWN_HALT_OPTION } from '../shared/options-screen.ts';
import { drillStrategy } from '../shared/drill-settings.ts';
import { buildHandList, SITUATIONS, SITUATION_LABELS, errorCellsAsHands, describeEntry } from './logic.ts';

const HANDS_OPTIONS = [
  { value: 'default', label: 'Hands: Default Hands' },
  { value: 'illustrious18', label: 'Hands: Illustrious 18' },
  { value: 'withIndices', label: 'Hands: Hands with Indices' },
  { value: 'drillErrors', label: 'Hands: Drill Errors' },
  { value: 'custom', label: 'Hands: Custom' },
  { value: 'roundRobin', label: 'Hands: Round Robin' },
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

/**
 * Rounds: a set number of hands. Count Down & Halt: until the drill time runs
 * out. Infinite: until stopped, with the time counting up.
 */
const FLASH_TIMER_OPTIONS = [
  { value: 'auto', label: 'Timer Mode: Rounds' },
  COUNT_DOWN_HALT_OPTION,
  { value: 'infinite', label: 'Timer Mode: Infinite' },
];

/** Timer modes in which each hand may have a time limit. */
const TIMED_HAND_MODES = ['auto', 'infinite'];

export function flashOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Flash Options',
    help: 'drills.flash.options',
    drill: 'drills.flash',
    onLaunch: () => launch(app),
  });
  const { form } = screen;

  /** Only Warn on error shows error pop-ups, so only it can make them non-blocking. */
  const nonBlockingToggle = form.checks([{ label: 'Non-blocking error pop-ups', key: 'nonBlockingErrors' }]);
  /** The set count; only Count: Set Count to: uses it. */
  const countButton = form.number('Count', 'fixedCount', { prompt: 'Count' });
  // Rounds and Infinite may time each hand; Count Down & Halt times the whole drill.
  const roundsButton = form.number('Rounds', 'handsPerDrill', { prompt: 'Rounds' });
  const perHandToggle = form.checks([{ label: 'Time limit per hand', key: 'timePerHand' }]);
  const perHandRow = form.duration('Time per hand', 'seconds');
  const progressiveRow = form.checks([{ label: 'Progressive Speed', key: 'progressiveSpeed' }]);
  const drillTimeRow = form.duration('Drill time', 'drillSeconds');
  form.watch(() => {
    const mode = form.get('timerMode');
    const handsCanBeTimed = TIMED_HAND_MODES.includes(mode);
    const handsTimed = handsCanBeTimed && form.get('timePerHand');
    countButton.hidden = form.get('countMode') !== 'fixed';
    nonBlockingToggle.hidden = form.get('testMode') !== 'warn';
    roundsButton.hidden = mode !== 'auto';
    perHandToggle.hidden = !handsCanBeTimed;
    perHandRow.hidden = !handsTimed;
    // Progressive Speed shortens the time per hand, so it goes with it.
    progressiveRow.hidden = !handsTimed;
    drillTimeRow.hidden = mode !== 'countDownHalt';
  });

  const deckSelect = form.custom(
    'decks',
    DECK_OPTIONS,
    () => `${form.get('decks')}${form.get('spanishDecks') ? 's' : ''}`,
    value => {
      form.set('decks', Number.parseInt(value, 10));
      form.set('spanishDecks', value.endsWith('s'));
    },
  );

  /** Picks the custom hands; only shown when the hand list is Custom. */
  const selectButton = button('Select', { onClick: () => customHands() });
  const customHands = () =>
    app.open('strategy.tables', {
      mode: 'editMask',
      maskKey: 'drills.flash.customHands',
      decks: form.get('decks'),
      title: 'Custom Hands',
    });

  screen.append(
    section(
      'Drill',
      group(
        form.select('maxCards', CARDS_OPTIONS),
        deckSelect,
        withButton(form.select('hands', HANDS_OPTIONS), selectButton),
        withButton(form.select('countMode', COUNT_OPTIONS), countButton),
        form.select('testMode', TEST_MODE_OPTIONS),
        nonBlockingToggle,
      ),
    ),
    section('Situations', form.flags('situations', SITUATION_ITEMS, { chips: true })),
    section(
      'Timer',
      group(
        withButton(form.select('timerMode', FLASH_TIMER_OPTIONS), roundsButton),
        perHandToggle,
        perHandRow,
        progressiveRow,
        drillTimeRow,
      ),
    ),
    section(
      'Error History',
      group(
        button('Error history', {
          icon: 'arrow-r',
          block: true,
          className: 'list-row',
          onClick: () => app.open('drills.flash.errors'),
          'data-action': 'error-history',
        }),
        button('Clear error history', { icon: 'back', onClick: () => clearErrors(app) }),
      ),
    ),
  );

  /** Shows Select for the Custom list; choosing Drill Errors shows a summary toast. */
  let shownHands = form.get('hands');
  function showHandOptions() {
    const hands = form.get('hands');
    selectButton.hidden = hands !== 'custom';
    if (hands === 'drillErrors' && shownHands !== 'drillErrors') toast(drillErrorsSummary(app));
    shownHands = hands;
  }
  form.watch(showHandOptions);

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}

async function clearErrors(app) {
  if (!(await confirm('Delete the record of all drill errors?'))) return;
  app.errorTallies.clear();
  toast('Error history cleared');
}

/** What the Drill Errors hand list holds. */
function drillErrorsSummary(app) {
  const entries = errorCellsAsHands(app.errorTallies.cells());
  return entries.length
    ? `${entries.length} hand${entries.length === 1 ? '' : 's'} with recorded errors; most often ${describeEntry(entries[0])}.`
    : 'No errors have been recorded yet.';
}

/** Checks the options and opens the drill. */
async function launch(app) {
  const s = app.settings;
  const situations = s.get('drills.flash.situations');
  if (!SITUATIONS.some(key => situations[key])) {
    await alert('No situations have been selected.');
    return;
  }
  // With no tests, hands only move on when their time runs out.
  const handsTimed = TIMED_HAND_MODES.includes(s.get('drills.flash.timerMode')) && s.get('drills.flash.timePerHand');
  if (s.get('drills.flash.testMode') === 'none' && !handsTimed) {
    await alert(
      'With Test Mode set to No tests, each hand needs a time limit: choose Rounds or Infinite and turn on Time limit per hand.',
    );
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
