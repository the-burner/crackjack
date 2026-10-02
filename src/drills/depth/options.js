// Depth Drills: Options.

import { h } from '../../ui/dom.js';
import { alert } from '../../ui/dialogs.js';
import {
  drillOptionsScreen, group, row, withButton,
  DECK_OPTIONS, TIMER_MODE_OPTIONS, ACCURACY_OPTIONS, TRAY_OPTIONS,
} from '../shared/options-screen.js';
import { DRILL_LABELS, isTrueCountDrill, trayStyleFor, TRAY_CAPACITY } from './logic.js';

const DRILL_OPTIONS = ['decksLeft', 'halfDecksLeft', 'quarterDecksLeft', 'acesLeft', 'trueCount', 'trueCountAndDecks']
  .map(value => ({ value, label: `Drill: ${DRILL_LABELS[value]}` }));

const RESOLUTION_OPTIONS = [
  { value: 'full', label: 'Resolution: Full Deck' },
  { value: 'half', label: 'Resolution: Half Deck' },
  { value: 'quarter', label: 'Resolution: Quarter Deck' },
];

export function depthOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Depth Options', help: 'drills.depth.options', drill: 'drills.depth',
    onLaunch: () => launch(app),
  });
  const { form } = screen;

  screen.append(
    group(
      form.select('drill', DRILL_OPTIONS),
      form.select('accuracy', ACCURACY_OPTIONS),
      form.select('resolution', RESOLUTION_OPTIONS),
      form.select('decks', DECK_OPTIONS),
      form.select('trayStyle', TRAY_OPTIONS),
      withButton(form.select('timerMode', TIMER_MODE_OPTIONS), form.number('Rounds', 'testsPerDrill', { prompt: 'Rounds' })),
    ),
    row('Seconds:', form.slider('', 'seconds')),
    row('Thickness:', form.slider('', 'cardThickness')),
    h('div', { class: 'row drill-options__range' },
      h('span', { class: 'label' }, 'Count Range:'),
      form.number('Minimum Count', 'countRangeMin', { prompt: 'Minimum Count' }),
      h('span', { class: 'label' }, 'to'),
      form.number('Maximum Count', 'countRangeMax', { prompt: 'Maximum Count' })),
    form.checks([
      { label: 'Progressive Speed', key: 'progressiveSpeed' },
      { label: 'Decks or Aces in Tray', key: 'askCardsInTray' },
    ]),
  );

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
    await alert('Full resolution needs more than one deck: there would be nothing to ask. Resolution changed to Half Deck.');
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
