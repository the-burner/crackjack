// Play Variations: dealer behavior and unusual rules.

import { group, settingsScreen } from './controls.js';

const NOTE = 'Dealer behavior and unusual rules.';

const DEALER = [
  { label: 'Dealer makes obvious plays', key: 'mechanics.dealerMakesObviousPlays' },
  { label: 'Dealer points out stupid plays', key: 'mechanics.dealerPointsOutStupidPlays' },
  { label: 'Insure then Surrender allowed', key: 'rules.surrenderAfterInsurance' },
  { label: 'Dealer shows burn cards', key: 'table.showBurnCards' },
  { label: 'Dealer peeks on ten', key: 'rules.dealerPeeksTen' },
  { label: 'Dealer peeks on ace', key: 'rules.dealerPeeksAce' },
];

const HANDS = [
  { label: 'Dealer wins tied 17', key: 'rules.dealerWinsTied17' },
  { label: 'Dealer wins ties', key: 'rules.dealerWinsTies' },
  { label: 'Five unbusted cards wins', key: 'rules.autoWinFiveCards' },
  { label: 'Six unbusted cards wins', key: 'rules.autoWinSixCards' },
  { label: 'Seven unbusted cards wins', key: 'rules.autoWinSevenCards' },
  { label: 'Player 22 counts as 21', key: 'rules.player22CountsAs21' },
  { label: 'Dealer ties 17, 18 and 19', key: 'rules.dealerWinsTies17to19' },
];

export function playVariationsScreen(app) {
  const { el, columns, form } = settingsScreen(app, {
    title: 'Play Variations',
    help: 'settings.playVariations',
    note: NOTE,
  });
  columns.append(group(form.checks(DEALER)), group(form.checks(HANDS)));
  return { el };
}
