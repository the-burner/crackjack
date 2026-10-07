// Appearance and Customization: the colour theme.

import { Field } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';
import { SettingSelect, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import { THEMES } from '../../ui/theme.ts';

export function Appearance() {
  return (
    <SettingsScreen title="Appearance" help="settings.appearance">
      <SettingsGroup>
        <Field label="Theme">
          <SettingSelect setting="display.theme" options={THEMES} />
        </Field>
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const appearanceScreen = reactScreen(Appearance, { className: 'settings' });
