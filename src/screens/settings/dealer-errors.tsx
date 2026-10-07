// Dealer Errs/Biases: deliberate dealer mistakes and a
// non-random dealing bias.

import { SettingChecks, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup } from '@/components/ui/settings-group';
import type { Option, SettingCheck } from '@/components/settings-controls';
import type { SettingValues } from '@/settings/schema';

const NOTE = 'The dealer can be made to deal cards non-randomly or make errors. Catching errors is important.';

const BIASES: readonly Option<SettingValues['dealerErrors.dealingBias']>[] = [
  { value: 'none', label: 'No bias' },
  { value: 'positiveCounts', label: 'Positive counts' },
  { value: 'negativeCounts', label: 'Negative counts' },
  { value: 'manyCardHands', label: 'Many card hands' },
  { value: 'repeatErrors', label: 'Repeat errors' },
  { value: 'difficultHands', label: 'Difficult hands' },
];

const ERRORS: readonly SettingCheck[] = [
  { label: 'Insurance payoff errors', key: 'dealerErrors.insurancePayoff' },
  { label: 'Blackjack payoff errors', key: 'dealerErrors.blackjackPayoff' },
  { label: 'No payoff on win', key: 'dealerErrors.noPayOnWin' },
  { label: 'Bust on 21 or less', key: 'dealerErrors.bustOn21OrLess' },
  { label: 'Stand on 16', key: 'dealerErrors.standOn16' },
  { label: 'Dealer should have busted', key: 'dealerErrors.shouldHaveBusted' },
  { label: 'Lose on a push', key: 'dealerErrors.loseOnPush' },
  { label: 'No bonus or side bet payoff', key: 'dealerErrors.noBonusPayoff' },
];

export function DealerErrors() {
  return (
    <SettingsScreen title="Errs/Biases" help="settings.dealerErrors" note={NOTE}>
      <SettingsGroup>
        <SettingSelect label="Dealing bias" setting="dealerErrors.dealingBias" options={BIASES} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingChecks items={ERRORS} />
      </SettingsGroup>
    </SettingsScreen>
  );
}
