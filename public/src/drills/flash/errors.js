// Flash Drills: Error History - which hands and situations the recorded
// strategy errors come from, and each one's share of all errors.

import { h } from '../../ui/dom.js';
import { standardScreen } from '../../ui/screen.js';
import { section } from '../shared/options-screen.js';
import { errorSummary, describeEntry, percent } from './logic.js';

/** One statistic: a label, the count and share on the right, and a bar under them. */
function statRow(label, count, share) {
  return h('div', { class: 'stat-row' },
    h('span', { class: 'stat-row__label' }, label),
    h('span', { class: 'stat-row__value' }, `${count} · ${percent(share)}`),
    h('div', { class: 'stat-row__bar' }, h('span', { style: { width: `${Math.max(2, share * 100)}%` } })));
}

const group = (...rows) => h('div', { class: 'settings-group' }, ...rows);

const valueRow = (label, value) => h('div', { class: 'settings-row stat-summary' },
  h('span', { class: 'label' }, label), h('span', { class: 'stat-summary__value' }, value));

export function flashErrorsScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Error History', help: 'drills.flash.errors' });
  const column = h('div', { class: 'column' });
  body.append(column);

  function render() {
    const { total, hands, situations } = errorSummary(app.errorTallies.cells());
    if (total === 0) {
      column.replaceChildren(h('p', { class: 'note' }, 'No errors have been recorded yet.'));
      return;
    }
    column.replaceChildren(
      section('Summary', group(
        valueRow('Total errors', String(total)),
        valueRow('Hands missed', String(hands.length)),
        valueRow('Most missed', describeEntry(hands[0].entry)))),
      section('By situation', group(...situations.map(s => statRow(s.label, s.count, s.share)))),
      section('Hands', group(...hands.map(x => statRow(describeEntry(x.entry), x.count, x.share)))),
    );
  }

  render();
  return { el, onShow: render };
}
