// A tappable card with a title and a line of detail (the drills on the home screen).

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function CardButton({
  title,
  detail,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { title: string; detail: string }) {
  return (
    <button
      type={type}
      className={cn(
        'flex min-h-[76px] cursor-pointer flex-col items-start gap-1 rounded-(--radius) border-0 bg-(--group-bg) p-3.5 text-left text-(--text) outline-none',
        'transition-[transform,background-color] duration-150 active:scale-[0.98] engaged:bg-(--btn-bg-active)',
        className,
      )}
      {...props}
    >
      <span className="text-body font-semibold">{title}</span>
      <span className="text-caption leading-[1.3] text-(--text-secondary)">{detail}</span>
    </button>
  );
}
