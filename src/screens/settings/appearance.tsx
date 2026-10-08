// Appearance and Sound: the colour theme and the sound effects, for the whole app.

import { SettingChecks, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';
import { Section, SettingsGroup } from '@/components/ui/settings-group';
import { THEMES } from '@/lib/theme';

const SOUND: readonly SettingCheck[] = [
  { label: 'Sound on', key: 'display.sound' },
  { label: 'Use quieter sound for errors', key: 'display.quietErrorSound' },
];

export function Appearance() {
  return (
    <SettingsScreen title="Appearance & Sound" help="settings.appearance">
      <Section title="Theme">
        <SettingsGroup>
          <SettingSelect label="Theme" setting="display.theme" options={THEMES} />
        </SettingsGroup>
      </Section>
      <Section title="Sound">
        <SettingsGroup>
          <SettingChecks items={SOUND} />
        </SettingsGroup>
      </Section>
    </SettingsScreen>
  );
}
