// Peeking: seeing the dealer's hole card and the strategies
// used once it has been seen.

import { h } from '../../ui/dom.js';
import { HOLE_CARD_STRATEGY } from '../../settings/strategies.js';
import { group, settingsScreen } from './controls.js';

const NOTE = 'These options are for more advanced play.';

// The first two rows are the one peek mode; clearing both turns peeking off.
const CHECKS = [
  { label: 'Peek at dealer down card', key: 'peeking.mode', value: 'holeCard', off: 'off' },
  { label: 'Peek when dealer peeks', key: 'peeking.mode', value: 'whenDealerPeeks', off: 'off' },
  { label: 'Peek right and left', key: 'peeking.adjacentHands' },
  { label: 'Randomize Card', key: 'peeking.randomizeCard' },
  { label: 'Randomize Hand', key: 'peeking.randomizeHand' },
];

const PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(value => ({ value, label: `${value}%` }));

export function peekingScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Peeking', help: 'settings.peeking', note: NOTE });
  const strategies = [{ value: HOLE_CARD_STRATEGY.id, label: HOLE_CARD_STRATEGY.name }];
  columns.append(
    group(
      form.checks(CHECKS),
      h('div', { class: 'settings-row peeking-modes' },
        h('span', { class: 'label' }, 'Percent of the time:'),
        form.select('peeking.percent', PERCENTS, { mini: true })),
    ),
    group(
      trailingLabel(form.select('peeking.strategyHigh', strategies), 'HC High'),
      trailingLabel(form.select('peeking.strategyLow', strategies), 'HC Low'),
    ),
  );
  return { el };
}

/** A control with its label to the right of it. */
function trailingLabel(control, label) {
  return h('div', { class: 'settings-row settings-row--trailing' }, control, h('span', { class: 'label' }, label));
}
