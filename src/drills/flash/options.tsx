// Flash Drills: Options.

import type { App } from '../../app/app.ts';
import { useApp, useSettings } from '../../react/app-context.ts';
import { Button, CheckList, Select } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';
import type { SettingValues } from '../../settings/schema.ts';
import type { SelectOption } from '../../ui/components.ts';
import { alert, confirm } from '../../ui/dialogs.ts';
import { toast } from '../../ui/toast.ts';
import {
  DrillOptionsScreen,
  Group,
  OptionCheck,
  OptionDuration,
  OptionNumber,
  OptionSelect,
  Pair,
  Section,
  COUNT_DOWN_HALT_OPTION,
} from '../shared/options-screen.tsx';
import { drillStrategy } from '../shared/drill-settings.ts';
import { buildHandList, SITUATIONS, SITUATION_LABELS, errorCellsAsHands, describeEntry } from './logic.ts';

type Options<K extends keyof SettingValues> = readonly SelectOption<SettingValues[K]>[];

const HANDS_OPTIONS: Options<'drills.flash.hands'> = [
  { value: 'default', label: 'Hands: Default Hands' },
  { value: 'illustrious18', label: 'Hands: Illustrious 18' },
  { value: 'withIndices', label: 'Hands: Hands with Indices' },
  { value: 'drillErrors', label: 'Hands: Drill Errors' },
  { value: 'custom', label: 'Hands: Custom' },
  { value: 'roundRobin', label: 'Hands: Round Robin' },
];

const COUNT_OPTIONS: Options<'drills.flash.countMode'> = [
  { value: 'zero', label: 'Count: Always Zero' },
  { value: 'random', label: 'Count: Random' },
  { value: 'fixed', label: 'Count: Set Count to:' },
  { value: 'indexTest', label: 'Count: Index Test' },
];

const CARDS_OPTIONS: Options<'drills.flash.maxCards'> = [
  { value: 2, label: 'Cards: Two' },
  { value: 3, label: 'Cards: Two or Three' },
  { value: 4, label: 'Cards: Two to Four' },
  { value: 5, label: 'Cards: Two to Five' },
];

const TEST_MODE_OPTIONS: Options<'drills.flash.testMode'> = [
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
const FLASH_TIMER_OPTIONS: Options<'drills.flash.timerMode'> = [
  { value: 'auto', label: 'Timer Mode: Rounds' },
  COUNT_DOWN_HALT_OPTION,
  { value: 'infinite', label: 'Timer Mode: Infinite' },
];

/** Timer modes in which each hand may have a time limit. */
const TIMED_HAND_MODES: readonly SettingValues['drills.flash.timerMode'][] = ['auto', 'infinite'];

export function FlashOptions() {
  const app = useApp();
  const settings = useSettings();
  const mode = settings.get('drills.flash.timerMode');
  const hands = settings.get('drills.flash.hands');
  const handsCanBeTimed = TIMED_HAND_MODES.includes(mode);
  const handsTimed = handsCanBeTimed && settings.get('drills.flash.timePerHand');
  const situations = settings.get('drills.flash.situations');
  const decks = `${settings.get('drills.flash.decks')}${settings.get('drills.flash.spanishDecks') ? 's' : ''}`;

  return (
    <DrillOptionsScreen title="Flash Options" help="drills.flash.options" onLaunch={() => launch(app)}>
      <Section title="Drill">
        <Group>
          <OptionSelect setting="drills.flash.maxCards" options={CARDS_OPTIONS} />
          <Select
            name="drills.flash.decks"
            options={DECK_OPTIONS}
            value={decks}
            onChange={value =>
              settings.update({
                'drills.flash.decks': Number.parseInt(value, 10),
                'drills.flash.spanishDecks': value.endsWith('s'),
              })
            }
          />
          <Pair>
            <OptionSelect
              setting="drills.flash.hands"
              options={HANDS_OPTIONS}
              // Choosing Drill Errors shows what the list holds.
              onChange={value => {
                if (value === 'drillErrors' && hands !== 'drillErrors') toast(drillErrorsSummary(app));
              }}
            />
            {/* Picks the custom hands; only shown when the hand list is Custom. */}
            <Button
              hidden={hands !== 'custom'}
              onClick={() =>
                app.open('strategy.tables', {
                  mode: 'editMask',
                  maskKey: 'drills.flash.customHands',
                  decks: settings.get('drills.flash.decks'),
                  title: 'Custom Hands',
                })
              }
            >
              Select
            </Button>
          </Pair>
          <Pair>
            <OptionSelect setting="drills.flash.countMode" options={COUNT_OPTIONS} />
            {/* The set count; only Count: Set Count to: uses it. */}
            <OptionNumber
              setting="drills.flash.fixedCount"
              prompt="Count"
              hidden={settings.get('drills.flash.countMode') !== 'fixed'}
            />
          </Pair>
          <OptionSelect setting="drills.flash.testMode" options={TEST_MODE_OPTIONS} />
          {/* Only Warn on error shows error pop-ups, so only it can make them non-blocking. */}
          <OptionCheck
            label="Non-blocking error pop-ups"
            setting="drills.flash.nonBlockingErrors"
            hidden={settings.get('drills.flash.testMode') !== 'warn'}
          />
        </Group>
      </Section>
      <Section title="Situations">
        <CheckList
          chips
          items={SITUATION_ITEMS.map(({ flag, label }) => ({
            label,
            checked: situations[flag],
            onChange: on => settings.set('drills.flash.situations', { ...situations, [flag]: on }),
          }))}
        />
      </Section>
      {/* Rounds and Infinite may time each hand; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <Group>
          <Pair>
            <OptionSelect setting="drills.flash.timerMode" options={FLASH_TIMER_OPTIONS} />
            <OptionNumber setting="drills.flash.handsPerDrill" prompt="Rounds" hidden={mode !== 'auto'} />
          </Pair>
          <OptionCheck label="Time limit per hand" setting="drills.flash.timePerHand" hidden={!handsCanBeTimed} />
          <OptionDuration label="Time per hand" setting="drills.flash.seconds" hidden={!handsTimed} />
          {/* Progressive Speed shortens the time per hand, so it goes with it. */}
          <OptionCheck label="Progressive Speed" setting="drills.flash.progressiveSpeed" hidden={!handsTimed} />
          <OptionDuration label="Drill time" setting="drills.flash.drillSeconds" hidden={mode !== 'countDownHalt'} />
        </Group>
      </Section>
      <Section title="Error History">
        <Group>
          <Button
            icon="arrow-r"
            block
            className="list-row"
            onClick={() => app.open('drills.flash.errors')}
            data-action="error-history"
          >
            Error history
          </Button>
          <Button icon="back" onClick={() => clearErrors(app)}>
            Clear error history
          </Button>
        </Group>
      </Section>
    </DrillOptionsScreen>
  );
}

export const flashOptionsScreen = reactScreen(FlashOptions, { className: 'drill-options' });

async function clearErrors(app: App) {
  if (!(await confirm('Delete the record of all drill errors?'))) return;
  app.errorTallies.clear();
  toast('Error history cleared');
}

/** What the Drill Errors hand list holds. */
function drillErrorsSummary(app: App): string {
  const entries = errorCellsAsHands(app.errorTallies.cells());
  return entries.length
    ? `${entries.length} hand${entries.length === 1 ? '' : 's'} with recorded errors; most often ${describeEntry(entries[0])}.`
    : 'No errors have been recorded yet.';
}

/** Checks the options and opens the drill. */
async function launch(app: App) {
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
