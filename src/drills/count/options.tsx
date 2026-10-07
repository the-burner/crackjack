// Count Drills: Options.

import type { App } from '@/app/app';
import { useApp, useSettings } from '@/react/app-context';
import { Section } from '@/components/screen-layout';
import { SettingSelect } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import { alert } from '@/components/dialogs';
import type { SettingValues } from '@/settings/schema';
import {
  DrillOptionsScreen,
  OptionDuration,
  OptionSlider,
  OptionSwitch,
  COUNT_DOWN_HALT_OPTION,
  DECK_OPTIONS,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
  BIAS_OPTIONS,
  END_WARNING_OPTIONS,
} from '@/drills/shared/options-screen';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { trayStyleFor, TRAY_CAPACITY } from '@/drills/depth/logic';
import { COUNT_DRILL_LABELS, aceDrillSuits, ACE_DRILLS } from './logic';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';

type Options<K extends keyof SettingValues> = readonly Option<SettingValues[K]>[];

const DRILL_OPTIONS: Options<'drills.count.drill'> = (
  [
    'runningCount',
    'trueCount',
    'acesLeft',
    'acesDealt',
    'aceBetCount',
    'acePlayCount',
    'aceInsureCount',
    'tenSideCount',
  ] as const
).map(value => ({ value, label: COUNT_DRILL_LABELS[value] }));

const TEST_OPTIONS: Options<'drills.count.testEvery'> = [
  { value: 'everyCard', label: 'Every Card' },
  { value: 'about8', label: 'About 8 cards' },
  { value: 'about16', label: 'About 16 cards' },
  { value: 'about36', label: 'About 36 cards' },
  { value: 'never', label: 'No Tests' },
];

const CARDS_OPTIONS: Options<'drills.count.cardsPerFlash'> = [
  { value: '1', label: 'One' },
  { value: '2', label: 'Two' },
  { value: '3', label: 'Three' },
  { value: '4', label: 'Four' },
  { value: '1-2', label: 'One or Two' },
  { value: '1-3', label: 'One to Three' },
  { value: '1-4', label: 'One to Four' },
];

const ORIENTATION_OPTIONS: Options<'drills.count.orientation'> = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'mixed', label: 'Mixed' },
];

const POSITION_OPTIONS: Options<'drills.count.positions'> = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'mixed', label: 'Mixed' },
];

/** Shoe: each test timed, through the whole shoe. Count Down & Halt: until the drill time runs out. */
const MODE_OPTIONS: Options<'drills.count.timerMode'> = [{ value: 'auto', label: 'Shoe' }, COUNT_DOWN_HALT_OPTION];

export function CountOptions() {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  // Settings that only matter in some set-ups.
  const autoMode = settings.get('drills.count.timerMode') === 'auto';
  const byHand = settings.get('drills.count.dealByHand');
  const tests = settings.get('drills.count.testEvery') !== 'never';
  const shown = {
    // Shoe mode times each test; Count Down & Halt times the whole drill.
    perTest: autoMode && tests,
    drillTime: !autoMode,
    // The deal speed, and speeding it up, only apply when the cards deal themselves.
    dealSpeed: !byHand,
    progressive: !byHand,
    // Without tests there is no answer to grade or tray to show.
    accuracy: tests,
    trayStyle: tests,
    thickness: tests,
    twoCounts: tests,
    // Positions arrange several cards; a single card has none.
    positions: settings.get('drills.count.cardsPerFlash') !== '1',
  };

  return (
    <DrillOptionsScreen
      title="Count Options"
      help="drills.count.options"
      onLaunch={() => launch(app, () => navigate(PATHS['drills.count']))}
    >
      <Section title="Drill">
        <SettingSelect label="Drill" setting="drills.count.drill" options={DRILL_OPTIONS} />
        <SettingSelect label="Test" setting="drills.count.testEvery" options={TEST_OPTIONS} />
        <SettingSelect
          label="Accuracy"
          setting="drills.count.accuracy"
          options={ACCURACY_OPTIONS}
          hidden={!shown.accuracy}
        />
        <OptionSwitch label="Two Counts" setting="drills.count.twoCounts" hidden={!shown.twoCounts} />
        <SettingSelect label="Cards" setting="drills.count.cardsPerFlash" options={CARDS_OPTIONS} />
        <SettingSelect label="Decks" setting="drills.count.decks" options={DECK_OPTIONS} />
      </Section>
      <Section title="Dealing">
        <SettingSelect label="Orientation" setting="drills.count.orientation" options={ORIENTATION_OPTIONS} />
        <SettingSelect
          label="Positions"
          setting="drills.count.positions"
          options={POSITION_OPTIONS}
          hidden={!shown.positions}
        />
        <SettingSelect label="End warning" setting="drills.count.endWarning" options={END_WARNING_OPTIONS} />
        <SettingSelect label="Bias" setting="drills.count.bias" options={BIAS_OPTIONS} />
        <SettingSelect
          label="Tray style"
          setting="drills.count.trayStyle"
          options={TRAY_OPTIONS}
          hidden={!shown.trayStyle}
        />
        <OptionSlider label="Thickness" setting="drills.count.cardThickness" hidden={!shown.thickness} />
      </Section>
      <Section title="Timer">
        <SettingSelect label="Timer mode" setting="drills.count.timerMode" options={MODE_OPTIONS} />
        <OptionDuration label="Time per test" setting="drills.count.testSeconds" hidden={!shown.perTest} />
        <OptionDuration label="Drill time" setting="drills.count.alarmSeconds" hidden={!shown.drillTime} />
        <OptionSwitch label="Deal by hand" setting="drills.count.dealByHand" />
        <OptionDuration label="Deal speed" setting="drills.count.dealTenths" tenths hidden={!shown.dealSpeed} />
        <OptionSwitch label="Progressive Speed" setting="drills.count.progressiveSpeed" hidden={!shown.progressive} />
      </Section>
    </DrillOptionsScreen>
  );
}

/** Checks the options, then opens the drill with `open`. */
async function launch(app: App, open: () => void) {
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
  open();
}
