// A tappable card with a title (the modules on the home screen), and the chevron that says it
// opens another screen.

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

export function CardButton({
  title,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { title: string }) {
  return (
    <button
      type={type}
      className={cn(
        'relative flex min-h-[76px] cursor-pointer flex-col items-start justify-center gap-1 rounded-(--radius) border-0 bg-(--group-bg) p-3.5 pr-8 text-left text-(--text) outline-none',
        'transition-[transform,background-color] duration-150 active:scale-[0.98] engaged:bg-(--btn-bg-active)',
        className,
      )}
      {...props}
    >
      <span className="text-body font-semibold">{title}</span>
      <Icon name="arrow-r" className="absolute top-1/2 right-2.5 size-[18px] -translate-y-1/2 opacity-35" />
    </button>
  );
}
