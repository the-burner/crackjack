// Appearance and Customization: the colour theme.

import { SettingSelect, SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import { THEMES } from '@/lib/theme';

export function Appearance() {
  return (
    <SettingsScreen title="Appearance" help="settings.appearance">
      <SettingsGroup>
        <SettingSelect label="Theme" setting="display.theme" options={THEMES} />
      </SettingsGroup>
    </SettingsScreen>
  );
}
