// Settings: the screens whose settings apply to the whole app (the game and
// every drill). The game's own settings are on Game Options.

import { ScreenLayout } from '@/components/screen-layout';
import { ListRow, Section, SettingsCols, SettingsGroup } from '@/components/ui/settings-group';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

const NOTE = 'These settings apply to the game and to all four drills.';

const SCREENS: readonly (readonly [string, ScreenName])[] = [
  ['Playing Strategies', 'settings.strategy'],
  ['True Count Calcs', 'settings.trueCount'],
  ['Appearance & Sound', 'settings.appearance'],
];

export function SettingsHub() {
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Settings" help="settings">
      <SettingsCols className="gap-6 pt-1">
        <Section footer={NOTE}>
          <SettingsGroup>
            {SCREENS.map(([label, screen]) => (
              <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                {label}
              </ListRow>
            ))}
          </SettingsGroup>
        </Section>
      </SettingsCols>
    </ScreenLayout>
  );
}
