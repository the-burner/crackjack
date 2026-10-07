// Peeking: seeing the dealer's hole card and the strategies
// used once it has been seen.

import type { ReactNode } from 'react';
import { reactScreen } from '../../react/screen.tsx';
import { SettingChecks, SettingSelect, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import type { SettingCheck } from '../../react/settings-form.tsx';
import type { SettingValues } from '../../settings/schema.ts';
import { HOLE_CARD_STRATEGY } from '../../settings/strategies.ts';
import type { SelectOption } from '../../ui/components.ts';

const NOTE = 'These options are for more advanced play.';

// The first two rows are the one peek mode; clearing both turns peeking off.
const CHECKS: readonly SettingCheck[] = [
  { label: 'Peek at dealer down card', key: 'peeking.mode', value: 'holeCard', off: 'off' },
  { label: 'Peek when dealer peeks', key: 'peeking.mode', value: 'whenDealerPeeks', off: 'off' },
  { label: 'Peek right and left', key: 'peeking.adjacentHands' },
  { label: 'Randomize Card', key: 'peeking.randomizeCard' },
  { label: 'Randomize Hand', key: 'peeking.randomizeHand' },
];

const PERCENTS: readonly SelectOption<SettingValues['peeking.percent']>[] = (
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
).map(value => ({ value, label: `${value}%` }));

const STRATEGIES = [{ value: HOLE_CARD_STRATEGY.id, label: HOLE_CARD_STRATEGY.name }];

/** A control with its label to the right of it. */
const TrailingLabel = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="settings-row settings-row--trailing">
    {children}
    <span className="label">{label}</span>
  </div>
);

export function Peeking() {
  return (
    <SettingsScreen title="Peeking" help="settings.peeking" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={CHECKS} />
        <div className="settings-row peeking-modes">
          <span className="label">Percent of the time:</span>
          <SettingSelect setting="peeking.percent" options={PERCENTS} mini />
        </div>
      </SettingsGroup>
      <SettingsGroup>
        <TrailingLabel label="HC High">
          <SettingSelect setting="peeking.strategyHigh" options={STRATEGIES} />
        </TrailingLabel>
        <TrailingLabel label="HC Low">
          <SettingSelect setting="peeking.strategyLow" options={STRATEGIES} />
        </TrailingLabel>
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const peekingScreen = reactScreen(Peeking, { className: 'settings' });
