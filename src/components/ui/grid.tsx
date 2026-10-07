// Grids (strategy tables, bet tables, statistics): a slate header and ridged
// cell borders.

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Grid({ className, ...props }: ComponentProps<'table'>) {
  return (
    <table
      className={cn(
        'w-full table-fixed border-collapse text-[12px] leading-[normal] font-semibold tabular-nums',
        '[&_td]:overflow-hidden [&_td]:border-2 [&_td]:border-(--grid-border) [&_td]:px-px [&_td]:py-1 [&_td]:text-center [&_td]:text-(--grid-text) [&_td]:[border-style:ridge]',
        '[&_th]:border-2 [&_th]:border-(--grid-border) [&_th]:bg-(--grid-head-bg) [&_th]:px-px [&_th]:py-1 [&_th]:text-center [&_th]:text-(--grid-head-text) [&_th]:[border-style:ridge]',
        className,
      )}
      {...props}
    />
  );
}

/** The classes of a row or column label cell. */
export const GRID_LABEL = 'bg-(--grid-label-bg)';
