// Peeking: seeing the dealer's hole card and the strategies
// used once it has been seen.

import type { ReactNode } from 'react';
import { SettingChecks, SettingSelect, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Label } from '@/components/ui/text';
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
        <SettingsRow label="Percent of the time:" trailing className="[&>[data-slot=select]]:flex-[0_0_110px]">
          <SettingSelect label="Percent of the time" setting="peeking.percent" options={PERCENTS} mini />
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup>
        <TrailingLabel label="HC High">
          <SettingSelect label="HC High" setting="peeking.strategyHigh" options={STRATEGIES} />
        </TrailingLabel>
        <TrailingLabel label="HC Low">
          <SettingSelect label="HC Low" setting="peeking.strategyLow" options={STRATEGIES} />
        </TrailingLabel>
      </SettingsGroup>
    </SettingsScreen>
  );
}

/** A control with its label to the right of it. */
function TrailingLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <SettingsRow trailing>
      {children}
      <Label className="flex-none font-normal">{label}</Label>
    </SettingsRow>
  );
}
