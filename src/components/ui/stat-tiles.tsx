// Read-only figures: a grid of small cards, each a value over its label.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Stat = { label: string; value: ReactNode; strong?: boolean };

export function StatTiles({ stats, className }: { stats: readonly Stat[]; className?: string }) {
  return (
    <dl className={cn('m-0 grid grid-cols-3 gap-2', className)}>
      {stats.map(({ label, value, strong }) => (
        <div
          key={label}
          data-slot="stat"
          className="flex flex-col-reverse justify-end gap-0.5 rounded-(--radius-s) bg-(--group-bg) px-3 py-2"
        >
          <dt className="text-caption leading-tight text-(--text-secondary)">{label}</dt>
          <dd
            data-slot="value"
            className={cn('m-0 text-title font-medium text-(--text) tabular-nums', strong && 'font-semibold')}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
