// Text styles: labels, notes and the small print under a screen.

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Label({ small, className, ...props }: ComponentProps<'span'> & { small?: boolean }) {
  return (
    <span
      data-slot="label"
      className={cn('font-medium text-(--text)', small ? 'text-caption' : 'text-body', className)}
      {...props}
    />
  );
}

/** A note: small secondary text, centred, on the screen's background (never in a settings group). */
export function Note({ warning, className, ...props }: ComponentProps<'p'> & { warning?: boolean }) {
  return (
    <p
      data-slot="note"
      className={cn(
        // A paragraph's default margins, as the original's notes kept them.
        'my-[1em] text-center text-caption leading-[1.4] font-normal text-(--text-secondary)',
        warning && 'font-semibold text-(--warning)',
        className,
      )}
      {...props}
    />
  );
}

export function FooterNote({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('m-0 pt-2 pb-2.5 text-center text-tiny text-(--text-secondary)', className)} {...props} />;
}
