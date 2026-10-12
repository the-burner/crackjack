// Gestures: the play each swipe and the double tap makes, for the game and the
// Flash drill, set separately for the device held upright and on its side. A
// configuration is both sets together, chosen and saved as one.

import { ScreenLayout, Column } from '@/components/screen-layout';
import { Select } from '@/components/ui/select';
import { Section, SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { PresetPicker } from '@/components/settings/preset-picker';
import { useApp, useSettings } from '@/react/app-context';
import { ACTION_LABELS, GESTURE_ACTIONS, GESTURE_LABELS, GESTURES, withAction } from '@/core/gestures';
import { GESTURE_PRESETS } from '@/settings/gesture-configs';

const NOTE =
  'Each gesture makes one play, in the game and in the Flash drill. Choosing a play another gesture makes swaps the two. ' +
  'The portrait or the landscape set is used by how the device is held.';

const ACTION_OPTIONS = GESTURE_ACTIONS.map(action => ({ value: action, label: ACTION_LABELS[action] }));

export function Gestures() {
  const app = useApp();
  return (
    <ScreenLayout title="Gestures" help="settings.gestures">
      <Column className="gap-6 pt-1">
        <SettingsNote>{NOTE}</SettingsNote>
        <PresetPicker kind={GESTURE_PRESETS} store={app.gestureConfigs} />
        <OrientationGestures title="Portrait" setting="gestures.portrait" />
        <OrientationGestures title="Landscape" setting="gestures.landscape" />
      </Column>
    </ScreenLayout>
  );
}

/** The five gestures of one orientation. */
function OrientationGestures({
  title,
  setting,
}: {
  title: string;
  setting: 'gestures.portrait' | 'gestures.landscape';
}) {
  const settings = useSettings();
  const map = settings.get(setting);
  return (
    <Section title={title}>
      <SettingsGroup>
        {GESTURES.map(gesture => (
          <Select
            key={gesture}
            label={GESTURE_LABELS[gesture]}
            aria-label={`${title} ${GESTURE_LABELS[gesture]}`}
            options={ACTION_OPTIONS}
            value={map[gesture]}
            onChange={action => settings.set(setting, withAction(map, gesture, action))}
          />
        ))}
      </SettingsGroup>
    </Section>
  );
}
