// The look of the app's charts (strategy tables, the counts and the bet table): flat cells with thin
// lines between and around them, the labels on lighter cells.

import { cn } from '@/lib/utils';

/** A chart's table: fixed columns, its cells a line apart, the column labels on lighter cells. */
export const CHART = cn(
  'w-full min-w-75 table-fixed border-separate border-spacing-px text-[13px] leading-none font-semibold tabular-nums',
  '[&_th]:p-0 [&_th]:text-center [&_th]:text-caption [&_th]:font-semibold [&_th]:bg-(--grid-head-bg) [&_th]:text-(--grid-head-text)',
  '[&_td]:p-0 [&_td]:text-center [&_td]:text-(--grid-text)',
);

/** The lines between a chart's cells and around it: the table shows through the spacing. */
export const CHART_LINES = 'border-spacing-(--chart-line-width) bg-(--chart-line)';

/** A row's label, on the same lighter cell as the column labels. */
export const CHART_LABEL = 'bg-(--grid-head-bg)! text-caption! font-semibold text-(--grid-head-text)!';
