// Depth Drills: Options.

import { h } from '../../ui/dom.js';
import { alert } from '../../ui/dialogs.js';
import {
  drillOptionsScreen,
  group,
  row,
  section,
  withButton,
  DECK_OPTIONS,
  COUNT_DOWN_HALT_OPTION,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
} from '../shared/options-screen.js';
import { DRILL_LABELS, isTrueCountDrill, trayStyleFor, TRAY_CAPACITY } from './logic.js';

const DRILL_OPTIONS = [
  'decksLeft',
  'halfDecksLeft',
  'quarterDecksLeft',
  'acesLeft',
  'trueCount',
  'trueCountAndDecks',
].map(value => ({ value, label: `Drill: ${DRILL_LABELS[value]}` }));

/** Rounds: a set number of tests, each timed. Count Down & Halt: until the drill time runs out. */
const DEPTH_TIMER_OPTIONS = [{ value: 'auto', label: 'Timer Mode: Rounds' }, COUNT_DOWN_HALT_OPTION];

const RESOLUTION_OPTIONS = [
  { value: 'full', label: 'Resolution: Full Deck' },
  { value: 'half', label: 'Resolution: Half Deck' },
  { value: 'quarter', label: 'Resolution: Quarter Deck' },
];

export function depthOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Depth Options',
    help: 'drills.depth.options',
    drill: 'drills.depth',
    onLaunch: () => launch(app),
  });
  const { form } = screen;
  const valueRow = (label, control) =>
    h('div', { class: 'settings-row' }, h('span', { class: 'label' }, label), control);

  // One card for the drill-specific settings: the count range feeds the TC
  // Conversion drills, "in tray" the others.
  const minCount = valueRow(
    'Minimum count',
    form.number('Minimum Count', 'countRangeMin', { prompt: 'Minimum Count' }),
  );
  const maxCount = valueRow(
    'Maximum count',
    form.number('Maximum Count', 'countRangeMax', { prompt: 'Maximum Count' }),
  );
  const inTray = form.checks([{ label: 'Decks or Aces in Tray', key: 'askCardsInTray' }]);

  // Rounds times each test; Count Down & Halt times the whole drill.
  const roundsButton = form.number('Rounds', 'testsPerDrill', { prompt: 'Rounds' });
  const perTestRow = form.duration('Time per test', 'seconds');
  const progressiveRow = form.checks([{ label: 'Progressive Speed', key: 'progressiveSpeed' }]);
  const drillTimeRow = form.duration('Drill time', 'drillSeconds');

  // Its label follows what the card holds for the chosen drill.
  const drillCard = section('Answers', group(minCount, maxCount, inTray));
  const drillCardLabel = drillCard.firstChild;

  screen.append(
    section(
      'Drill',
      group(
        form.select('drill', DRILL_OPTIONS),
        form.select('accuracy', ACCURACY_OPTIONS),
        form.select('resolution', RESOLUTION_OPTIONS),
        form.select('decks', DECK_OPTIONS),
        form.select('trayStyle', TRAY_OPTIONS),
        row('Thickness:', form.slider('', 'cardThickness')),
      ),
    ),
    drillCard,
    section(
      'Timer',
      group(
        withButton(form.select('timerMode', DEPTH_TIMER_OPTIONS), roundsButton),
        perTestRow,
        progressiveRow,
        drillTimeRow,
      ),
    ),
  );

  form.watch(() => {
    const rounds = form.get('timerMode') === 'auto';
    const trueCount = isTrueCountDrill(form.get('drill'));
    roundsButton.hidden = !rounds;
    perTestRow.hidden = !rounds;
    progressiveRow.hidden = !rounds;
    drillTimeRow.hidden = rounds;
    minCount.hidden = !trueCount;
    maxCount.hidden = !trueCount;
    inTray.hidden = trueCount;
    drillCardLabel.textContent = trueCount ? 'Count Range' : 'Answers';
  });

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}

/** Checks the options, correcting the tray style and resolution if need be. */
async function launch(app) {
  const s = app.settings;
  const decks = s.get('drills.depth.decks');
  const style = s.get('drills.depth.trayStyle');
  const fixedStyle = trayStyleFor(style, decks);
  if (fixedStyle !== style) {
    s.set('drills.depth.trayStyle', fixedStyle);
    await alert(`The selected discard tray only holds ${TRAY_CAPACITY[style]} decks. Tray style changed.`);
    return;
  }
  if (decks === 1 && s.get('drills.depth.resolution') === 'full') {
    s.set('drills.depth.resolution', 'half');
    await alert(
      'Full resolution needs more than one deck: there would be nothing to ask. Resolution changed to Half Deck.',
    );
    return;
  }
  if (isTrueCountDrill(s.get('drills.depth.drill'))) {
    const min = s.get('drills.depth.countRangeMin');
    const max = s.get('drills.depth.countRangeMax');
    if (min >= max || max <= -35 || min >= 65) {
      await alert('The Count Range holds no running counts. Set a minimum below the maximum, between -35 and 64.');
      return;
    }
  }
  app.open('drills.depth');
}
