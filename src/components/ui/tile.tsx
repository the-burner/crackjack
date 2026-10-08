// Bet tiles (Allowed Bets and the game's bet picker): grey tiles, the chosen
// spot tile green.

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Tile({
  kind,
  on,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { kind: 'hands' | 'chips'; on?: boolean }) {
  return (
    <button
      type={type}
      data-on={on || undefined}
      className={cn(
        'min-h-[52px] cursor-pointer rounded-(--radius-s) border-0 p-0 text-[18px] font-semibold outline-none active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100',
        kind === 'hands'
          ? 'bg-(--btn-bg) text-(--btn-text) engaged:bg-(--btn-bg-active) data-on:bg-(--tile-good) data-on:text-(--tile-mark-text) data-on:engaged:bg-(--tile-good) data-on:engaged:brightness-90'
          : 'bg-(--btn-bg) text-(--btn-text) engaged:bg-(--btn-bg-active)',
        className,
      )}
      {...props}
    />
  );
}
