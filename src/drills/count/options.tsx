// Count Drills: Options.

import type { App } from '../../app/app.ts';
import { useApp, useSettings } from '../../react/app-context.ts';
import { reactScreen } from '../../react/screen.tsx';
import type { SettingValues } from '../../settings/schema.ts';
import type { SelectOption } from '../../ui/components.ts';
import { alert } from '../../ui/dialogs.ts';
import {
  DrillOptionsScreen,
  Group,
  OptionCheck,
  OptionDuration,
  OptionSelect,
  OptionSlider,
  Row,
  Section,
  COUNT_DOWN_HALT_OPTION,
  DECK_OPTIONS,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
  BIAS_OPTIONS,
  END_WARNING_OPTIONS,
} from '../shared/options-screen.tsx';
import { drillStrategy } from '../shared/drill-settings.ts';
import { trayStyleFor, TRAY_CAPACITY } from '../depth/logic.ts';
import { COUNT_DRILL_LABELS, aceDrillSuits, ACE_DRILLS } from './logic.ts';

type Options<K extends keyof SettingValues> = readonly SelectOption<SettingValues[K]>[];

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
).map(value => ({ value, label: `Drill: ${COUNT_DRILL_LABELS[value]}` }));

const TEST_OPTIONS: Options<'drills.count.testEvery'> = [
  { value: 'everyCard', label: 'Test: Every Card' },
  { value: 'about8', label: 'Test: About 8 cards' },
  { value: 'about16', label: 'Test: About 16 cards' },
  { value: 'about36', label: 'Test: About 36 cards' },
  { value: 'never', label: 'Test: No Tests' },
];

const CARDS_OPTIONS: Options<'drills.count.cardsPerFlash'> = [
  { value: '1', label: 'Cards: One' },
  { value: '2', label: 'Cards: Two' },
  { value: '3', label: 'Cards: Three' },
  { value: '4', label: 'Cards: Four' },
  { value: '1-2', label: 'Cards: One or Two' },
  { value: '1-3', label: 'Cards: One to Three' },
  { value: '1-4', label: 'Cards: One to Four' },
];

const ORIENTATION_OPTIONS: Options<'drills.count.orientation'> = [
  { value: 'vertical', label: 'Orientation: Vertical' },
  { value: 'horizontal', label: 'Orientation: Horizontal' },
  { value: 'mixed', label: 'Orientation: Mixed' },
];

const POSITION_OPTIONS: Options<'drills.count.positions'> = [
  { value: 'vertical', label: 'Positions: Vertical' },
  { value: 'horizontal', label: 'Positions: Horizontal' },
  { value: 'diagonal', label: 'Positions: Diagonal' },
  { value: 'mixed', label: 'Positions: Mixed' },
];

/** Shoe: each test timed, through the whole shoe. Count Down & Halt: until the drill time runs out. */
const MODE_OPTIONS: Options<'drills.count.timerMode'> = [
  { value: 'auto', label: 'Timer Mode: Shoe' },
  COUNT_DOWN_HALT_OPTION,
];

export function CountOptions() {
  const app = useApp();
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
    <DrillOptionsScreen title="Count Options" help="drills.count.options" onLaunch={() => launch(app)}>
      <Section title="Drill">
        <Group>
          <OptionSelect setting="drills.count.drill" options={DRILL_OPTIONS} />
          <OptionSelect setting="drills.count.testEvery" options={TEST_OPTIONS} />
          <OptionSelect setting="drills.count.accuracy" options={ACCURACY_OPTIONS} hidden={!shown.accuracy} />
          <OptionCheck label="Two Counts" setting="drills.count.twoCounts" hidden={!shown.twoCounts} />
          <OptionSelect setting="drills.count.cardsPerFlash" options={CARDS_OPTIONS} />
          <OptionSelect setting="drills.count.decks" options={DECK_OPTIONS} />
        </Group>
      </Section>
      <Section title="Dealing">
        <Group>
          <OptionSelect setting="drills.count.orientation" options={ORIENTATION_OPTIONS} />
          <OptionSelect setting="drills.count.positions" options={POSITION_OPTIONS} hidden={!shown.positions} />
          <OptionSelect setting="drills.count.endWarning" options={END_WARNING_OPTIONS} />
          <OptionSelect setting="drills.count.bias" options={BIAS_OPTIONS} />
          <OptionSelect setting="drills.count.trayStyle" options={TRAY_OPTIONS} hidden={!shown.trayStyle} />
          <Row label="Thickness:" hidden={!shown.thickness}>
            <OptionSlider setting="drills.count.cardThickness" />
          </Row>
        </Group>
      </Section>
      <Section title="Timer">
        <Group>
          <OptionSelect setting="drills.count.timerMode" options={MODE_OPTIONS} />
          <OptionDuration label="Time per test" setting="drills.count.testSeconds" hidden={!shown.perTest} />
          <OptionDuration label="Drill time" setting="drills.count.alarmSeconds" hidden={!shown.drillTime} />
          <OptionCheck label="Deal by hand" setting="drills.count.dealByHand" />
          <OptionDuration label="Deal speed" setting="drills.count.dealTenths" tenths hidden={!shown.dealSpeed} />
          <OptionCheck label="Progressive Speed" setting="drills.count.progressiveSpeed" hidden={!shown.progressive} />
        </Group>
      </Section>
    </DrillOptionsScreen>
  );
}

export const countOptionsScreen = reactScreen(CountOptions, { className: 'drill-options' });

async function launch(app: App) {
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
