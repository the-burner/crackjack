// Full Table Drills: Options.

import {
  drillOptionsScreen, group, section, COUNT_DOWN_HALT_OPTION,
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

/** Shoe: each test timed, through the whole shoe. Count Down & Halt: until the drill time runs out. */
const MODE_OPTIONS = [
  { value: 'auto', label: 'Timer Mode: Shoe' },
  COUNT_DOWN_HALT_OPTION,
];

export function fullOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Full Table Options', help: 'drills.full.options', drill: 'drills.full',
    onLaunch: () => app.open('drills.full'),
  });
  const { form } = screen;

  // Settings that only matter in some set-ups; see the watch below.
  const handStyle = form.select('handStyle', HANDS_OPTIONS);
  const endWarning = form.select('endWarning', END_WARNING_OPTIONS);
  const twoCounts = form.checks([{ label: 'Two Counts', key: 'twoCounts' }]);
  const perTest = form.duration('Time per test', 'testSeconds');
  const drillTime = form.duration('Drill time', 'alarmSeconds');

  screen.append(
    section('Drill', group(
      form.select('drill', DRILL_OPTIONS),
      form.select('accuracy', ACCURACY_OPTIONS),
      twoCounts,
      handStyle,
      form.select('players', PLAYERS_OPTIONS),
      form.select('decks', DECK_OPTIONS),
      form.select('bias', BIAS_OPTIONS),
      endWarning,
    )),
    section('Timer', group(
      form.select('timerMode', MODE_OPTIONS),
      perTest,
      drillTime,
      form.duration('Flash speed', 'flashSpeed'),
      form.checks([{ label: 'Progressive Speed', key: 'progressiveSpeed' }]),
    )),
  );

  form.watch(() => {
    const autoMode = form.get('timerMode') === 'auto';
    const twoTables = form.get('drill') === 'twoTables';
    // Shoe mode times each test and warns near the end of the shoe; Count Down & Halt times the whole drill.
    perTest.hidden = !autoMode;
    drillTime.hidden = autoMode;
    // Two Tables always deals complete hands, asks only running counts and never warns.
    handStyle.hidden = twoTables;
    twoCounts.hidden = twoTables;
    endWarning.hidden = twoTables || !autoMode;
  });

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}
