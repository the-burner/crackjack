// Read-only figures: a grid of small cards, each a value over its label.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Stat = { label: string; value: ReactNode; strong?: boolean };

/** `rows` fills the grid column by column, so each column reads as a group. */
export function StatTiles({ stats, rows, className }: { stats: readonly Stat[]; rows?: number; className?: string }) {
  return (
    <dl
      className={cn('m-0 grid grid-cols-3 gap-2', rows && 'grid-flow-col', className)}
      style={rows ? { gridTemplateRows: `repeat(${rows}, auto)` } : undefined}
    >
      {stats.map(({ label, value, strong }) => (
        <div
          key={label}
          data-slot="stat"
          className={cn(
            'flex min-w-0 flex-col-reverse gap-0.5 rounded-(--radius-s) bg-(--group-bg) px-2.5 py-2',
            strong && 'ring-2 ring-(--accent) ring-inset',
          )}
        >
          <dt className="truncate text-caption text-(--text-secondary)">{label}</dt>
          <dd
            data-slot="value"
            className={cn(
              'm-0 truncate leading-6 font-medium text-(--text) tabular-nums',
              // Long figures (big money) drop a size to stay on one line.
              String(value).length > 8 ? 'text-body' : 'text-title',
              strong && 'font-semibold',
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
