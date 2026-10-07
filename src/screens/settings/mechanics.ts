// @ts-nocheck
// Speed/Mechanics: the three speed sliders and the operational switches.

import { group, settingsScreen } from './controls.ts';

const NOTE = 'Operational controls are found here. Move speed controls to the right for faster operation.';

const CHECKS = [
  { label: 'Sound on', key: 'display.sound' },
  { label: 'Use quieter sound for errors', key: 'display.quietErrorSound' },
  { label: 'Refresh bankroll at startup', key: 'table.refreshBankrollOnStart' },
  { label: 'Hide Buttons', key: 'display.hideActionButtons' },
  { label: 'Hide discard tray', key: 'display.hideDiscardTray' },
  { label: 'Hide shoe', key: 'display.hideShoe' },
  { label: 'Players come and go', key: 'table.playersComeAndGo' },
];

export function mechanicsScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Speed/Ops', help: 'settings.mechanics', note: NOTE });
  columns.append(
    group(
      form.slider('Dealer Speed', 'mechanics.dealerSpeed'),
      form.slider('Other Player Speed', 'mechanics.otherPlayerSpeed'),
      form.slider('Payoff Speed', 'mechanics.payoffSpeed'),
    ),
    group(form.checks(CHECKS)),
  );
  return { el };
}
