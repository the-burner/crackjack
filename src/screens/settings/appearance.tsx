// Appearance and Customization: the colour theme.

import { SettingSelect, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup } from '@/components/ui/settings-group';
import { Field } from '@/components/ui/text';
import { THEMES } from '@/lib/theme';

export function Appearance() {
  return (
    <SettingsScreen title="Appearance" help="settings.appearance">
      <SettingsGroup>
        <Field label="Theme">
          <SettingSelect label="Theme" setting="display.theme" options={THEMES} />
        </Field>
      </SettingsGroup>
    </SettingsScreen>
  );
}
