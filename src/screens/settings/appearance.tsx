// Appearance and Customization: the colour theme.

import { reactScreen } from '@/react/screen';
import { SettingSelect, SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import { THEMES } from '@/ui/theme';

export function Appearance() {
  return (
    <SettingsScreen title="Appearance" help="settings.appearance">
      <SettingsGroup>
        <SettingSelect label="Theme" setting="display.theme" options={THEMES} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const appearanceScreen = reactScreen(Appearance);
