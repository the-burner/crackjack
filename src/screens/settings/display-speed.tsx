// Display and Speed: how fast the table plays, and whether its buttons show.

import { SettingChecks, SettingSlider, SettingsScreen } from '@/components/settings-controls';
import { Section, SettingsGroup } from '@/components/ui/settings-group';
import type { SettingCheck } from '@/components/settings-controls';

const DISPLAY: readonly SettingCheck[] = [{ label: 'Hide Buttons', key: 'display.hideActionButtons' }];

export function DisplaySpeed() {
  return (
    <SettingsScreen title="Display and Speed" help="game.display">
      <Section title="Speed">
        <SettingsGroup>
          <SettingSlider label="Dealer Speed" setting="mechanics.dealerSpeed" />
          <SettingSlider label="Other Player Speed" setting="mechanics.otherPlayerSpeed" />
          <SettingSlider label="Payoff Speed" setting="mechanics.payoffSpeed" />
        </SettingsGroup>
      </Section>
      <Section title="Display">
        <SettingsGroup>
          <SettingChecks items={DISPLAY} />
        </SettingsGroup>
      </Section>
    </SettingsScreen>
  );
}
