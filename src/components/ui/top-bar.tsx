// The title bar: Back on the left, a plain centred title, Help (and any other
// buttons) on the right. Its buttons are plain accent-coloured text.

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import type { IconName } from './icon';

/** A title-bar button: accent text, no fill. `back` adds the chevron; `icon` a small glyph after the label. */
export function BarButton({
  back,
  icon,
  className,
  children,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { back?: boolean; icon?: IconName }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-10 cursor-pointer touch-manipulation items-center justify-center border-0 bg-transparent px-2 text-title font-normal text-(--accent) select-none active:opacity-50',
        back && 'gap-0.5 pl-[7px]',
        icon && 'relative pr-[26px]',
        className,
      )}
      {...props}
    >
      {back && (
        // The chevron's ink lines up with the page's 16px content edge.
        <svg aria-hidden viewBox="0 0 12 20" className="h-5 w-3 shrink-0">
          <path
            d="M10 2 2 10l8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {children}
      {icon && <Icon name={icon} className="absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 opacity-85" />}
    </button>
  );
}

export function TopBar({
  title,
  onBack,
  onHelp,
  end,
  backLabel = 'Back',
  className,
}: {
  title: ReactNode;
  onBack?: () => void;
  onHelp?: () => void;
  /** Extra buttons before Help. */
  end?: ReactNode;
  backLabel?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'grid min-h-12 shrink-0 grid-cols-[minmax(72px,1fr)_auto_minmax(72px,1fr)] items-center gap-2 px-2 py-0.5',
        className,
      )}
    >
      <div className="justify-self-start">
        {onBack && (
          <BarButton back onClick={onBack} data-action="back">
            {backLabel}
          </BarButton>
        )}
      </div>
      <h1 className="m-0 max-w-full min-w-0 justify-self-center truncate text-center text-title font-semibold text-(--text)">
        {title}
      </h1>
      <div className="flex gap-0.5 justify-self-end">
        {end}
        {onHelp && (
          <BarButton onClick={onHelp} data-action="help">
            Help
          </BarButton>
        )}
      </div>
    </header>
  );
}
