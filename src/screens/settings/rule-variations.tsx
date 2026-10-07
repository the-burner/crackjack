// Rule Variations: the less common rules.

import { SettingChecks, SettingsScreen } from '@/components/settings-controls';
import { SettingsGroup } from '@/components/ui/settings-group';
import type { SettingCheck } from '@/components/settings-controls';

const NOTE = 'You will find less common rule variations on this screen.';

const DOUBLING: readonly SettingCheck[] = [
  { label: 'Double down on 3 cards', key: 'rules.doubleOnThreeCards' },
  { label: 'ReDouble', key: 'rules.redouble' },
  { label: 'Triple Down', key: 'rules.tripleDown' },
  { label: 'Hit after Double Down', key: 'rules.hitAfterDouble' },
  { label: 'Double Down Rescue', key: 'rules.doubleDownRescue' },
];

// The two resplit limits are one setting; clearing both allows no resplits.
const SPLITTING: readonly SettingCheck[] = [
  { label: 'Resplit to 3 hands', key: 'rules.maxSplitHands', value: 3, off: 2 },
  { label: 'Resplit to 4 hands', key: 'rules.maxSplitHands', value: 4, off: 2 },
  { label: 'Double after ace split', key: 'rules.doubleAfterSplitAces' },
  { label: 'Resplit aces', key: 'rules.resplitAces' },
  { label: 'Multiple draw after ace split', key: 'rules.hitSplitAces' },
  { label: 'Split tens must same value', key: 'rules.splitTensSameRankOnly' },
  { label: 'No ace splits', key: 'rules.noAceSplits' },
  { label: 'No 4, 5, or ten splits', key: 'rules.noSplit4s5s10s' },
];

export function RuleVariations() {
  return (
    <SettingsScreen title="Rule Variations" help="game.ruleVariations" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={DOUBLING} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingChecks items={SPLITTING} />
      </SettingsGroup>
    </SettingsScreen>
  );
}
