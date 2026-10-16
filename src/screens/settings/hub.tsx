// Settings: the screens whose settings apply to the whole app (every module).
// Each module's own settings are on its own screen.

import { Column, ScreenLayout } from '@/components/screen-layout';
import { confirm } from '@/components/dialogs';
import { useApp } from '@/react/app-context';
import type { App } from '@/app/app';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

const NOTE = 'These settings apply to every module.';

const RESET_NOTE =
  'Puts the app back as it was when first installed: every setting, the game’s and every drill’s, to its default, and the bankroll, statistics, error history and saved strategies and gesture configurations erased.';

const SCREENS: readonly (readonly [string, ScreenName])[] = [
  ['Playing Strategy', 'settings.strategy'],
  ['Betting Strategy', 'settings.betting'],
  ['True Count Calcs', 'settings.trueCount'],
  ['Appearance & Sound', 'settings.appearance'],
  ['Gestures', 'settings.gestures'],
];

export function SettingsHub() {
  const app = useApp();
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Settings" help="settings">
      <Column className="gap-6 pt-1">
        <Section footer={NOTE}>
          <SettingsGroup>
            {SCREENS.map(([label, screen]) => (
              <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                {label}
              </ListRow>
            ))}
          </SettingsGroup>
        </Section>
        <Section footer={RESET_NOTE}>
          <SettingsGroup>
            <ListRow block chevron={false} className="text-(--warning)" onClick={() => resetDefaults(app)}>
              Reset Defaults
            </ListRow>
          </SettingsGroup>
        </Section>
      </Column>
    </ScreenLayout>
  );
}

async function resetDefaults(app: App) {
  if (!(await confirm('Erase everything saved and put every setting back to its default?'))) return;
  app.storage.clear();
  app.restart();
}
