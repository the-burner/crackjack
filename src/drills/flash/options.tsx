// Flash Drills: Options.

import type { App } from '@/app/app';
import { toast } from 'sonner';
import { useApp, useSettings } from '@/react/app-context';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ListButton, Section } from '@/components/screen-layout';
import { OptionSelect, SettingNumber, SettingSelect } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import { alert, confirm } from '@/components/dialogs';
import { reactScreen } from '@/react/screen';
import type { SettingValues } from '@/settings/schema';
import {
  DrillOptionsScreen,
  OptionDuration,
  OptionSwitch,
  COUNT_DOWN_HALT_OPTION,
} from '@/drills/shared/options-screen';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { buildHandList, SITUATIONS, SITUATION_LABELS, errorCellsAsHands, describeEntry } from './logic';

type Options<K extends keyof SettingValues> = readonly Option<SettingValues[K]>[];

const HANDS_OPTIONS: Options<'drills.flash.hands'> = [
  { value: 'default', label: 'Default Hands' },
  { value: 'illustrious18', label: 'Illustrious 18' },
  { value: 'withIndices', label: 'Hands with Indices' },
  { value: 'drillErrors', label: 'Drill Errors' },
  { value: 'custom', label: 'Custom' },
  { value: 'roundRobin', label: 'Round Robin' },
];

const COUNT_OPTIONS: Options<'drills.flash.countMode'> = [
  { value: 'zero', label: 'Always Zero' },
  { value: 'random', label: 'Random' },
  { value: 'fixed', label: 'Set Count' },
  { value: 'indexTest', label: 'Index Test' },
];

const CARDS_OPTIONS: Options<'drills.flash.maxCards'> = [
  { value: 2, label: 'Two' },
  { value: 3, label: 'Two or Three' },
  { value: 4, label: 'Two to Four' },
  { value: 5, label: 'Two to Five' },
];

const TEST_MODE_OPTIONS: Options<'drills.flash.testMode'> = [
  { value: 'warn', label: 'Warn on error' },
  { value: 'errorsAtEnd', label: 'Number of errors only at end' },
  { value: 'none', label: 'No tests (quick drill)' },
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
  { value: 'auto', label: 'Rounds' },
  COUNT_DOWN_HALT_OPTION,
  { value: 'infinite', label: 'Infinite' },
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
        <SettingSelect label="Cards" setting="drills.flash.maxCards" options={CARDS_OPTIONS} />
        {/* One select writes the deck count and whether the decks are Spanish. */}
        <OptionSelect
          label="Decks"
          options={DECK_OPTIONS}
          value={decks}
          onChange={value =>
            settings.update({
              'drills.flash.decks': Number.parseInt(value, 10),
              'drills.flash.spanishDecks': value.endsWith('s'),
            })
          }
        />
        <SettingSelect
          label="Hands"
          setting="drills.flash.hands"
          options={HANDS_OPTIONS}
          onChange={value => {
            settings.set('drills.flash.hands', value);
            // Choosing Drill Errors shows what the list holds.
            if (value === 'drillErrors' && hands !== 'drillErrors') toast(drillErrorsSummary(app));
          }}
        />
        {/* Picks the custom hands; only shown when the hand list is Custom. */}
        <ListButton
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
          Select custom hands
        </ListButton>
        <SettingSelect label="Count" setting="drills.flash.countMode" options={COUNT_OPTIONS} />
        {/* The set count; only Count: Set Count uses it. */}
        <SettingNumber
          label="Set count to"
          setting="drills.flash.fixedCount"
          prompt="Count"
          hidden={settings.get('drills.flash.countMode') !== 'fixed'}
        />
        <SettingSelect label="Test mode" setting="drills.flash.testMode" options={TEST_MODE_OPTIONS} />
        {/* Only Warn on error shows error pop-ups, so only it can make them non-blocking. */}
        <OptionSwitch
          label="Non-blocking error pop-ups"
          setting="drills.flash.nonBlockingErrors"
          hidden={settings.get('drills.flash.testMode') !== 'warn'}
        />
      </Section>
      <Section title="Situations">
        <ToggleGroup
          multiple
          variant="outline"
          aria-label="Situations"
          className="w-full flex-wrap p-3"
          value={SITUATIONS.filter(flag => situations[flag])}
          onValueChange={on =>
            settings.set('drills.flash.situations', {
              ...situations,
              ...Object.fromEntries(SITUATIONS.map(flag => [flag, on.includes(flag)])),
            })
          }
        >
          {SITUATION_ITEMS.map(({ flag, label }) => (
            <ToggleGroupItem key={flag} value={flag}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Section>
      {/* Rounds and Infinite may time each hand; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <SettingSelect label="Timer mode" setting="drills.flash.timerMode" options={FLASH_TIMER_OPTIONS} />
        <SettingNumber label="Rounds" setting="drills.flash.handsPerDrill" hidden={mode !== 'auto'} />
        <OptionSwitch label="Time limit per hand" setting="drills.flash.timePerHand" hidden={!handsCanBeTimed} />
        <OptionDuration label="Time per hand" setting="drills.flash.seconds" hidden={!handsTimed} />
        {/* Progressive Speed shortens the time per hand, so it goes with it. */}
        <OptionSwitch label="Progressive Speed" setting="drills.flash.progressiveSpeed" hidden={!handsTimed} />
        <OptionDuration label="Drill time" setting="drills.flash.drillSeconds" hidden={mode !== 'countDownHalt'} />
      </Section>
      <Section title="Error History">
        <ListButton onClick={() => app.open('drills.flash.errors')} data-action="error-history">
          Error history
        </ListButton>
        <ListButton chevron={false} onClick={() => clearErrors(app)}>
          Clear error history
        </ListButton>
      </Section>
    </DrillOptionsScreen>
  );
}

export const flashOptionsScreen = reactScreen(FlashOptions);

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
