// @ts-nocheck
// Dealer Errs/Biases: deliberate dealer mistakes and a
// non-random dealing bias.

import { group, settingsScreen } from './controls.ts';

const NOTE = 'The dealer can be made to deal cards non-randomly or make errors. Catching errors is important.';

const BIASES = [
  { value: 'none', label: 'No bias' },
  { value: 'positiveCounts', label: 'Positive counts' },
  { value: 'negativeCounts', label: 'Negative counts' },
  { value: 'manyCardHands', label: 'Many card hands' },
  { value: 'repeatErrors', label: 'Repeat errors' },
  { value: 'difficultHands', label: 'Difficult hands' },
];

const ERRORS = [
  { label: 'Insurance payoff errors', key: 'dealerErrors.insurancePayoff' },
  { label: 'Blackjack payoff errors', key: 'dealerErrors.blackjackPayoff' },
  { label: 'No payoff on win', key: 'dealerErrors.noPayOnWin' },
  { label: 'Bust on 21 or less', key: 'dealerErrors.bustOn21OrLess' },
  { label: 'Stand on 16', key: 'dealerErrors.standOn16' },
  { label: 'Dealer should have busted', key: 'dealerErrors.shouldHaveBusted' },
  { label: 'Lose on a push', key: 'dealerErrors.loseOnPush' },
  { label: 'No bonus or side bet payoff', key: 'dealerErrors.noBonusPayoff' },
];

export function dealerErrorsScreen(app) {
  const { el, columns, form } = settingsScreen(app, {
    title: 'Errs/Biases',
    help: 'settings.dealerErrors',
    note: NOTE,
  });
  columns.append(group(form.select('dealerErrors.dealingBias', BIASES)), group(form.checks(ERRORS)));
  return { el };
}
