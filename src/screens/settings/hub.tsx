// Settings: the screens whose settings apply to the whole app (the game and
// every drill). The game's own settings are on Game Options.

import { Column, ScreenLayout } from '@/components/screen-layout';
import { confirm } from '@/components/dialogs';
import { toast } from '@/components/ui/toast';
import { useApp } from '@/react/app-context';
import type { App } from '@/app/app';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

const NOTE = 'These settings apply to the game and to all four drills.';

const RESET_NOTE =
  'Resets every setting in the app, the game’s and every drill’s, to its default. The bankroll, statistics and error history are kept.';

const SCREENS: readonly (readonly [string, ScreenName])[] = [
  ['Playing Strategies', 'settings.strategy'],
  ['True Count Calcs', 'settings.trueCount'],
  ['Appearance & Sound', 'settings.appearance'],
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
            <ListRow block chevron={false} onClick={() => resetDefaults(app)}>
              Reset Defaults
            </ListRow>
          </SettingsGroup>
        </Section>
      </Column>
    </ScreenLayout>
  );
}

async function resetDefaults(app: App) {
  if (!(await confirm('Reset every setting in the app to its default?'))) return;
  app.settings.reset();
  toast('Settings reset to defaults');
}
