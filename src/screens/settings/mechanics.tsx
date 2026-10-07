// Speed/Mechanics: the three speed sliders and the operational switches.

import { reactScreen } from '../../react/screen.tsx';
import { SettingChecks, SettingSlider, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import type { SettingCheck } from '../../react/settings-form.tsx';

const NOTE = 'Operational controls are found here. Move speed controls to the right for faster operation.';

const CHECKS: readonly SettingCheck[] = [
  { label: 'Sound on', key: 'display.sound' },
  { label: 'Use quieter sound for errors', key: 'display.quietErrorSound' },
  { label: 'Refresh bankroll at startup', key: 'table.refreshBankrollOnStart' },
  { label: 'Hide Buttons', key: 'display.hideActionButtons' },
  { label: 'Hide discard tray', key: 'display.hideDiscardTray' },
  { label: 'Hide shoe', key: 'display.hideShoe' },
  { label: 'Players come and go', key: 'table.playersComeAndGo' },
];

function Mechanics() {
  return (
    <SettingsScreen title="Speed/Ops" help="settings.mechanics" note={NOTE}>
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

export const mechanicsScreen = reactScreen(Mechanics, { className: 'settings' });
