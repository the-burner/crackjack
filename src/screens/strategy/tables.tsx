// Strategy table viewer. Shows one of the six playing tables
// of the selected strategy, or its counting parameters, with the legend and the
// list of specialty plays. In "editMask" mode tapping a cell picks or unpicks
// it in a 6 x 10 x 10 boolean mask held in a setting.

import { useState } from 'react';
import { reactScreen } from '../../react/screen.tsx';
import type { ScreenProps } from '../../react/screen.tsx';
import { useApp, useSettings } from '../../react/app-context.ts';
import { CheckList, Select, StandardScreen } from '../../react/components.tsx';
import { strategyOptions } from '../../settings/strategies.ts';
import {
  TABLE_VIEWS,
  viewByKey,
  rowCount,
  rowLabels,
  columnLabels,
  gridCell,
  specialtyPlays,
  countsTables,
  GRID_COLOR,
} from '../../core/strategy/strategy-grid.ts';
import type { CountsTables, TableGridView } from '../../core/strategy/strategy-grid.ts';
import type { Strategy } from '../../core/strategy/strategy-tables.ts';
import type { Tallies } from '../../services/error-tallies.ts';

const BASE_COLUMNS = 10;
const EXTENDED_COLUMNS = 23;

// The four legend boxes always keep these colours; only their labels change. On
// the double and split tables the first label describes the *green* cells,
// which are the ones holding -32000 there.
const LEGEND_COLORS = [GRID_COLOR.action, GRID_COLOR.opposite, GRID_COLOR.index, GRID_COLOR.below];
const LEGEND_TEXT_COLORS = ['#000', '#fff', '#000', '#fff'];

/** The chart's colours as theme custom properties (errors share the opposite's red). */
const CHART_VARS: Record<string, string> = {
  [GRID_COLOR.action]: '--chart-action',
  [GRID_COLOR.opposite]: '--chart-opposite',
  [GRID_COLOR.index]: '--chart-index',
  [GRID_COLOR.below]: '--chart-below',
  [GRID_COLOR.unselected]: '--chart-unselected',
  [GRID_COLOR.noErrors]: '--chart-no-errors',
  '#000': '--chart-text',
  '#fff': '--chart-text-alt',
};
const themed = (color: string) => (CHART_VARS[color] ? `var(${CHART_VARS[color]})` : color);

/** Settings holding the 6 boolean grids a mask is edited in. */
export type MaskKey = 'strategy.customIndexMask' | 'drills.flash.customHands';

export type TablesParams = {
  mode?: 'view' | 'editMask';
  maskKey?: MaskKey | null;
  /** Deck count the tables are built for. */
  decks?: number;
  /** Strategy id (defaults to the selected one). */
  system?: number;
  title?: string;
  /** The table (or view key) to show first. */
  view?: string | null;
  /** One cell to mark; how the game's Error button points at the decision that went wrong. */
  highlight?: { row: number; column: number } | null;
};

function StrategyTables({ params }: ScreenProps<TablesParams>) {
  const app = useApp();
  const settings = useSettings();
  const { mode = 'view', maskKey = null, title = 'Tables', highlight = null } = params;
  const editingMask = mode === 'editMask' && Boolean(maskKey);
  // Built once, for the settings the screen opened with.
  const [strategy] = useState(() => {
    const decks = params.decks ?? settings.get('table.decks');
    const system = params.system ?? settings.get('strategy.system');
    // Picking custom indices needs every index visible, so the index limits are
    // ignored while the custom-index mask is edited.
    const pickingIndices = editingMask && maskKey === 'strategy.customIndexMask';
    const options = strategyOptions(settings, decks);
    return app.strategies.build(system, pickingIndices ? { ...options, indexSet: 'all', customMask: null } : options);
  });
  const [view, setView] = useState(
    () => (params.view && TABLE_VIEWS.find(v => v.table === params.view || v.key === params.view)) || TABLE_VIEWS[0],
  );
  const [tallies, setTallies] = useState<Tallies | null>(null);
  const showErrors = tallies !== null;
  const extended = strategy.extended;
  const mask = editingMask && maskKey ? settings.get(maskKey) : null;

  function toggleMask(table: TableGridView['table'], row: number, column: number) {
    if (!maskKey) return;
    const next = structuredClone(settings.get(maskKey));
    next[table][row][column] = !next[table][row][column];
    settings.set(maskKey, next);
  }

  let content;
  if (view.table === null) {
    const counts = countsTables(strategy);
    content = (
      <>
        <div className="tables__scroll">
          <CountsViewTables counts={counts} />
        </div>
        <div className="tables__below" hidden />
        <div className="tables__hint">{editingMask ? 'These tables have no mask.' : counts.rule}</div>
      </>
    );
  } else {
    const grids = mask?.[view.table] ?? null;
    let selected = 0;
    if (grids) {
      for (let row = 0; row < rowCount(view, { extended }); row++) {
        for (let column = 0; column < BASE_COLUMNS; column++) if (grids[row][column]) selected += 1;
      }
    }
    content = (
      <>
        <div className="tables__scroll">
          <TableGrid
            strategy={strategy}
            view={view}
            picked={grids}
            errors={tallies ? tallies[view.table] : null}
            highlight={highlight}
            onCell={
              editingMask
                ? (row, column) => {
                    // An extended strategy shows dealer totals in the extra columns, which the
                    // mask has no cell for.
                    if (column < BASE_COLUMNS) toggleMask(view.table, row, column);
                  }
                : null
            }
          />
        </div>
        <div className="tables__below">
          <div className="tables__legend" hidden={showErrors}>
            {view.legend.map((label, i) =>
              label === null ? null : (
                <div
                  key={i}
                  className="tables__legend-box"
                  style={{ backgroundColor: themed(LEGEND_COLORS[i]), color: themed(LEGEND_TEXT_COLORS[i]) }}
                >
                  {label}
                </div>
              ),
            )}
          </div>
          <div className="tables__specialty">
            <SpecialtyList strategy={strategy} view={view} />
          </div>
        </div>
        <div className="tables__hint">
          {editingMask ? `${selected} of ${rowCount(view, { extended }) * BASE_COLUMNS} cells selected` : ''}
        </div>
      </>
    );
  }

  return (
    <StandardScreen title={title} help="strategy.tables">
      <div className="column column--wide">
        <div className="tables__head">
          <div className="tables__name">{strategy.name}</div>
          <Select
            mini
            options={TABLE_VIEWS.map(v => ({ value: v.key, label: v.label }))}
            value={view.key}
            onChange={key => setView(viewByKey(key))}
          />
        </div>
        {content}
        <CheckList
          items={[
            {
              label: 'Shade error counts',
              checked: showErrors,
              onChange: on => setTallies(on ? app.errorTallies.load() : null),
            },
          ]}
        />
      </div>
    </StandardScreen>
  );
}

function TableGrid({
  strategy,
  view,
  picked,
  errors,
  highlight,
  onCell,
}: {
  strategy: Strategy;
  view: TableGridView;
  picked: readonly (readonly boolean[])[] | null;
  errors: readonly (readonly number[])[] | null;
  highlight: TablesParams['highlight'];
  onCell: ((row: number, column: number) => void) | null;
}) {
  const { extended } = strategy;
  const table = strategy.tables[view.table];
  const labels = rowLabels(view, { extended, earlySurrender: strategy.earlySurrender });
  const heads = columnLabels({ extended });
  return (
    <table className={`grid tables__grid${onCell ? ' tables__grid--editable' : ''}`}>
      <thead>
        <tr>
          <th style={{ width: '11%' }} />
          {heads.map((label, i) => (
            <th key={i}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, row) => (
          <tr key={row}>
            <td className="grid__label">{label}</td>
            {heads.map((_, column) => {
              const cell = gridCell({
                value: table[row][column],
                view,
                selected: !picked || Boolean(picked[row]?.[column]),
                errorCount: errors ? (errors[row]?.[column] ?? 0) : null,
              });
              const marked = highlight && highlight.row === row && highlight.column === column;
              return (
                <td
                  key={column}
                  className={marked ? 'grid__cell--marked' : undefined}
                  data-row={row}
                  data-col={column}
                  style={{ backgroundColor: themed(cell.background), color: themed(cell.color) }}
                  onClick={onCell ? () => onCell(row, column) : undefined}
                >
                  {cell.text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpecialtyList({ strategy, view }: { strategy: Strategy; view: TableGridView }) {
  const { extended } = strategy;
  const columns = extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const plays = specialtyPlays(strategy.tables[view.table], view, { extended, columns });
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Specialty Plays</th>
        </tr>
      </thead>
      <tbody>
        {(plays.length ? plays : ['none']).map((text, i) => (
          <tr key={i}>
            <td className="grid__label">{text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The four small tables of the Insurance/Counts view. */
function CountsViewTables({ counts }: { counts: CountsTables }) {
  const tables = [counts.pointValues, counts.startingCount, counts.insuranceDecks, counts.insuranceHands];
  return (
    <div className="tables__counts">
      {tables.map((t, i) =>
        t ? (
          <div key={i}>
            <div className="tables__caption">{t.caption}</div>
            <table className="grid">
              <thead>
                <tr>
                  {t.rows[0].label !== undefined ? <th /> : null}
                  {t.columns.map((c, j) => (
                    <th key={j}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, j) => (
                  <tr key={j}>
                    {r.label !== undefined ? <td className="grid__label">{r.label}</td> : null}
                    {r.values.map((v, k) => (
                      <td key={k} className="grid__label">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null,
      )}
    </div>
  );
}

export const strategyTablesScreen = reactScreen(StrategyTables, { className: 'tables' });
