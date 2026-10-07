// Full Table Drills: Options.

import { useApp, useSettings } from '@/react/app-context';
import { reactScreen } from '@/react/screen';
import type { SettingValues } from '@/settings/schema';
import type { SelectOption } from '@/ui/components';
import {
  DrillOptionsScreen,
  Group,
  OptionCheck,
  OptionDuration,
  OptionSelect,
  Section,
  COUNT_DOWN_HALT_OPTION,
  DECK_OPTIONS,
  ACCURACY_OPTIONS,
  BIAS_OPTIONS,
  END_WARNING_OPTIONS,
} from '@/drills/shared/options-screen';
import { FULL_DRILL_LABELS } from './logic';

type Options<K extends keyof SettingValues> = readonly SelectOption<SettingValues[K]>[];

const DRILL_OPTIONS: Options<'drills.full.drill'> = (
  ['runningCount', 'acesLeft', 'acesDealt', 'tenSideCount', 'twoTables'] as const
).map(value => ({ value, label: `Drill: ${FULL_DRILL_LABELS[value]}` }));

const HANDS_OPTIONS: Options<'drills.full.handStyle'> = [
  { value: 'twoToFourCards', label: 'Hands: 2-4 Card Hands' },
  { value: 'firstTwoCards', label: 'Hands: First Two Cards' },
  { value: 'scattered', label: 'Hands: Scattered Cards' },
];

const PLAYERS_OPTIONS: Options<'drills.full.players'> = [
  { value: 2, label: 'Two Players' },
  { value: 4, label: 'Four Players' },
  { value: 6, label: 'Six Players' },
];

/** Shoe: each test timed, through the whole shoe. Count Down & Halt: until the drill time runs out. */
const MODE_OPTIONS: Options<'drills.full.timerMode'> = [
  { value: 'auto', label: 'Timer Mode: Shoe' },
  COUNT_DOWN_HALT_OPTION,
];

export function FullOptions() {
  const app = useApp();
  const settings = useSettings();
  // Settings that only matter in some set-ups.
  const autoMode = settings.get('drills.full.timerMode') === 'auto';
  const drill = settings.get('drills.full.drill');
  const twoTables = drill === 'twoTables';

  return (
    <DrillOptionsScreen title="Full Table Options" help="drills.full.options" onLaunch={() => app.open('drills.full')}>
      <Section title="Drill">
        <Group>
          <OptionSelect setting="drills.full.drill" options={DRILL_OPTIONS} />
          <OptionSelect setting="drills.full.accuracy" options={ACCURACY_OPTIONS} />
          {/* Two Counts adds the running count, which the Running Count drill already asks for. */}
          <OptionCheck
            label="Two Counts"
            setting="drills.full.twoCounts"
            hidden={twoTables || drill === 'runningCount'}
          />
          {/* Two Tables always deals complete hands, asks only running counts and never warns. */}
          <OptionSelect setting="drills.full.handStyle" options={HANDS_OPTIONS} hidden={twoTables} />
          <OptionSelect setting="drills.full.players" options={PLAYERS_OPTIONS} />
          <OptionSelect setting="drills.full.decks" options={DECK_OPTIONS} />
          <OptionSelect setting="drills.full.bias" options={BIAS_OPTIONS} />
          {/* Shoe mode warns near the end of the shoe. */}
          <OptionSelect
            setting="drills.full.endWarning"
            options={END_WARNING_OPTIONS}
            hidden={twoTables || !autoMode}
          />
        </Group>
      </Section>
      {/* Shoe mode times each test; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <Group>
          <OptionSelect setting="drills.full.timerMode" options={MODE_OPTIONS} />
          <OptionDuration label="Time per test" setting="drills.full.testSeconds" hidden={!autoMode} />
          <OptionDuration label="Drill time" setting="drills.full.alarmSeconds" hidden={autoMode} />
          <OptionDuration label="Flash speed" setting="drills.full.flashSpeed" />
          <OptionCheck label="Progressive Speed" setting="drills.full.progressiveSpeed" />
        </Group>
      </Section>
    </DrillOptionsScreen>
  );
}

export const fullOptionsScreen = reactScreen(FullOptions, { className: 'drill-options' });
