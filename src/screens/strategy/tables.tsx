// Strategy table viewer. Shows one of the six playing tables
// of the selected strategy, or its counting parameters, with the legend and the
// list of specialty plays. In "editMask" mode tapping a cell picks or unpicks
// it in a 6 x 10 x 10 boolean mask held in a setting.

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { tablesParams } from '@/app/paths';
import { useApp, useSettings } from '@/react/app-context';
import { cn } from '@/lib/utils';
import { CheckList } from '@/components/ui/check-list';
import { Select } from '@/components/ui/select';
import { Section, SettingsGroup } from '@/components/ui/settings-group';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { strategyOptions } from '@/settings/strategies';
import { decksOf, ownOrDefault } from '@/settings/scopes';
import { copyOfFirst, sideKeys, sideLabels, sideSettings } from '@/settings/chart-sides';
import type { ChartSide } from '@/settings/chart-sides';
import type { ScopeName } from '@/settings/scopes';
import { DECKS, SETTINGS_SCHEMA } from '@/settings/schema';
import { INDEX_SET_LABELS } from './playing-strategy';
import type { SettingKey } from '@/settings/schema';
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
  sameCell,
  comparableTables,
  comparableCounts,
} from '@/core/strategy/strategy-grid';
import type { CountsTable, CountsTables, TableGridView, TableView } from '@/core/strategy/strategy-grid';
import type { Strategy } from '@/core/strategy/strategy-tables';
import type { Tallies } from '@/services/error-tallies';

const BASE_COLUMNS = 10;
const EXTENDED_COLUMNS = 23;

// The four legend boxes always keep these colours; only their labels change. On
// the double and split tables the first label describes the *green* cells,
// which are the ones holding -32000 there.
const LEGEND_COLORS = [GRID_COLOR.action, GRID_COLOR.opposite, GRID_COLOR.index, GRID_COLOR.below];

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

/** Settings holding the 6 boolean grids a mask is edited in: a module's index mask, or custom hands. */
export type MaskKey = Extract<SettingKey, `${string}.strategy.customIndexMask` | 'drills.flash.customHands'>;

export type TablesParams = {
  mode?: 'view' | 'editMask';
  /** Whose strategy and mask: the module the screen was opened from. */
  scope?: ScopeName;
  /** Lets the strategy, its decks and rules be picked here (Playing Strategy Charts, which keeps them). */
  pick?: boolean;
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

/** The rules a side's tables are built for, as Playing Strategy labels them. */
const SIDE_RULES = [
  { label: 'Double after split', rule: 'rules.doubleAfterSplit' },
  { label: 'Hit soft 17', rule: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', rule: 'rules.noHoleCard' },
] as const;

/** The index sets the Charts can show; a custom set belongs to the module that picked it. */
const CHART_INDEX_SETS = SETTINGS_SCHEMA['charts.strategy.indexSet'].values.map(value => ({
  value,
  label: INDEX_SET_LABELS[value],
}));

export function StrategyTables({ params }: { params: TablesParams }) {
  const app = useApp();
  const settings = useSettings();
  const { mode = 'view', scope = 'game', maskKey = null, title = 'Tables', highlight = null } = params;
  const editingMask = mode === 'editMask' && Boolean(maskKey);
  // The Charts keep what is picked on them; opened from a module, the tables are that module's own.
  const charts = Boolean(params.pick);
  const [opened] = useState(() => ({
    system: params.system ?? Number(ownOrDefault(settings, scope, 'strategy.system')),
    decks: params.decks ?? decksOf(settings, scope),
  }));
  const first = charts ? sideSettings(key => settings.get(key), 'charts') : null;
  const picked = first ? { system: first.system, decks: first.decks } : opened;
  // The Charts can lay a second side over the first: a strategy built for decks, indices and rules of its own.
  const second = charts && settings.get('charts.compare.on') ? sideSettings(key => settings.get(key), 'compare') : null;
  /** What the strategies are built for, so they are built again when it changes. */
  const built = JSON.stringify([first, second]);
  // Built for the settings it was opened with, and for whatever is picked here.
  const strategy = useMemo(() => {
    // Picking custom indices needs every index visible, so the index limits are
    // ignored while the custom-index mask is edited.
    const pickingIndices = editingMask && maskKey?.endsWith('strategy.customIndexMask');
    const options = strategyOptions(settings, charts ? 'charts' : scope, picked.decks);
    return app.strategies.build(
      picked.system,
      pickingIndices ? { ...options, indexSet: 'all', customMask: null } : options,
    );
    // Built once for the module's settings as they were; only the pickers change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.system, picked.decks, built]);
  const compared = useMemo(
    () => (second ? app.strategies.build(second.system, strategyOptions(settings, 'compare', second.decks)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [built],
  );
  /** The key's names for the two sides. */
  const [firstName, secondName] =
    first && second
      ? sideLabels(first, second, {
          strategy: id => app.strategies.list().find(entry => entry.id === id)?.name ?? '',
          indexSet: set => INDEX_SET_LABELS[set],
        })
      : ['', ''];
  const [openedView, setOpenedView] = useState(
    () => (params.view && TABLE_VIEWS.find(v => v.table === params.view || v.key === params.view)) || TABLE_VIEWS[0],
  );
  const view = charts ? viewByKey(settings.get('charts.table')) : openedView;
  const setView = (next: TableView) => (charts ? settings.set('charts.table', next.key) : setOpenedView(next));
  // A module's error history; the Charts only read strategies, so have none.
  const [showErrors, setShowErrors] = useState(false);
  // Read afresh each time shading is turned on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tallies = useMemo<Tallies | null>(() => (showErrors ? app.errorTallies.load() : null), [showErrors]);
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
    const other = compared && countsTables(compared);
    content = (
      <>
        <CountsViewTables counts={counts} compared={other} />
        {other && <CompareKey first={firstName} second={secondName} />}
        <Hint>{editingMask ? 'These tables have no mask.' : counts.rule}</Hint>
        {other && other.rule !== counts.rule && <Hint>{`${secondName}: ${other.rule}`}</Hint>}
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
    const overlaid = compared && comparableTables(view, strategy, compared) ? compared : null;
    content = (
      <>
        <div className={CHART_CARD}>
          <TableGrid
            strategy={strategy}
            compared={overlaid}
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
        <ul
          aria-label="Legend"
          className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1.5 p-0"
          hidden={showErrors}
        >
          {view.legend.map((label, i) =>
            label === null ? null : (
              <li key={i} className="flex items-center gap-1.5 text-caption font-medium text-(--text-secondary)">
                <span aria-hidden className="size-3.5 shrink-0" style={{ backgroundColor: themed(LEGEND_COLORS[i]) }} />
                {label}
              </li>
            ),
          )}
        </ul>
        {overlaid && <CompareKey first={firstName} second={secondName} />}
        {compared && !overlaid && (
          <Hint>{`${secondName} can't be compared on this table: its rows are different hands.`}</Hint>
        )}
        <SpecialtyList strategy={strategy} view={view} name={overlaid ? firstName : null} />
        {overlaid && <SpecialtyList strategy={overlaid} view={view} name={secondName} />}
        <Hint>{editingMask ? `${selected} of ${rowCount(view, { extended }) * BASE_COLUMNS} cells selected` : ''}</Hint>
      </>
    );
  }

  const views = TABLE_VIEWS.map(v => ({ value: v.key, label: v.label }));
  return (
    <ScreenLayout title={title} help="strategy.tables">
      <Column>
        {charts ? (
          <>
            <Section title="Strategy">
              <SettingsGroup role="group" aria-label="Strategy">
                <SideRows side="charts" />
              </SettingsGroup>
            </Section>
            <Section title="Compare with">
              <SettingsGroup role="group" aria-label="Compare with">
                <CheckList
                  items={[
                    {
                      label: 'Compare',
                      checked: second !== null,
                      // Compare starts from the first side's settings, so a change shows what it changes.
                      onChange: on =>
                        settings.update(
                          on
                            ? { ...copyOfFirst(key => settings.get(key)), 'charts.compare.on': true }
                            : { 'charts.compare.on': false },
                        ),
                    },
                  ]}
                />
                {second && <SideRows side="compare" />}
              </SettingsGroup>
            </Section>
            <SettingsGroup>
              <Select
                label="Table"
                aria-label="Table"
                options={views}
                value={view.key}
                onChange={key => setView(viewByKey(key))}
              />
            </SettingsGroup>
          </>
        ) : (
          <SettingsGroup>
            <Select
              label={strategy.name}
              aria-label="Table"
              options={views}
              value={view.key}
              onChange={key => setView(viewByKey(key))}
            />
          </SettingsGroup>
        )}
        {content}
        {!charts && (
          <CheckList items={[{ label: 'Shade error counts', checked: showErrors, onChange: setShowErrors }]} />
        )}
      </Column>
    </ScreenLayout>
  );
}

/** One side's strategy, decks, indices and rules. */
function SideRows({ side }: { side: ChartSide }) {
  const app = useApp();
  const settings = useSettings();
  const keys = sideKeys(side);
  return (
    <>
      <Select
        aria-label="Strategy"
        options={app.strategies.list().map(({ id, name }) => ({ value: id, label: name }))}
        value={Number(settings.get(keys.system))}
        onChange={system => settings.set(keys.system, system)}
      />
      <Select
        label="Decks"
        aria-label="Decks"
        options={DECKS.map(value => ({ value, label: `${value}` }))}
        value={Number(settings.get(keys.decks))}
        onChange={decks => settings.set(keys.decks, decks)}
      />
      <Select
        label="Indices"
        aria-label="Indices"
        options={CHART_INDEX_SETS}
        value={settings.get(keys.indexSet)}
        onChange={value => settings.set(keys.indexSet, value)}
      />
      <CheckList
        items={SIDE_RULES.map(({ label, rule }) => ({
          label,
          checked: Boolean(settings.get(keys.rule(rule))),
          onChange: on => settings.set(keys.rule(rule), on),
        }))}
      />
    </>
  );
}

const Hint = ({ children }: { children: string }) => (
  <p className="m-0 py-0.5 text-center text-[12px] leading-[normal] text-(--text-secondary)">{children}</p>
);

/** The cell the game's Error button points at: its outline blinks. */
const MARKED = 'animate-[marked-cell_1.4s_steps(1,end)_infinite] outline-3 -outline-offset-3 outline-(--grid-mark)';

/** A chart sits on a card, as the settings groups do; one too wide for the screen scrolls inside it. */
const CHART_CARD = 'overflow-x-auto rounded-(--radius) bg-(--group-bg) p-2';

/** Flat square cells with a thin line between them, the dealer's cards and the player's hands labelled on lighter ones. */
const CHART = cn(
  'w-full min-w-75 table-fixed border-separate border-spacing-px text-[13px] leading-none font-semibold tabular-nums',
  '[&_th]:p-0 [&_th]:text-center [&_th]:text-caption [&_th]:font-semibold [&_th]:bg-(--grid-head-bg) [&_th]:text-(--grid-head-text) [&_th:empty]:bg-transparent',
  '[&_td]:p-0 [&_td]:text-center [&_td]:text-(--grid-text)',
);

/** A row's label, on the same lighter cell as the column labels. */
const CHART_LABEL = 'bg-(--grid-head-bg)! text-caption! font-semibold text-(--grid-head-text)!';

/** The narrowest a chart's cell gets: a wider strategy scrolls inside its card instead. */
const MIN_CELL = 28;

/** A cell is as tall as it is wide. */
const SQUARE = 'flex aspect-square items-center justify-center';

function TableGrid({
  strategy,
  compared,
  view,
  picked,
  errors,
  highlight,
  onCell,
}: {
  strategy: Strategy;
  /** A second strategy laid over the first: where their cells differ, each is split between the two. */
  compared: Strategy | null;
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
    <table
      aria-label={view.label}
      className={cn(CHART, 'border-spacing-(--chart-line-width) bg-(--chart-line)')}
      style={{ minWidth: (heads.length + 1) * MIN_CELL }}
    >
      <thead>
        {/* The labels take cells the size of the others, so the chart sits evenly in its card. */}
        <tr>
          {/* The corner says which way is which: the dealer's cards across, the player's hands down. */}
          <th
            aria-label="Player v dealer"
            style={{
              background:
                'linear-gradient(to top right, var(--grid-head-bg) calc(50% - var(--chart-line-width) / 2), var(--chart-line) calc(50% - var(--chart-line-width) / 2), var(--chart-line) calc(50% + var(--chart-line-width) / 2), var(--grid-head-bg) calc(50% + var(--chart-line-width) / 2))',
            }}
          >
            <div aria-hidden className={cn(SQUARE, 'relative')}>
              {/* Each at its half's incenter: as far from the diagonal as from both edges, 1 - 1/√2 of the way in. */}
              <span className="absolute top-[29.3%] left-[70.7%] -translate-1/2 text-[10px]">D</span>
              <span className="absolute top-[70.7%] left-[29.3%] -translate-1/2 text-[10px]">P</span>
            </div>
          </th>
          {heads.map((label, i) => (
            <th key={i}>
              <div className={SQUARE}>{label}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, row) => (
          <tr key={row}>
            <td className={CHART_LABEL}>
              {/* A range ("2-10") takes the smaller text, to fit a cell on one line. */}
              <div className={cn(SQUARE, 'whitespace-nowrap', label.length > 3 && 'text-tiny')}>{label}</div>
            </td>
            {heads.map((_, column) => {
              const cell = gridCell({
                value: table[row][column],
                view,
                selected: !picked || Boolean(picked[row]?.[column]),
                errorCount: errors ? (errors[row]?.[column] ?? 0) : null,
              });
              const theirs = compared && gridCell({ value: compared.tables[view.table][row][column], view });
              const split = theirs && !sameCell(cell, theirs) ? theirs : null;
              const marked = highlight && highlight.row === row && highlight.column === column;
              return (
                <td
                  key={column}
                  className={cn(onCell && 'cursor-pointer engaged:brightness-90', marked && MARKED)}
                  data-row={row}
                  data-col={column}
                  data-marked={marked || undefined}
                  data-differs={split ? true : undefined}
                  style={
                    split
                      ? { background: splitBackground(themed(cell.background), themed(split.background)) }
                      : { backgroundColor: themed(cell.background), color: themed(cell.color) }
                  }
                  onClick={onCell ? () => onCell(row, column) : undefined}
                >
                  {split ? (
                    <SplitValues
                      className={SQUARE}
                      first={{ text: cell.text, color: themed(cell.color) }}
                      second={{ text: split.text, color: themed(split.color) }}
                    />
                  ) : (
                    <div className={SQUARE}>{cell.text}</div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpecialtyList({
  strategy,
  view,
  name = null,
}: {
  strategy: Strategy;
  view: TableGridView;
  /** Whose plays these are, when two strategies are compared. */
  name?: string | null;
}) {
  const { extended } = strategy;
  const columns = extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const plays = specialtyPlays(strategy.tables[view.table], view, { extended, columns });
  if (!plays.length) return null;
  return (
    <Section title={name ? `Specialty Plays: ${name}` : 'Specialty Plays'}>
      <SettingsGroup>
        {plays.map((text, i) => (
          <p key={i} className="m-0 px-3.5 py-2.5 text-body">
            {text}
          </p>
        ))}
      </SettingsGroup>
    </Section>
  );
}

/** The four small tables of the Insurance/Counts view. */
function CountsViewTables({ counts, compared }: { counts: CountsTables; compared: CountsTables | null }) {
  const tables = [counts.pointValues, counts.startingCount, counts.insuranceDecks, counts.insuranceHands];
  const theirs = compared && [
    compared.pointValues,
    compared.startingCount,
    compared.insuranceDecks,
    compared.insuranceHands,
  ];
  return (
    <div className="mx-auto flex w-full max-w-125 flex-col gap-3">
      {tables.map((t, i) => {
        const other = theirs && comparableCounts(t ?? EMPTY_COUNTS, theirs[i]) ? theirs[i] : null;
        return t ? (
          <div key={i} className={CHART_CARD}>
            <table className={cn(CHART, '[&_td]:text-(--text) [&_th]:py-1')}>
              <caption className="pb-1.5 text-left text-caption font-semibold tracking-[0.02em] text-(--text-secondary) uppercase">
                {t.caption}
              </caption>
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
                    {r.label !== undefined ? (
                      <td className={cn(CHART_LABEL, 'whitespace-nowrap', r.label.length > 3 && 'text-tiny!')}>
                        {r.label}
                      </td>
                    ) : null}
                    {r.values.map((v, k) => {
                      const w = other?.rows[j].values[k];
                      return w !== undefined && w !== v ? (
                        <td
                          key={k}
                          data-differs
                          style={{ background: splitBackground('transparent', 'transparent', 'var(--separator)') }}
                        >
                          <SplitValues className={SQUARE} first={{ text: v }} second={{ text: w }} />
                        </td>
                      ) : (
                        <td key={k} className="py-1.5!">
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null;
      })}
    </div>
  );
}

const EMPTY_COUNTS: CountsTable = { caption: '', columns: [], rows: [] };

/**
 * A cell split from its top right corner to its bottom left: the first strategy's colour above the
 * line, the second's below, with an optional thin line along it.
 */
const splitBackground = (first: string, second: string, line = 'var(--chart-line)') =>
  `linear-gradient(to bottom right, ${first} calc(50% - var(--chart-line-width) / 2), ${line} calc(50% - var(--chart-line-width) / 2), ${line} calc(50% + var(--chart-line-width) / 2), ${second} calc(50% + var(--chart-line-width) / 2))`;

/**
 * The two sides' values in a split cell, each at its half's incenter (as far from the diagonal as from both
 * edges, 1 - 1/√2 of the way in): the first's at the top left, the second's at the bottom right.
 */
function SplitValues({
  className,
  first,
  second,
}: {
  className: string;
  first: { text: string; color?: string };
  second: { text: string; color?: string };
}) {
  return (
    <div className={cn('relative', className)}>
      <span className="absolute top-[29.3%] left-[29.3%] -translate-1/2 text-[10px]" style={{ color: first.color }}>
        {first.text}
      </span>
      <span className="absolute top-[70.7%] left-[70.7%] -translate-1/2 text-[10px]" style={{ color: second.color }}>
        {second.text}
      </span>
    </div>
  );
}

/** Which corner of a split cell is which strategy: one chip each, with the corner it fills. */
function CompareKey({ first, second }: { first: string; second: string }) {
  const corners = [
    { name: first, fill: 'var(--text-secondary) 50%, transparent 50%' },
    { name: second, fill: 'transparent 50%, var(--text-secondary) 50%' },
  ];
  return (
    <ul aria-label="Compared strategies" className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1.5 p-0">
      {corners.map(({ name, fill }, corner) => (
        <li key={corner} className="flex items-center gap-1.5 text-caption font-medium text-(--text-secondary)">
          <span
            aria-hidden
            className="size-3.5 shrink-0 outline-1 -outline-offset-1 outline-(--text-secondary)"
            style={{ background: `linear-gradient(to bottom right, ${fill})` }}
          />
          {name}
        </li>
      ))}
    </ul>
  );
}

/** The viewer at its route, with its options from the URL. */
export function StrategyTablesRoute() {
  const [search] = useSearchParams();
  // A new set of options is a new viewer.
  return <StrategyTables key={search.toString()} params={tablesParams(search)} />;
}
