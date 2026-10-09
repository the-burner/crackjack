// Speed/Mechanics: the three speed sliders and the operational switches.

import { SettingChecks, SettingSlider, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup } from '@/components/ui/settings-group';
import type { SettingCheck } from '@/components/settings-controls';

const NOTE = 'Operational controls are found here. Move speed controls to the right for faster operation.';

const CHECKS: readonly SettingCheck[] = [
  { label: 'Refresh bankroll at startup', key: 'table.refreshBankrollOnStart' },
  { label: 'Hide Buttons', key: 'display.hideActionButtons' },
  { label: 'Hands-off mode', key: 'display.handsOff' },
  { label: 'Hide discard tray', key: 'display.hideDiscardTray' },
  { label: 'Hide shoe', key: 'display.hideShoe' },
  { label: 'Players come and go', key: 'table.playersComeAndGo' },
];

export function Mechanics() {
  return (
    <SettingsScreen title="Speed/Ops" help="game.mechanics" note={NOTE}>
      <SettingsGroup>
        <SettingSlider label="Dealer Speed" setting="mechanics.dealerSpeed" />
        <SettingSlider label="Other Player Speed" setting="mechanics.otherPlayerSpeed" />
        <SettingSlider label="Payoff Speed" setting="mechanics.payoffSpeed" />
      </SettingsGroup>
      <SettingsGroup>
        <SettingChecks items={CHECKS} />
      </SettingsGroup>
    </SettingsScreen>
  );
}
