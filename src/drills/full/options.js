// Full Table Drills: Options.

import { alert } from '../../ui/dialogs.js';
import {
  drillOptionsScreen, group, row,
  DECK_OPTIONS, ACCURACY_OPTIONS, BIAS_OPTIONS, END_WARNING_OPTIONS,
} from '../shared/options-screen.js';
import { FULL_DRILL_LABELS } from './logic.js';

const DRILL_OPTIONS = ['runningCount', 'acesLeft', 'acesDealt', 'tenSideCount', 'twoTables']
  .map(value => ({ value, label: `Drill: ${FULL_DRILL_LABELS[value]}` }));

const HANDS_OPTIONS = [
  { value: 'twoToFourCards', label: 'Hands: 2-4 Card Hands' },
  { value: 'firstTwoCards', label: 'Hands: First Two Cards' },
  { value: 'scattered', label: 'Hands: Scattered Cards' },
];

const PLAYERS_OPTIONS = [
  { value: 2, label: 'Two Players' },
  { value: 4, label: 'Four Players' },
  { value: 6, label: 'Six Players' },
];

const MODE_OPTIONS = [
  { value: 'auto', label: 'Mode: Auto' },
  { value: 'countDown', label: 'Mode: Count Down' },
  { value: 'countUp', label: 'Mode: Count Up' },
];

export function fullOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Full Table Options', help: 'drills.full.options', drill: 'drills.full',
    onLaunch: () => launch(app),
  });
  const { form } = screen;
  const auto = () => form.get('timerMode') === 'auto';

  const flashSpeed = row('Flash Speed:', form.slider('', 'flashSpeed'));
  const alarm = row('Alarm Time:', form.slider('', 'alarmSeconds'));

  screen.append(
    group(
      form.select('drill', DRILL_OPTIONS),
      form.select('accuracy', ACCURACY_OPTIONS),
      form.select('handStyle', HANDS_OPTIONS),
      form.select('players', PLAYERS_OPTIONS),
      form.select('decks', DECK_OPTIONS),
      form.select('bias', BIAS_OPTIONS),
      form.select('endWarning', END_WARNING_OPTIONS),
      form.select('timerMode', MODE_OPTIONS),
    ),
    flashSpeed,
    alarm,
    row('Test Speed:', form.slider('', 'testSeconds')),
    form.checks([
      { label: 'Progressive Speed', key: 'progressiveSpeed' },
      { label: 'Two Counts', key: 'twoCounts' },
    ]),
  );

  // The flash speed only applies when the drill paces itself; the alarm only
  // applies when it does not.
  form.watch(() => {
    flashSpeed.hidden = !auto();
    alarm.hidden = auto();
  });

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}

async function launch(app) {
  const s = app.settings;
  if (s.get('drills.full.drill') === 'twoTables' && s.get('drills.full.handStyle') === 'scattered') {
    await alert('Scattered Cards is not supported with Drill: Two Tables.');
    return;
  }
  app.open('drills.full');
}
