// The frame of every screen: a title bar (Back, the title, Help and any other
// buttons) over a scrolling body.

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TopBar } from '@/components/ui/top-bar';
import { useGoBack } from '@/app/navigation';
import { useOpenHelp } from '@/app/help';

export type ScreenLayoutProps = {
  title: string;
  /** Help topic for the Help button. */
  help?: string;
  /** Default true. */
  back?: boolean;
  /** Extra title-bar buttons, before Help. */
  actions?: ReactNode;
  /** Classes for the scrolling body. */
  className?: string;
  children?: ReactNode;
};

export function ScreenLayout({ title, help, back = true, actions, className, children }: ScreenLayoutProps) {
  const goBack = useGoBack();
  const openHelp = useOpenHelp();
  return (
    <>
      <TopBar
        title={title}
        onBack={back ? goBack : undefined}
        onHelp={help ? () => openHelp(help, title || 'Crackjack') : undefined}
        end={actions}
      />
      <main
        className={cn(
          'flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6 [-webkit-overflow-scrolling:touch]',
          className,
        )}
      >
        {children}
      </main>
    </>
  );
}

/** A centred column of content, 420px wide at most (740px when `wide`). */
export function Column({ wide, className, ...props }: ComponentProps<'div'> & { wide?: boolean }) {
  return (
    <div
      className={cn('mx-auto flex w-full flex-col gap-4', wide ? 'max-w-[740px]' : 'max-w-[420px]', className)}
      {...props}
    />
  );
}
