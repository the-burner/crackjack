// Strategy table viewer. Shows one of the six playing tables
// of the selected strategy, or its counting parameters, with the legend and the
// list of specialty plays. In "editMask" mode tapping a cell picks or unpicks
// it in a 6 x 10 x 10 boolean mask held in a setting.

import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { tablesParams } from '@/app/paths';
import { useApp, useSettings } from '@/react/app-context';
import { cn } from '@/lib/utils';
import { CheckList } from '@/components/ui/check-list';
import { Grid, GRID_LABEL } from '@/components/ui/grid';
import { Select } from '@/components/ui/select';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { strategyOptions } from '@/settings/strategies';
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
} from '@/core/strategy/strategy-grid';
import type { CountsTables, TableGridView } from '@/core/strategy/strategy-grid';
import type { Strategy } from '@/core/strategy/strategy-tables';
import type { Tallies } from '@/services/error-tallies';

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

export function StrategyTables({ params }: { params: TablesParams }) {
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
        <div className="overflow-x-auto">
          <CountsViewTables counts={counts} />
        </div>
        <Hint>{editingMask ? 'These tables have no mask.' : counts.rule}</Hint>
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
        <div className="overflow-x-auto">
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
        <div className="flex items-start gap-1.5">
          <ul aria-label="Legend" className="m-0 flex flex-[0_0_112px] flex-col p-0" hidden={showErrors}>
            {view.legend.map((label, i) =>
              label === null ? null : (
                <li
                  key={i}
                  className="flex min-h-[30px] items-center justify-center border border-(--grid-mark) px-1 py-0.5 text-center text-[12px] leading-[normal] font-semibold [border-style:groove]"
                  style={{ backgroundColor: themed(LEGEND_COLORS[i]), color: themed(LEGEND_TEXT_COLORS[i]) }}
                >
                  {label}
                </li>
              ),
            )}
          </ul>
          <div className="min-w-0 flex-1">
            <SpecialtyList strategy={strategy} view={view} />
          </div>
        </div>
        <Hint>{editingMask ? `${selected} of ${rowCount(view, { extended }) * BASE_COLUMNS} cells selected` : ''}</Hint>
      </>
    );
  }

  const views = TABLE_VIEWS.map(v => ({ value: v.key, label: v.label }));
  return (
    <ScreenLayout title={title} help="strategy.tables">
      <Column wide>
        <SettingsGroup>
          <SettingsRow
            label={<span className="block truncate">{strategy.name}</span>}
            className="[&>[data-slot=label]]:min-w-0 [&>[data-slot=label]]:shrink"
          >
            <Select
              align="end"
              aria-label="Table"
              className="flex-[0_0_50%]"
              options={views}
              value={view.key}
              onChange={key => setView(viewByKey(key))}
            />
          </SettingsRow>
        </SettingsGroup>
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
      </Column>
    </ScreenLayout>
  );
}

const Hint = ({ children }: { children: string }) => (
  <p className="m-0 py-0.5 text-center text-[12px] leading-[normal] text-(--text-secondary)">{children}</p>
);

/** The cell the game's Error button points at: its outline blinks. */
const MARKED = 'animate-[marked-cell_1.4s_steps(1,end)_infinite] outline-3 -outline-offset-3 outline-(--grid-mark)';

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
    <Grid aria-label={view.label}>
      <thead>
        <tr>
          <th className="w-[11%]" />
          {heads.map((label, i) => (
            <th key={i}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, row) => (
          <tr key={row}>
            <td className={GRID_LABEL}>{label}</td>
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
                  className={cn(onCell && 'cursor-pointer engaged:brightness-90', marked && MARKED)}
                  data-row={row}
                  data-col={column}
                  data-marked={marked || undefined}
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
    </Grid>
  );
}

function SpecialtyList({ strategy, view }: { strategy: Strategy; view: TableGridView }) {
  const { extended } = strategy;
  const columns = extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const plays = specialtyPlays(strategy.tables[view.table], view, { extended, columns });
  return (
    <Grid>
      <thead>
        <tr>
          <th>Specialty Plays</th>
        </tr>
      </thead>
      <tbody>
        {(plays.length ? plays : ['none']).map((text, i) => (
          <tr key={i}>
            <td className={cn(GRID_LABEL, 'pl-1.5! text-left!')}>{text}</td>
          </tr>
        ))}
      </tbody>
    </Grid>
  );
}

/** The four small tables of the Insurance/Counts view. */
function CountsViewTables({ counts }: { counts: CountsTables }) {
  const tables = [counts.pointValues, counts.startingCount, counts.insuranceDecks, counts.insuranceHands];
  return (
    <div className="mx-auto flex max-w-125 flex-col gap-2.5">
      {tables.map((t, i) =>
        t ? (
          <Grid key={i}>
            <caption className="pb-0.5 text-caption font-semibold">{t.caption}</caption>
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
                  {r.label !== undefined ? <td className={GRID_LABEL}>{r.label}</td> : null}
                  {r.values.map((v, k) => (
                    <td key={k} className={GRID_LABEL}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Grid>
        ) : null,
      )}
    </div>
  );
}

/** The viewer at its route, with its options from the URL. */
export function StrategyTablesRoute() {
  const [search] = useSearchParams();
  // A new set of options is a new viewer.
  return <StrategyTables key={search.toString()} params={tablesParams(search)} />;
}
