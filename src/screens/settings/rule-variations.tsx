// Rule Variations: the less common rules.

import { reactScreen } from '@/react/screen';
import { SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import { SettingSwitches } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';

const NOTE = 'You will find less common rule variations on this screen.';

const DOUBLING: readonly SettingCheck[] = [
  { label: 'Double down on 3 cards', key: 'rules.doubleOnThreeCards' },
  { label: 'Double down any # of cards', key: 'rules.doubleAnyNumberOfCards' },
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
    <SettingsScreen title="Rule Variations" help="settings.ruleVariations" note={NOTE}>
      <SettingsGroup>
        <SettingSwitches items={DOUBLING} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingSwitches items={SPLITTING} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const ruleVariationsScreen = reactScreen(RuleVariations);
