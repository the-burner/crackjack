// Bankroll: what the player sits down with.

import { toast } from '@/components/ui/toast';
import { useApp, useSettings } from '@/react/app-context';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { SettingChecks, SettingNumber, SettingsScreen } from '@/components/settings-controls';

export function Bankroll() {
  const app = useApp();
  const settings = useSettings();
  return (
    <SettingsScreen title="Bankroll" help="game.bankroll">
      <Section title="Bankroll">
        <SettingsGroup>
          <SettingNumber label="Starting Bankroll" setting="table.startingBankroll" prompt="Starting Bankroll" />
          <ListRow
            block
            chevron={false}
            onClick={() => {
              app.bankroll.setState({ value: settings.get('table.startingBankroll') });
              toast('Bankroll refreshed');
            }}
          >
            Refresh Bankroll
          </ListRow>
          <SettingChecks items={[{ label: 'Refresh bankroll at startup', key: 'table.refreshBankrollOnStart' }]} />
        </SettingsGroup>
      </Section>
    </SettingsScreen>
  );
}
