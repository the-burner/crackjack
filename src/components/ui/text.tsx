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

/** A note: small secondary text, centred; in a settings group, a left-aligned row. */
export function Note({ warning, className, ...props }: ComponentProps<'p'> & { warning?: boolean }) {
  return (
    <p
      data-slot="note"
      className={cn(
        // A paragraph's default margins, as the original's notes kept them.
        'my-[1em] text-center text-caption leading-[1.4] font-normal text-(--text-secondary)',
        warning && 'font-semibold text-(--warning)',
        'in-data-[slot=settings-group]:px-3.5 in-data-[slot=settings-group]:py-2.5 in-data-[slot=settings-group]:text-left',
        className,
      )}
      {...props}
    />
  );
}

export function FooterNote({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('m-0 pt-2 pb-2.5 text-center text-tiny text-(--text-secondary)', className)} {...props} />;
}

/** A label above a control, or beside it (`inline`). */
export function Field({
  label,
  inline,
  className,
  children,
}: {
  label: string;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="field"
      className={cn(
        'flex',
        inline
          ? 'flex-row items-center gap-2 *:not-data-[slot=label]:flex-1 in-data-[slot=settings-group]:min-h-(--control-h) in-data-[slot=settings-group]:px-3.5'
          : 'flex-col gap-1.5 in-data-[slot=settings-group]:px-3.5 in-data-[slot=settings-group]:pt-2.5 in-data-[slot=settings-group]:pb-1',
        className,
      )}
    >
      <Label className={inline ? 'flex-[0_0_78px] in-data-[slot=settings-group]:font-normal' : undefined}>
        {label}
      </Label>
      {children}
    </div>
  );
}
