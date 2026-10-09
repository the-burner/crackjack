// Flash Drills: Options.

import type { App } from '@/app/app';
import { toast } from '@/components/ui/toast';
import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { ListRow, Section, SettingsRow } from '@/components/ui/settings-group';
import { ValueButton } from '@/components/ui/value-button';
import { SettingSelect } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import { alert, confirm } from '@/components/dialogs';
import type { SettingValues } from '@/settings/schema';
import {
  DrillOptionsScreen,
  OptionDuration,
  OptionGroup,
  OptionSwitch,
  COUNT_DOWN_HALT_OPTION,
} from '@/drills/shared/options-screen';
import { drillStrategy } from '@/drills/shared/drill-settings';
import { buildHandList, SITUATIONS, SITUATION_LABELS, errorCellsAsHands, describeEntry } from './logic';
import { useNavigate } from 'react-router';
import { PATHS, tablesSearch } from '@/app/paths';

type Options<K extends keyof SettingValues> = readonly Option<SettingValues[K]>[];

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
  const navigate = useNavigate();
  const settings = useSettings();
  const mode = settings.get('drills.flash.timerMode');
  const hands = settings.get('drills.flash.hands');
  const handsCanBeTimed = TIMED_HAND_MODES.includes(mode);
  const handsTimed = handsCanBeTimed && settings.get('drills.flash.timePerHand');
  const situations = settings.get('drills.flash.situations');
  const decks = `${settings.get('drills.flash.decks')}${settings.get('drills.flash.spanishDecks') ? 's' : ''}`;

  const fixedCount = settings.schema['drills.flash.fixedCount'];
  const rounds = settings.schema['drills.flash.handsPerDrill'];

  return (
    <DrillOptionsScreen
      title="Flash Options"
      help="drills.flash.options"
      onLaunch={() => launch(app, () => navigate(PATHS['drills.flash']))}
    >
      <Section title="Drill">
        <OptionGroup>
          <SettingSelect label="Cards" setting="drills.flash.maxCards" options={CARDS_OPTIONS} />
          {/* One select writes the deck count and whether the decks are Spanish. */}
          <Select
            name="drills.flash.decks"
            aria-label="Decks"
            options={DECK_OPTIONS}
            value={decks}
            onChange={value =>
              settings.update({
                'drills.flash.decks': Number.parseInt(value, 10),
                'drills.flash.spanishDecks': value.endsWith('s'),
              })
            }
          />
          <SettingsRow>
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
            {hands === 'custom' && (
              <Button
                onClick={() =>
                  navigate(
                    PATHS['strategy.tables'] +
                      tablesSearch({
                        mode: 'editMask',
                        maskKey: 'drills.flash.customHands',
                        decks: settings.get('drills.flash.decks'),
                        title: 'Custom Hands',
                      }),
                  )
                }
              >
                Select
              </Button>
            )}
          </SettingsRow>
          <SettingsRow>
            <SettingSelect label="Count" setting="drills.flash.countMode" options={COUNT_OPTIONS} />
            {/* The set count; only Count: Set Count to: uses it. */}
            {settings.get('drills.flash.countMode') === 'fixed' && (
              <ValueButton
                label="Count"
                prompt="Count"
                value={settings.get('drills.flash.fixedCount')}
                min={fixedCount.min}
                max={fixedCount.max}
                onChange={value => settings.set('drills.flash.fixedCount', value)}
              />
            )}
          </SettingsRow>
          <SettingSelect label="Test mode" setting="drills.flash.testMode" options={TEST_MODE_OPTIONS} />
          {/* Only Warn on error shows error pop-ups, so only it can make them non-blocking. */}
          {settings.get('drills.flash.testMode') === 'warn' && (
            <OptionSwitch label="Non-blocking error pop-ups" setting="drills.flash.nonBlockingErrors" />
          )}
        </OptionGroup>
      </Section>
      <Section title="Situations">
        <CheckList
          layout="chips"
          items={SITUATION_ITEMS.map(({ flag, label }) => ({
            label,
            checked: situations[flag],
            onChange: on => settings.set('drills.flash.situations', { ...situations, [flag]: on }),
          }))}
        />
      </Section>
      {/* Rounds and Infinite may time each hand; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <OptionGroup>
          <SettingsRow>
            <SettingSelect label="Timer mode" setting="drills.flash.timerMode" options={FLASH_TIMER_OPTIONS} />
            {mode === 'auto' && (
              <ValueButton
                label="Rounds"
                prompt="Rounds"
                value={settings.get('drills.flash.handsPerDrill')}
                min={rounds.min}
                max={rounds.max}
                onChange={value => settings.set('drills.flash.handsPerDrill', value)}
              />
            )}
          </SettingsRow>
          {handsCanBeTimed && <OptionSwitch label="Time limit per hand" setting="drills.flash.timePerHand" />}
          {handsTimed && <OptionDuration label="Time per hand" setting="drills.flash.seconds" />}
          {/* Progressive Speed shortens the time per hand, so it goes with it. */}
          {handsTimed && <OptionSwitch label="Progressive Speed" setting="drills.flash.progressiveSpeed" />}
          {mode === 'countDownHalt' && <OptionDuration label="Drill time" setting="drills.flash.drillSeconds" />}
          {/* Infinite never ends, so it can pause by itself every so often. */}
          {mode === 'infinite' && <OptionSwitch label="Pause every interval" setting="drills.flash.autoPause" />}
          {mode === 'infinite' && settings.get('drills.flash.autoPause') && (
            <OptionDuration label="Interval" setting="drills.flash.autoPauseSeconds" />
          )}
        </OptionGroup>
      </Section>
      <Section title="Error History">
        <OptionGroup>
          <ListRow block onClick={() => navigate(PATHS['drills.flash.errors'])} data-action="error-history">
            Error history
          </ListRow>
          <ListRow block chevron={false} onClick={() => clearErrors(app)}>
            Clear error history
          </ListRow>
        </OptionGroup>
      </Section>
    </DrillOptionsScreen>
  );
}

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

/** Checks the options, then opens the drill with `open`. */
async function launch(app: App, open: () => void) {
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
  open();
}
