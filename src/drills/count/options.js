// Count Drills: Options.

import { alert } from '../../ui/dialogs.js';
import {
  drillOptionsScreen,
  group,
  row,
  section,
  COUNT_DOWN_HALT_OPTION,
  DECK_OPTIONS,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
  BIAS_OPTIONS,
  END_WARNING_OPTIONS,
} from '../shared/options-screen.js';
import { drillStrategy } from '../shared/drill-settings.js';
import { trayStyleFor, TRAY_CAPACITY } from '../depth/logic.js';
import { COUNT_DRILL_LABELS, aceDrillSuits, ACE_DRILLS } from './logic.js';

const DRILL_OPTIONS = [
  'runningCount',
  'trueCount',
  'acesLeft',
  'acesDealt',
  'aceBetCount',
  'acePlayCount',
  'aceInsureCount',
  'tenSideCount',
].map(value => ({ value, label: `Drill: ${COUNT_DRILL_LABELS[value]}` }));

const TEST_OPTIONS = [
  { value: 'everyCard', label: 'Test: Every Card' },
  { value: 'about8', label: 'Test: About 8 cards' },
  { value: 'about16', label: 'Test: About 16 cards' },
  { value: 'about36', label: 'Test: About 36 cards' },
  { value: 'never', label: 'Test: No Tests' },
];

const CARDS_OPTIONS = [
  { value: '1', label: 'Cards: One' },
  { value: '2', label: 'Cards: Two' },
  { value: '3', label: 'Cards: Three' },
  { value: '4', label: 'Cards: Four' },
  { value: '1-2', label: 'Cards: One or Two' },
  { value: '1-3', label: 'Cards: One to Three' },
  { value: '1-4', label: 'Cards: One to Four' },
];

const ORIENTATION_OPTIONS = [
  { value: 'vertical', label: 'Orientation: Vertical' },
  { value: 'horizontal', label: 'Orientation: Horizontal' },
  { value: 'mixed', label: 'Orientation: Mixed' },
];

const POSITION_OPTIONS = [
  { value: 'vertical', label: 'Positions: Vertical' },
  { value: 'horizontal', label: 'Positions: Horizontal' },
  { value: 'diagonal', label: 'Positions: Diagonal' },
  { value: 'mixed', label: 'Positions: Mixed' },
];

/** Shoe: each test timed, through the whole shoe. Count Down & Halt: until the drill time runs out. */
const MODE_OPTIONS = [{ value: 'auto', label: 'Timer Mode: Shoe' }, COUNT_DOWN_HALT_OPTION];

export function countOptionsScreen(app) {
  const screen = drillOptionsScreen(app, {
    title: 'Count Options',
    help: 'drills.count.options',
    drill: 'drills.count',
    onLaunch: () => launch(app),
  });
  const { form } = screen;

  // Settings that only matter in some set-ups; see the watch below.
  const positions = form.select('positions', POSITION_OPTIONS);
  const accuracy = form.select('accuracy', ACCURACY_OPTIONS);
  const trayStyle = form.select('trayStyle', TRAY_OPTIONS);
  const thickness = row('Thickness:', form.slider('', 'cardThickness'));
  const perTest = form.duration('Time per test', 'testSeconds');
  const drillTime = form.duration('Drill time', 'alarmSeconds');
  const dealByHand = form.checks([{ label: 'Deal by hand', key: 'dealByHand' }]);
  const dealSpeed = form.duration('Deal speed', 'dealTenths', { tenths: true });
  const progressive = form.checks([{ label: 'Progressive Speed', key: 'progressiveSpeed' }]);
  const twoCounts = form.checks([{ label: 'Two Counts', key: 'twoCounts' }]);

  screen.append(
    section(
      'Drill',
      group(
        form.select('drill', DRILL_OPTIONS),
        form.select('testEvery', TEST_OPTIONS),
        accuracy,
        twoCounts,
        form.select('cardsPerFlash', CARDS_OPTIONS),
        form.select('decks', DECK_OPTIONS),
      ),
    ),
    section(
      'Dealing',
      group(
        form.select('orientation', ORIENTATION_OPTIONS),
        positions,
        form.select('endWarning', END_WARNING_OPTIONS),
        form.select('bias', BIAS_OPTIONS),
        trayStyle,
        thickness,
      ),
    ),
    section(
      'Timer',
      group(form.select('timerMode', MODE_OPTIONS), perTest, drillTime, dealByHand, dealSpeed, progressive),
    ),
  );

  form.watch(() => {
    const autoMode = form.get('timerMode') === 'auto';
    const byHand = form.get('dealByHand');
    const tests = form.get('testEvery') !== 'never';
    // Shoe mode times each test; Count Down & Halt times the whole drill.
    perTest.hidden = !autoMode || !tests;
    drillTime.hidden = autoMode;
    // The deal speed, and speeding it up, only apply when the cards deal themselves.
    dealSpeed.hidden = byHand;
    progressive.hidden = byHand;
    // Without tests there is no answer to grade or tray to show.
    accuracy.hidden = !tests;
    trayStyle.hidden = !tests;
    thickness.hidden = !tests;
    twoCounts.hidden = !tests;
    // Positions arrange several cards; a single card has none.
    positions.hidden = form.get('cardsPerFlash') === '1';
  });

  return { el: screen.el, onShow: screen.onShow, destroy: screen.destroy };
}

async function launch(app) {
  const s = app.settings;
  const decks = s.get('drills.count.decks');
  const style = s.get('drills.count.trayStyle');
  const fixedStyle = trayStyleFor(style, decks);
  if (fixedStyle !== style) {
    s.set('drills.count.trayStyle', fixedStyle);
    await alert(`The selected discard tray only holds ${TRAY_CAPACITY[style]} decks. Tray style changed.`);
    return;
  }
  const drill = s.get('drills.count.drill');
  const { strategy } = drillStrategy(app, decks);
  if (!aceDrillSuits(drill, strategy)) {
    await alert(
      ACE_DRILLS[drill] === 'neutral'
        ? 'The Ace Bet Count only helps with a counting system that gives aces no value. Choose another drill or another strategy.'
        : 'The Ace Play and Ace Insure Counts only apply to a counting system that counts aces. Choose another drill or another strategy.',
    );
    return;
  }
  app.open('drills.count');
}
