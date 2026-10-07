// Bonuses: blackjack payouts and oddball bonus payouts.

import { reactScreen } from '../../react/screen.tsx';
import { SettingChecks, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import type { SettingCheck } from '../../react/settings-form.tsx';

const NOTE = 'Oddball bonuses are found here.';

// The three payout rows are one setting; clearing them all pays the usual 3:2.
const BLACKJACK: readonly SettingCheck[] = [
  { label: 'Player BJ always wins', key: 'rules.playerBlackjackAlwaysWins' },
  { label: 'Blackjack pays 2:1', key: 'rules.blackjackPayout', value: '2:1', off: '3:2' },
  { label: 'No Blackjack bonus', key: 'rules.blackjackPayout', value: '1:1', off: '3:2' },
  { label: 'Blackjack pays 6:5', key: 'rules.blackjackPayout', value: '6:5', off: '3:2' },
  { label: 'Diamond BJ pays 2:1', key: 'bonuses.diamondBlackjack' },
  { label: 'Ace/Jack of Hearts pays 2:1', key: 'bonuses.heartsAceJack' },
  { label: 'Suited Ace/Jack pays 2:1', key: 'bonuses.suitedAceJack' },
  { label: 'Blackjack rounded up', key: 'rules.blackjackRoundUp' },
];

const HANDS: readonly SettingCheck[] = [
  { label: '777 pays 2:1', key: 'bonuses.sevens777', value: '2:1', off: 'none' },
  { label: '777 pays 3:2', key: 'bonuses.sevens777', value: '3:2', off: 'none' },
  { label: 'Suited 777 pays 10:1', key: 'bonuses.sevens777', value: 'suited10:1', off: 'none' },
  { label: 'Five card 21 pays 2:1', key: 'bonuses.fiveCard21' },
  { label: 'Six card 21 pays 2:1', key: 'bonuses.sixCard21' },
  { label: 'Five or more card 21 pays 2:1', key: 'bonuses.fivePlusCard21' },
  { label: 'Suited 678 pays 2:1', key: 'bonuses.suited678' },
  { label: 'Suited 678 pays 2:1 if wins', key: 'bonuses.suited678IfWins' },
  { label: 'Split tens then draw ace is BJ', key: 'bonuses.splitTenAceIsBlackjack' },
];

export function Bonuses() {
  return (
    <SettingsScreen title="Bonuses" help="settings.bonuses" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={BLACKJACK} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingChecks items={HANDS} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const bonusesScreen = reactScreen(Bonuses, { className: 'settings' });
