// A drill's stats panel: a two-by-two block of figures with fixed halves, so
// the divider stays in the middle whatever the figures say.

import { cn } from 'cn';
import type { DrillStats as Stats } from '@/drills/shared/drill-shell';

const CELL = 'w-1/2 truncate px-2.5 py-[5px] text-center text-[13px] font-medium tabular-nums';

export function DrillStats({ stats, className }: { stats: Stats; className?: string }) {
  return (
    <table
      aria-label="Stats"
      className={cn(
        'w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-(--radius-s) border bg-card text-card-foreground',
        className,
      )}
    >
      <tbody>
        <tr>
          <td className={CELL}>{stats.count}</td>
          <td className={cn(CELL, 'border-l')}>{stats.accuracy}</td>
        </tr>
        <tr>
          <td className={cn(CELL, 'border-t', stats.overdue && 'font-semibold text-destructive')}>{stats.time}</td>
          <td className={cn(CELL, 'border-t border-l')}>{stats.rate}</td>
        </tr>
      </tbody>
    </table>
  );
}
