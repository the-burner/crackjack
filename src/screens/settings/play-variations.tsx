// Play Variations: dealer behavior and unusual rules.

import { reactScreen } from '../../react/screen.tsx';
import { SettingChecks, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import type { SettingCheck } from '../../react/settings-form.tsx';

const NOTE = 'Dealer behavior and unusual rules.';

const DEALER: readonly SettingCheck[] = [
  { label: 'Dealer makes obvious plays', key: 'mechanics.dealerMakesObviousPlays' },
  { label: 'Dealer points out stupid plays', key: 'mechanics.dealerPointsOutStupidPlays' },
  { label: 'Insure then Surrender allowed', key: 'rules.surrenderAfterInsurance' },
  { label: 'Dealer shows burn cards', key: 'table.showBurnCards' },
  { label: 'Dealer peeks on ten', key: 'rules.dealerPeeksTen' },
  { label: 'Dealer peeks on ace', key: 'rules.dealerPeeksAce' },
];

const HANDS: readonly SettingCheck[] = [
  { label: 'Dealer wins tied 17', key: 'rules.dealerWinsTied17' },
  { label: 'Dealer wins ties', key: 'rules.dealerWinsTies' },
  { label: 'Five unbusted cards wins', key: 'rules.autoWinFiveCards' },
  { label: 'Six unbusted cards wins', key: 'rules.autoWinSixCards' },
  { label: 'Seven unbusted cards wins', key: 'rules.autoWinSevenCards' },
  { label: 'Player 22 counts as 21', key: 'rules.player22CountsAs21' },
  { label: 'Dealer ties 17, 18 and 19', key: 'rules.dealerWinsTies17to19' },
];

function PlayVariations() {
  return (
    <SettingsScreen title="Play Variations" help="settings.playVariations" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={DEALER} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingChecks items={HANDS} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const playVariationsScreen = reactScreen(PlayVariations, { className: 'settings' });
