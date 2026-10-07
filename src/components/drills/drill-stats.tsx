// A drill's stats panel: a two-by-two block of figures with fixed halves, so
// the divider stays in the middle whatever the figures say.

import { cn } from '@/lib/utils';
import type { DrillStats as Stats } from '@/drills/shared/drill-shell';

const CELL = 'w-1/2 truncate px-2.5 py-[5px] text-center text-caption font-medium tabular-nums';
const LINE = 'border-(--panel-border)';

export function DrillStats({ stats, className }: { stats: Stats; className?: string }) {
  return (
    <table
      aria-label="Stats"
      className={cn(
        'w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-(--radius-s) bg-(--panel-bg) text-(--panel-text)',
        className,
      )}
    >
      <tbody>
        <tr>
          <td className={CELL}>{stats.count}</td>
          <td className={cn(CELL, LINE, 'border-l')}>{stats.accuracy}</td>
        </tr>
        <tr>
          <td className={cn(CELL, LINE, 'border-t', stats.overdue && 'font-semibold text-(--warning)')}>
            {stats.time}
          </td>
          <td className={cn(CELL, LINE, 'border-t border-l')}>{stats.rate}</td>
        </tr>
      </tbody>
    </table>
  );
}
