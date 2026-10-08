// Peeking: seeing the dealer's hole card and the strategies
// used once it has been seen.

import { SettingChecks, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup } from '@/components/ui/settings-group';
import type { Option, SettingCheck } from '@/components/settings-controls';
import type { SettingValues } from '@/settings/schema';
import { HOLE_CARD_STRATEGY } from '@/settings/strategies';

const NOTE = 'These options are for more advanced play.';

// The first two rows are the one peek mode; clearing both turns peeking off.
const CHECKS: readonly SettingCheck[] = [
  { label: 'Peek at dealer down card', key: 'peeking.mode', value: 'holeCard', off: 'off' },
  { label: 'Peek when dealer peeks', key: 'peeking.mode', value: 'whenDealerPeeks', off: 'off' },
  { label: 'Peek right and left', key: 'peeking.adjacentHands' },
  { label: 'Randomize Card', key: 'peeking.randomizeCard' },
  { label: 'Randomize Hand', key: 'peeking.randomizeHand' },
];

const PERCENTS: readonly Option<SettingValues['peeking.percent']>[] = (
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
).map(value => ({ value, label: `${value}%` }));

const STRATEGIES = [{ value: HOLE_CARD_STRATEGY.id, label: HOLE_CARD_STRATEGY.name }];

export function Peeking() {
  return (
    <SettingsScreen title="Peeking" help="game.peeking" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={CHECKS} />
        <SettingSelect labelled label="Percent of the time" setting="peeking.percent" options={PERCENTS} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingSelect labelled label="HC High" setting="peeking.strategyHigh" options={STRATEGIES} />
        <SettingSelect labelled label="HC Low" setting="peeking.strategyLow" options={STRATEGIES} />
      </SettingsGroup>
    </SettingsScreen>
  );
}
