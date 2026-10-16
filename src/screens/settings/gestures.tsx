// Gestures: the play each swipe and the double tap makes, for the game and the
// Flash drill, set separately for the device held upright and on its side. A
// configuration is both sets together, chosen and saved as one. Each gesture
// also has a key, for a keyboard or a remote.

import { ScreenLayout, Column } from '@/components/screen-layout';
import { Select } from '@/components/ui/select';
import { Section, SettingsGroup, SettingsNote, SettingsRow } from '@/components/ui/settings-group';
import { KeyButton } from '@/components/ui/key-button';
import { PresetPicker } from '@/components/settings/preset-picker';
import { useApp, useSettings } from '@/react/app-context';
import { ACTION_LABELS, GESTURE_ACTIONS, GESTURE_LABELS, GESTURES, withAction, withKey } from '@/core/gestures';
import { GESTURE_PRESETS } from '@/settings/gesture-configs';

const NOTE =
  'Each gesture makes one play, in Blackjack and in Playing Strategy Flash Cards. Choosing a play another gesture makes swaps the two. ' +
  'The portrait or the landscape set is used by how the device is held. ' +
  'On a keyboard or a remote, each gesture’s key makes it too.';

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

/** The five gestures of one orientation, each with its play and its key. */
function OrientationGestures({
  title,
  setting,
}: {
  title: string;
  setting: 'gestures.portrait' | 'gestures.landscape';
}) {
  const settings = useSettings();
  const map = settings.get(setting);
  const keys = settings.get('gestures.keys');
  return (
    <Section title={title}>
      <SettingsGroup>
        {GESTURES.map(gesture => (
          <SettingsRow key={gesture}>
            <Select
              label={GESTURE_LABELS[gesture]}
              aria-label={`${title} ${GESTURE_LABELS[gesture]}`}
              options={ACTION_OPTIONS}
              value={map[gesture]}
              onChange={action => settings.set(setting, withAction(map, gesture, action))}
            />
            {/* The key is the same either way up. */}
            <KeyButton
              label={`${title} ${GESTURE_LABELS[gesture]} key`}
              value={keys[gesture]}
              onChange={key => settings.set('gestures.keys', withKey(keys, gesture, key))}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>
    </Section>
  );
}
