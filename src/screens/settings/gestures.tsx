// Gestures: the play each swipe and the double tap makes, for the game and the
// Flash drill, set separately for the device held upright and on its side. A
// configuration is both sets together, chosen and saved as one.

import { useStore } from 'zustand';
import { ScreenLayout, Column } from '@/components/screen-layout';
import { confirm, prompt } from '@/components/dialogs';
import { Select } from '@/components/ui/select';
import { ListRow, Section, SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { toast } from '@/components/ui/toast';
import { useApp, useSettings } from '@/react/app-context';
import { ACTION_LABELS, GESTURE_ACTIONS, GESTURE_LABELS, GESTURES, configFor, withAction } from '@/core/gestures';
import { allConfigs, deleteConfig, saveConfig } from '@/settings/gesture-configs';

const NOTE =
  'Each gesture makes one play, in the game and in the Flash drill. Choosing a play another gesture makes swaps the two. ' +
  'The portrait or the landscape set is used by how the device is held.';

const ACTION_OPTIONS = GESTURE_ACTIONS.map(action => ({ value: action, label: ACTION_LABELS[action] }));

export function Gestures() {
  const app = useApp();
  const settings = useSettings();
  const saved = useStore(app.gestureConfigs, state => state.value);
  const portrait = settings.get('gestures.portrait');
  const landscape = settings.get('gestures.landscape');
  const configs = allConfigs(saved);
  const current = configFor(portrait, landscape, configs);
  const options = [
    ...configs.map(config => ({ value: config.id, label: config.name })),
    ...(current ? [] : [{ value: 'custom', label: 'Custom' }]),
  ];

  async function saveAs() {
    const name = await prompt('Save these gestures as:', current && !current.builtIn ? current.name : '');
    if (name === null) return;
    const result = saveConfig(saved, name, { portrait, landscape });
    if (!result.configs) {
      toast(result.error, { tone: 'error' });
      return;
    }
    app.gestureConfigs.setState({ value: result.configs });
    toast(`Saved “${result.saved.name}”`);
  }

  async function remove() {
    if (!current || current.builtIn) return;
    if (!(await confirm(`Delete the configuration “${current.name}”?`))) return;
    app.gestureConfigs.setState({ value: deleteConfig(saved, current.id) });
  }

  return (
    <ScreenLayout title="Gestures" help="settings.gestures">
      <Column className="gap-6 pt-1">
        <SettingsNote>{NOTE}</SettingsNote>
        <SettingsGroup>
          <Select
            label="Configuration"
            options={options}
            value={current?.id ?? 'custom'}
            onChange={id => {
              const chosen = configs.find(config => config.id === id);
              if (chosen)
                settings.update({ 'gestures.portrait': chosen.portrait, 'gestures.landscape': chosen.landscape });
            }}
          />
          <ListRow block chevron={false} onClick={saveAs}>
            Save as…
          </ListRow>
          {current && !current.builtIn && (
            <ListRow block chevron={false} onClick={remove}>
              {`Delete “${current.name}”`}
            </ListRow>
          )}
        </SettingsGroup>
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
