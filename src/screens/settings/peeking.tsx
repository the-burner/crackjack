// Peeking: seeing the dealer's hole card and the strategies
// used once it has been seen.

import { reactScreen } from '@/react/screen';
import { SettingSelect, SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import { SettingSwitches } from '@/components/settings-controls';
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
    <SettingsScreen title="Peeking" help="settings.peeking" note={NOTE}>
      <SettingsGroup>
        <SettingSwitches items={CHECKS} />
        <SettingSelect label="Percent of the time" setting="peeking.percent" options={PERCENTS} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingSelect label="HC High" setting="peeking.strategyHigh" options={STRATEGIES} />
        <SettingSelect label="HC Low" setting="peeking.strategyLow" options={STRATEGIES} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const peekingScreen = reactScreen(Peeking);
