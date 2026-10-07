// Common Rules.

import { reactScreen } from '../../react/screen.tsx';
import { SettingChecks, SettingSelect, SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import type { SettingCheck } from '../../react/settings-form.tsx';
import { TABLE_LIMITS } from '../../settings/schema.ts';
import type { SettingValues } from '../../settings/schema.ts';
import type { SelectOption } from '../../ui/components.ts';

const NOTE = 'Common rule variations are set using this screen.';

const CHECKS: readonly SettingCheck[] = [
  { label: 'Cards dealt face down', key: 'table.cardsFaceDown' },
  { label: 'DD card dealt face up', key: 'table.doubleDownCardFaceUp' },
  { label: 'Double down after split', key: 'rules.doubleAfterSplit' },
  { label: 'Dealer hits soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No dealer hole card', key: 'rules.noHoleCard' },
  { label: 'Dealer BJ wins all', key: 'rules.dealerBlackjackWinsAll' },
];

const HARD_DOUBLES: readonly SelectOption<SettingValues['rules.hardDoubles']>[] = [
  { value: 'none', label: 'No hard doubles' },
  { value: '10-11', label: 'Double 10-11' },
  { value: '9-11', label: 'Double 9-11' },
  { value: '8-11', label: 'Double 8-11' },
  { value: 'any', label: 'Any hard doubles' },
];

const SOFT_DOUBLES: readonly SelectOption<SettingValues['rules.softDoubles']>[] = [
  { value: 'none', label: 'No soft doubles' },
  { value: 'a8a9', label: 'Soft double A8 or A9 only' },
  { value: 'any', label: 'Any soft doubles' },
];

const INSURANCE: readonly SelectOption<SettingValues['rules.insurance']>[] = [
  { value: 'none', label: 'No Insurance' },
  { value: 'normal', label: 'Insurance' },
  { value: 'blackjackOnly', label: 'Insure BJ only' },
];

const SURRENDER: readonly SelectOption<SettingValues['rules.surrender']>[] = [
  { value: 'none', label: 'No Surrender' },
  { value: 'late', label: 'Late Surrender (common)' },
  { value: 'early', label: 'Early Surrender (rare)' },
  { value: 'earlyVsTen', label: 'Early Surrender vs. 10' },
  { value: 'macao', label: 'Macao Surrender' },
];

const LIMITS = TABLE_LIMITS.map(([min, max], value) => ({ value, label: `Limits: $${min} to $${max}` }));

function CommonRules() {
  return (
    <SettingsScreen title="Common Rules" help="settings.commonRules" note={NOTE}>
      <SettingsGroup>
        <SettingChecks items={CHECKS} />
      </SettingsGroup>
      <SettingsGroup>
        <SettingSelect setting="rules.hardDoubles" options={HARD_DOUBLES} />
        <SettingSelect setting="rules.softDoubles" options={SOFT_DOUBLES} />
        <SettingSelect setting="rules.insurance" options={INSURANCE} />
        <SettingSelect setting="rules.surrender" options={SURRENDER} />
        <SettingSelect setting="table.limits" options={LIMITS} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const commonRulesScreen = reactScreen(CommonRules, { className: 'settings' });
