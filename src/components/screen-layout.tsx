// The frame of every screen: a title bar (Back, the title, Help and any other
// actions) over a scrolling body, inside the safe area.

import type { ComponentProps, ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { useApp } from '@/react/app-context';

export type ScreenLayoutProps = {
  title: string;
  /** Help topic for the Help button. */
  help?: string;
  /** Default true. */
  back?: boolean;
  /** Extra title-bar buttons, before Help. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function ScreenLayout({ title, help, back = true, actions, className, children }: ScreenLayoutProps) {
  const app = useApp();
  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-1">
        <div>
          {back && (
            <Button variant="ghost" onClick={() => app.back()} data-action="back">
              <ChevronLeftIcon />
              Back
            </Button>
          )}
        </div>
        <h1 className="truncate text-base font-semibold">{title}</h1>
        <div className="flex items-center justify-end">
          {actions}
          {help && (
            <Button variant="ghost" onClick={() => app.help(help, title || 'Crackjack')} data-action="help">
              Help
            </Button>
          )}
        </div>
      </header>
      <main className={cn('flex-1 overflow-y-auto overscroll-contain p-4', className)}>{children}</main>
    </div>
  );
}

/** A titled group of rows, as in iOS settings. */
export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      {title && <h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>}
      <div className="divide-y overflow-hidden rounded-lg border bg-card">{children}</div>
    </section>
  );
}

/** A row of a Section that opens something (with a chevron) or does something (`chevron={false}`). */
export function ListButton({
  children,
  className,
  chevron = true,
  ...props
}: ComponentProps<'button'> & { chevron?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-muted active:bg-muted',
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      {chevron && <ChevronRightIcon className="size-4 text-muted-foreground" />}
    </button>
  );
}
