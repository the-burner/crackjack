// Strategy table viewer (legacy frmtabhn). Shows one of the six playing tables
// of the selected strategy, or its counting parameters, with the legend and the
// list of specialty plays. In "editMask" mode tapping a cell picks or unpicks
// it in a 6 x 10 x 10 boolean mask held in a setting.

import { h, replaceChildren } from '../../ui/dom.js';
import { select, checkList } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { strategyOptions } from '../../settings/strategies.js';
import {
  TABLE_VIEWS, viewByKey, rowCount, rowLabels, columnLabels, gridCell,
  specialtyPlays, countsTables, GRID_COLOR,
} from '../../core/strategy/strategy-grid.js';

const BASE_COLUMNS = 10;
const EXTENDED_COLUMNS = 23;

// The four legend boxes always keep these colours; only their labels change. On
// the double and split tables the first label describes the *green* cells,
// which are the ones holding -32000 there.
const LEGEND_COLORS = [GRID_COLOR.action, GRID_COLOR.opposite, GRID_COLOR.index, GRID_COLOR.below];
const LEGEND_TEXT_COLORS = ['#000', '#fff', '#000', '#fff'];

/**
 * @param {object} app
 * @param {object} params
 * @param {'view'|'editMask'} [params.mode='view']
 * @param {string} [params.maskKey]  Setting holding the 6 boolean grids to edit.
 * @param {number} [params.decks]    Deck count the tables are built for.
 * @param {number} [params.system]   Strategy id (defaults to the selected one).
 * @param {string} [params.title]
 */
export function strategyTablesScreen(app, params = {}) {
  const { settings, strategies, errorTallies } = app;
  const { mode = 'view', maskKey = null, title = 'Tables' } = params;
  const editingMask = mode === 'editMask' && Boolean(maskKey);
  const decks = params.decks ?? settings.get('table.decks');
  const system = params.system ?? settings.get('strategy.system');
  // Picking custom indices needs every index visible, so the index limits are
  // ignored while the custom-index mask is edited.
  const pickingIndices = editingMask && maskKey === 'strategy.customIndexMask';
  const options = strategyOptions(settings, decks);
  const strategy = strategies.build(system, pickingIndices ? { ...options, indexSet: 'all', customMask: null } : options);
  const columns = strategy.extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const extended = strategy.extended;

  let view = TABLE_VIEWS[0];
  let showErrors = false;
  let tallies = null;

  const { el, body } = standardScreen(app, { title, help: 'strategy.tables', className: 'tables' });

  const viewSelect = select(
    TABLE_VIEWS.map(v => ({ value: v.key, label: v.label })),
    view.key,
    key => { view = viewByKey(key); render(); },
    { mini: true },
  );
  const errorCheck = checkList([{
    label: 'Shade error counts',
    checked: false,
    onChange: on => { showErrors = on; tallies = on ? errorTallies.load() : null; render(); },
  }]);
  const grid = h('div', { class: 'tables__scroll' });
  const legend = h('div', { class: 'tables__legend' });
  const specialty = h('div', { class: 'tables__specialty' });
  const below = h('div', { class: 'tables__below' }, legend, specialty);
  const hint = h('div', { class: 'tables__hint' });

  body.append(h('div', { class: 'column column--wide' },
    h('div', { class: 'tables__head' },
      h('div', { class: 'tables__name' }, strategy.name),
      viewSelect),
    grid, below, hint, errorCheck,
  ));

  grid.addEventListener('click', event => {
    const cell = event.target.closest('td[data-row]');
    if (!cell || !editingMask || view.table === null) return;
    toggleMask(Number(cell.dataset.row), Number(cell.dataset.col));
    render();
  });

  function mask() {
    return settings.get(maskKey);
  }

  function toggleMask(row, column) {
    const next = structuredClone(mask());
    next[view.table][row][column] = !next[view.table][row][column];
    settings.set(maskKey, next);
  }

  function render() {
    if (view.table === null) {
      const counts = countsTables(strategy);
      replaceChildren(grid, countsView(counts));
      below.hidden = true;
      hint.textContent = editingMask ? 'These tables have no mask.' : counts.rule;
      return;
    }
    below.hidden = false;
    replaceChildren(grid, tableView());
    replaceChildren(legend, legendBoxes());
    replaceChildren(specialty, specialtyList());
    hint.textContent = editingMask ? `${selectedCount()} of ${rowCount(view, { extended }) * BASE_COLUMNS} cells selected` : '';
    legend.hidden = showErrors;
  }

  function selectedCount() {
    const grids = mask()[view.table];
    let n = 0;
    for (let row = 0; row < rowCount(view, { extended }); row++) {
      for (let column = 0; column < BASE_COLUMNS; column++) if (grids[row][column]) n += 1;
    }
    return n;
  }

  function tableView() {
    const table = strategy.tables[view.table];
    const labels = rowLabels(view, { extended, earlySurrender: strategy.earlySurrender });
    const heads = columnLabels({ extended });
    const picked = editingMask ? mask()[view.table] : null;
    const errors = showErrors ? tallies[view.table] : null;
    const rows = labels.map((label, row) => h('tr', {},
      h('td', { class: 'grid__label' }, label),
      heads.map((_, column) => {
        const cell = gridCell({
          value: table[row][column],
          view,
          selected: !picked || Boolean(picked[row]?.[column]),
          errorCount: errors ? (errors[row]?.[column] ?? 0) : null,
        });
        return h('td', {
          dataset: { row: String(row), col: String(column) },
          style: { backgroundColor: cell.background, color: cell.color },
        }, cell.text);
      })));
    return h('table', { class: `grid tables__grid${editingMask ? ' tables__grid--editable' : ''}` },
      h('thead', {}, h('tr', {}, h('th', { style: { width: '11%' } }), heads.map(label => h('th', {}, label)))),
      h('tbody', {}, rows));
  }

  function legendBoxes() {
    return view.legend.map((label, i) => (label === null ? null : h('div', {
      class: 'tables__legend-box',
      style: { backgroundColor: LEGEND_COLORS[i], color: LEGEND_TEXT_COLORS[i] },
    }, label)));
  }

  function specialtyList() {
    const plays = specialtyPlays(strategy.tables[view.table], view, { extended, columns });
    return h('table', { class: 'grid' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Specialty Plays'))),
      h('tbody', {}, (plays.length ? plays : ['none']).map(text => h('tr', {}, h('td', { class: 'grid__label' }, text)))));
  }

  return {
    el,
    onShow() {
      viewSelect.setValue(view.key);
      errorCheck.refresh(() => showErrors);
      render();
    },
  };
}

/** The four small tables of the Insurance/Counts view. */
function countsView(counts) {
  const tables = [counts.pointValues, counts.startingCount, counts.insuranceDecks, counts.insuranceHands];
  return h('div', { class: 'tables__counts' }, tables.filter(Boolean).map(t => h('div', {},
    h('div', { class: 'tables__caption' }, t.caption),
    h('table', { class: 'grid' },
      h('thead', {}, h('tr', {}, t.rows[0].label !== undefined ? h('th', {}) : null, t.columns.map(c => h('th', {}, c)))),
      h('tbody', {}, t.rows.map(r => h('tr', {},
        r.label !== undefined ? h('td', { class: 'grid__label' }, r.label) : null,
        r.values.map(v => h('td', { class: 'grid__label' }, v)))))),
  )));
}
