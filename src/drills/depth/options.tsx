// Depth Drills: Options.

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
  OptionNumber,
  OptionSelect,
  OptionSlider,
  Pair,
  Row,
  Section,
  ValueRow,
  DECK_OPTIONS,
  COUNT_DOWN_HALT_OPTION,
  ACCURACY_OPTIONS,
  TRAY_OPTIONS,
} from '../shared/options-screen.tsx';
import { DRILL_LABELS, isTrueCountDrill, trayStyleFor, TRAY_CAPACITY } from './logic.ts';

type Options<K extends keyof SettingValues> = readonly SelectOption<SettingValues[K]>[];

const DRILL_OPTIONS: Options<'drills.depth.drill'> = (
  ['decksLeft', 'halfDecksLeft', 'quarterDecksLeft', 'acesLeft', 'trueCount', 'trueCountAndDecks'] as const
).map(value => ({ value, label: `Drill: ${DRILL_LABELS[value]}` }));

/** Rounds: a set number of tests, each timed. Count Down & Halt: until the drill time runs out. */
const DEPTH_TIMER_OPTIONS: Options<'drills.depth.timerMode'> = [
  { value: 'auto', label: 'Timer Mode: Rounds' },
  COUNT_DOWN_HALT_OPTION,
];

const RESOLUTION_OPTIONS: Options<'drills.depth.resolution'> = [
  { value: 'full', label: 'Resolution: Full Deck' },
  { value: 'half', label: 'Resolution: Half Deck' },
  { value: 'quarter', label: 'Resolution: Quarter Deck' },
];

function DepthOptions() {
  const app = useApp();
  const settings = useSettings();
  const rounds = settings.get('drills.depth.timerMode') === 'auto';
  const trueCount = isTrueCountDrill(settings.get('drills.depth.drill'));

  return (
    <DrillOptionsScreen title="Depth Options" help="drills.depth.options" onLaunch={() => launch(app)}>
      <Section title="Drill">
        <Group>
          <OptionSelect setting="drills.depth.drill" options={DRILL_OPTIONS} />
          <OptionSelect setting="drills.depth.accuracy" options={ACCURACY_OPTIONS} />
          <OptionSelect setting="drills.depth.resolution" options={RESOLUTION_OPTIONS} />
          <OptionSelect setting="drills.depth.decks" options={DECK_OPTIONS} />
          <OptionSelect setting="drills.depth.trayStyle" options={TRAY_OPTIONS} />
          <Row label="Thickness:">
            <OptionSlider setting="drills.depth.cardThickness" />
          </Row>
        </Group>
      </Section>
      {/* One card for the drill-specific settings: the count range feeds the TC
          Conversion drills, "in tray" the others. Its label follows what it holds. */}
      <Section title={trueCount ? 'Count Range' : 'Answers'}>
        <Group>
          <ValueRow label="Minimum count" hidden={!trueCount}>
            <OptionNumber setting="drills.depth.countRangeMin" prompt="Minimum Count" />
          </ValueRow>
          <ValueRow label="Maximum count" hidden={!trueCount}>
            <OptionNumber setting="drills.depth.countRangeMax" prompt="Maximum Count" />
          </ValueRow>
          <OptionCheck label="Decks or Aces in Tray" setting="drills.depth.askCardsInTray" hidden={trueCount} />
        </Group>
      </Section>
      {/* Rounds times each test; Count Down & Halt times the whole drill. */}
      <Section title="Timer">
        <Group>
          <Pair>
            <OptionSelect setting="drills.depth.timerMode" options={DEPTH_TIMER_OPTIONS} />
            <OptionNumber setting="drills.depth.testsPerDrill" prompt="Rounds" hidden={!rounds} />
          </Pair>
          <OptionDuration label="Time per test" setting="drills.depth.seconds" hidden={!rounds} />
          <OptionCheck label="Progressive Speed" setting="drills.depth.progressiveSpeed" hidden={!rounds} />
          <OptionDuration label="Drill time" setting="drills.depth.drillSeconds" hidden={rounds} />
        </Group>
      </Section>
    </DrillOptionsScreen>
  );
}

export const depthOptionsScreen = reactScreen(DepthOptions, { className: 'drill-options' });

/** Checks the options, correcting the tray style and resolution if need be. */
async function launch(app: App) {
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
  app.open('drills.depth');
}
