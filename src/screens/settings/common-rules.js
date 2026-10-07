// Common Rules.

import { TABLE_LIMITS } from '../../settings/schema.js';
import { group, settingsScreen } from './controls.js';

const NOTE = 'Common rule variations are set using this screen.';

const CHECKS = [
  { label: 'Cards dealt face down', key: 'table.cardsFaceDown' },
  { label: 'DD card dealt face up', key: 'table.doubleDownCardFaceUp' },
  { label: 'Double down after split', key: 'rules.doubleAfterSplit' },
  { label: 'Dealer hits soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No dealer hole card', key: 'rules.noHoleCard' },
  { label: 'Dealer BJ wins all', key: 'rules.dealerBlackjackWinsAll' },
];

const HARD_DOUBLES = [
  { value: 'none', label: 'No hard doubles' },
  { value: '10-11', label: 'Double 10-11' },
  { value: '9-11', label: 'Double 9-11' },
  { value: '8-11', label: 'Double 8-11' },
  { value: 'any', label: 'Any hard doubles' },
];

const SOFT_DOUBLES = [
  { value: 'none', label: 'No soft doubles' },
  { value: 'a8a9', label: 'Soft double A8 or A9 only' },
  { value: 'any', label: 'Any soft doubles' },
];

const INSURANCE = [
  { value: 'none', label: 'No Insurance' },
  { value: 'normal', label: 'Insurance' },
  { value: 'blackjackOnly', label: 'Insure BJ only' },
];

const SURRENDER = [
  { value: 'none', label: 'No Surrender' },
  { value: 'late', label: 'Late Surrender (common)' },
  { value: 'early', label: 'Early Surrender (rare)' },
  { value: 'earlyVsTen', label: 'Early Surrender vs. 10' },
  { value: 'macao', label: 'Macao Surrender' },
];

const LIMITS = TABLE_LIMITS.map(([min, max], value) => ({ value, label: `Limits: $${min} to $${max}` }));

export function commonRulesScreen(app) {
  const { el, columns, form } = settingsScreen(app, {
    title: 'Common Rules',
    help: 'settings.commonRules',
    note: NOTE,
  });
  columns.append(
    group(form.checks(CHECKS)),
    group(
      form.select('rules.hardDoubles', HARD_DOUBLES),
      form.select('rules.softDoubles', SOFT_DOUBLES),
      form.select('rules.insurance', INSURANCE),
      form.select('rules.surrender', SURRENDER),
      form.select('table.limits', LIMITS),
    ),
  );
  return { el };
}
