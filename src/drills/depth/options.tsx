// Depth Drills: Options.

import type { App } from '@/app/app';
import { useApp, useSettings } from '@/react/app-context';
import { Section } from '@/components/screen-layout';
import { SettingNumber, SettingSelect } from '@/components/settings-controls';
import type { Option } from '@/components/settings-controls';
import { alert } from '@/components/dialogs';
import type { SettingValues } from '@/settings/schema';
import {
  DrillOptionsScreen,
  OptionDuration,
  OptionSlider,
  OptionSwitch,
  DECK_OPTIONS,
  COUNT_DOWN_HALT_OPTION,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
} from '@/drills/shared/options-screen';
import { DRILL_LABELS, isTrueCountDrill, trayStyleFor, TRAY_CAPACITY } from './logic';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';

type Options<K extends keyof SettingValues> = readonly Option<SettingValues[K]>[];

const DRILL_OPTIONS: Options<'drills.depth.drill'> = (
  ['decksLeft', 'halfDecksLeft', 'quarterDecksLeft', 'acesLeft', 'trueCount', 'trueCountAndDecks'] as const
).map(value => ({ value, label: DRILL_LABELS[value] }));

/** Rounds: a set number of tests, each timed. Count Down & Halt: until the drill time runs out. */
const DEPTH_TIMER_OPTIONS: Options<'drills.depth.timerMode'> = [
  { value: 'auto', label: 'Rounds' },
  COUNT_DOWN_HALT_OPTION,
];

const RESOLUTION_OPTIONS: Options<'drills.depth.resolution'> = [
  { value: 'full', label: 'Full Deck' },
  { value: 'half', label: 'Half Deck' },
  { value: 'quarter', label: 'Quarter Deck' },
];

export function DepthOptions() {
  const app = useApp();
  const navigate = useNavigate();
  const settings = useSettings();
  const rounds = settings.get('drills.depth.timerMode') === 'auto';
  const trueCount = isTrueCountDrill(settings.get('drills.depth.drill'));

  return (
    <DrillOptionsScreen
      title="Depth Options"
      help="drills.depth.options"
      onLaunch={() => launch(app, () => navigate(PATHS['drills.depth']))}
    >
      <Section title="Drill">
        <SettingSelect label="Drill" setting="drills.depth.drill" options={DRILL_OPTIONS} />
        <SettingSelect label="Accuracy" setting="drills.depth.accuracy" options={ACCURACY_OPTIONS} />
        <SettingSelect label="Resolution" setting="drills.depth.resolution" options={RESOLUTION_OPTIONS} />
        <SettingSelect label="Decks" setting="drills.depth.decks" options={DECK_OPTIONS} />
        <SettingSelect label="Tray style" setting="drills.depth.trayStyle" options={TRAY_OPTIONS} />
        <OptionSlider label="Thickness" setting="drills.depth.cardThickness" />
      </Section>
      {/* One group for the drill-specific settings: the count range feeds the TC
          Conversion drills, "in tray" the others. Its title follows what it holds. */}
      <Section title={trueCount ? 'Count Range' : 'Answers'}>
        <SettingNumber
          label="Minimum count"
          setting="drills.depth.countRangeMin"
          prompt="Minimum Count"
          hidden={!trueCount}
        />
        <SettingNumber
          label="Maximum count"
          setting="drills.depth.countRangeMax"
          prompt="Maximum Count"
          hidden={!trueCount}
        />
        <OptionSwitch label="Decks or Aces in Tray" setting="drills.depth.askCardsInTray" hidden={trueCount} />
      </Section>
      {/* Rounds times each test; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <SettingSelect label="Timer mode" setting="drills.depth.timerMode" options={DEPTH_TIMER_OPTIONS} />
        <SettingNumber label="Rounds" setting="drills.depth.testsPerDrill" hidden={!rounds} />
        <OptionDuration label="Time per test" setting="drills.depth.seconds" hidden={!rounds} />
        <OptionSwitch label="Progressive Speed" setting="drills.depth.progressiveSpeed" hidden={!rounds} />
        <OptionDuration label="Drill time" setting="drills.depth.drillSeconds" hidden={rounds} />
      </Section>
    </DrillOptionsScreen>
  );
}

/** Checks the options, correcting the tray style and resolution if need be. */
/** Checks the options, then opens the drill with `open`. */
async function launch(app: App, open: () => void) {
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
    await alert(
      'Full resolution needs more than one deck: there would be nothing to ask. Resolution changed to Half Deck.',
    );
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
  open();
}
