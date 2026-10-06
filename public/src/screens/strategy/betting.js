// Allowed Bets: the table of bets the player
// may make, optionally tied to the count so betting errors can be flagged.

import { h, replaceChildren } from '../../ui/dom.js';
import { button, select, checkList, valueButton } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { promptNumber } from '../../ui/dialogs.js';
import {
  CHIP_CHOICES, HAND_CHOICES, MIN_ROWS, MAX_ROWS,
  countLabels, formatRow, maxChipsForHands, normalizeRamp, rampToSave, setRow, setRowCount,
} from '../../settings/bet-ramp.js';
import { group } from '../settings/controls.js';

const CHIP_VALUES = [1, 5, 10, 25, 100, 500, 1000];

export function bettingScreen(app) {
  const { settings } = app;
  const { el, body } = standardScreen(app, { title: 'Allowed Bets', help: 'settings.betting' });

  const ramp = () => normalizeRamp(settings.get('betting.ramp'));

  const warn = checkList([{
    label: 'Warning on Betting Error',
    checked: settings.get('betting.warnOnError'),
    onChange: on => { settings.set('betting.warnOnError', on); render(); },
  }]);
  const chipValue = select(
    CHIP_VALUES.map(value => ({ value, label: `$${value}` })),
    settings.get('betting.chipValue'),
    value => settings.set('betting.chipValue', value),
  );
  const rowCountButton = valueButton(ramp().rows.length, count => {
    settings.set('betting.ramp', setRowCount(ramp(), count));
    render();
  }, { prompt: 'Number of different bets in table', min: MIN_ROWS, max: MAX_ROWS });
  const minCountButton = valueButton(ramp().minCount, minCount => {
    settings.set('betting.ramp', normalizeRamp({ ...ramp(), minCount }));
    render();
  }, { prompt: 'Start Count', min: -99, max: 99 });
  const minCountRow = h('div', { class: 'tc-row' }, h('span', { class: 'label' }, 'Minimum bet count:'), minCountButton);
  const table = h('div', {});

  body.append(h('div', { class: 'column' },
    h('p', { class: 'note settings-note' }, 'Enter the number of different bets in the table and then click on a table cell to enter a new bet.'),
    group(
      warn,
      h('div', { class: 'tc-row' }, h('span', { class: 'label' }, 'Chip Value:'), chipValue),
      h('div', { class: 'tc-row' }, h('span', { class: 'label' }, 'Number of bets:'), rowCountButton),
      minCountRow,
    ),
    table,
  ));

  function render() {
    const showCounts = settings.get('betting.warnOnError');
    const current = ramp();
    const counts = countLabels(current, { showCounts });
    minCountRow.hidden = !showCounts;
    rowCountButton.setValue(current.rows.length);
    minCountButton.setValue(current.minCount);
    replaceChildren(table, h('table', { class: 'grid bet-table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Count'), h('th', {}, 'Hands x Chips'))),
      h('tbody', {}, current.rows.map((row, i) => h('tr', {
        dataset: { row: String(i) },
        onclick: () => app.open('settings.betting.select', { row: i }),
      }, h('td', {}, counts[i]), h('td', {}, formatRow(row)))))));
  }

  return {
    el,
    onShow() {
      // A ramp saved out of range is shown tidied, so keep the tidied one.
      const tidy = rampToSave(settings.get('betting.ramp'));
      if (tidy) settings.set('betting.ramp', tidy);
      warn.refresh(() => settings.get('betting.warnOnError'));
      chipValue.setValue(settings.get('betting.chipValue'));
      render();
    },
  };
}

/** Picks the number of hands and chips for one row of the bet table. */
export function betSelectScreen(app, { row = 0 } = {}) {
  const { settings } = app;
  const { el, body } = standardScreen(app, { title: 'Allowed Bets', help: 'settings.betting' });
  const current = normalizeRamp(settings.get('betting.ramp'));
  let hands = current.rows[row]?.hands ?? 1;

  const handButtons = HAND_CHOICES.map(n => h('button', {
    type: 'button',
    class: 'tile tile--hands',
    dataset: { hands: String(n) },
    onclick: () => { hands = n; refresh(); },
  }, n === 1 ? '1' : `${n}x`));
  const chipButtons = CHIP_CHOICES.map(n => h('button', {
    type: 'button',
    class: 'tile tile--chips',
    dataset: { chips: String(n) },
    onclick: () => choose(n),
  }, String(n)));

  body.append(h('div', { class: 'bet-pad' },
    h('div', { class: 'note' }, 'In the bottom table, click on the number of chips to bet. If you wish to play more than one spot, click on the number of spots at the top first. You can also enter a custom bet at the bottom.'),
    h('div', { class: 'bet-pad__row' }, handButtons),
    h('div', { class: 'bet-pad__chips' }, chunk(chipButtons, HAND_CHOICES.length).map(cells => h('div', { class: 'bet-pad__row' }, cells))),
    button('Custom Bet', { block: true, onClick: () => customBet(), 'data-action': 'custom-bet' }),
  ));

  function refresh() {
    handButtons.forEach(b => b.classList.toggle('is-on', Number(b.dataset.hands) === hands));
    chipButtons.forEach(b => { b.disabled = Number(b.dataset.chips) > maxChipsForHands(hands); });
  }

  function choose(chips) {
    settings.set('betting.ramp', setRow(normalizeRamp(settings.get('betting.ramp')), row, { chips, hands }));
    app.back();
  }

  async function customBet() {
    const chips = await promptNumber('Enter number of chips', current.rows[row]?.chips ?? 1, { min: 1, max: maxChipsForHands(hands) });
    if (chips === null) return;
    choose(chips);
  }

  return { el, onShow: refresh };
}

const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
