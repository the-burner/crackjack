// True Count Calcs: how the running count is turned into a true
// count. The arithmetic itself lives in core/counting.js.

import { h } from '../../ui/dom.js';
import { select, checkList, valueButton } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { group } from '../settings/controls.js';

const ROWS = [
  {
    label: 'True Count Resolution:', key: 'trueCount.resolution',
    options: [['full', 'Full Deck'], ['half', 'Half Deck'], ['quarter', 'Quarter Deck'], ['exact', 'Exact']],
  },
  {
    label: 'Last Deck Resolution:', key: 'trueCount.lastDeckResolution',
    options: [['half', 'Half Deck'], ['quarter', 'Quarter Deck'], ['exact', 'Exact']],
  },
  {
    label: 'True Count Division:', key: 'trueCount.rounding',
    options: [['round', 'Round'], ['truncate', 'Truncate'], ['floor', 'Floor']],
  },
  {
    label: 'Remaining Cards:', key: 'trueCount.remainingCards',
    options: [['dealt', 'Cards dealt'], ['shown', 'Cards shown'], ['inTray', 'Cards in tray']],
  },
];

const SIDE_COUNTS = [
  { label: 'Ace side count', key: 'trueCount.aceSideCount' },
  { label: 'Ten side count', key: 'trueCount.tenSideCount' },
];

export function trueCountScreen(app) {
  const { settings } = app;
  const { el, body } = standardScreen(app, { title: 'TC Calcs', help: 'settings.trueCount' });

  const selects = ROWS.map(row => select(
    row.options.map(([value, label]) => ({ value, label })),
    settings.get(row.key),
    value => settings.set(row.key, value),
    { mini: true },
  ));
  const allowedError = valueButton(settings.get('trueCount.allowedErrorCards'), v => settings.set('trueCount.allowedErrorCards', v), { prompt: 'Cards', min: 0, max: 13 });
  const sideCounts = checkList(SIDE_COUNTS.map(({ label, key }) => ({
    label, checked: settings.get(key), onChange: on => settings.set(key, on),
  })));

  body.append(h('div', { class: 'column' },
    h('p', { class: 'note settings-note' }, 'Set the method of calculating true counts'),
    group(
      ROWS.map((row, i) => h('div', { class: 'tc-row' }, h('span', { class: 'label' }, row.label), selects[i])),
      h('div', { class: 'tc-row' }, h('span', { class: 'label' }, 'Allowed estimation error:'), allowedError),
      sideCounts,
    ),
  ));

  return {
    el,
    onShow() {
      ROWS.forEach((row, i) => selects[i].setValue(settings.get(row.key)));
      allowedError.setValue(settings.get('trueCount.allowedErrorCards'));
      sideCounts.refresh(i => settings.get(SIDE_COUNTS[i].key));
    },
  };
}
