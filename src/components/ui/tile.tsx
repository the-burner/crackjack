// Bet tiles (Allowed Bets and the game's bet picker): grey spot tiles with the
// chosen one green, and accent-coloured chip tiles.

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
        'min-h-[52px] cursor-pointer rounded-(--radius-s) border-0 p-0 text-[18px] font-semibold active:scale-[0.97] disabled:cursor-default disabled:opacity-35 disabled:active:scale-100',
        kind === 'hands'
          ? 'bg-(--btn-bg) text-(--btn-text) data-on:bg-(--tile-good) data-on:text-(--tile-mark-text)'
          : 'bg-(--tile-bg) text-(--tile-text)',
        className,
      )}
      {...props}
    />
  );
}
