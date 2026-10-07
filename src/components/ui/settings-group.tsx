// Settings layout: groups of rows on a rounded card split by hairlines (as in
// iOS settings), sections with a heading and footnote, and the rows that go in
// them. Controls placed in a group restyle themselves (flat, full width) via
// Tailwind's `in-data-[slot=settings-group]:` variants.

import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import type { ButtonProps } from './button';
import { Label } from './text';

/** One centred column of groups, two side by side when there is room. */
export function SettingsCols({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,365px)] content-start items-start justify-center gap-3 min-[750px]:grid-cols-[repeat(2,minmax(0,365px))]',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="settings-group"
      className={cn(
        'flex flex-col overflow-hidden rounded-(--radius) bg-(--group-bg)',
        // A divider above every visible row that follows another visible row.
        '[&>:not([hidden])~:not([hidden])]:border-t [&>:not([hidden])~:not([hidden])]:border-(--separator)',
        // A button in a group is a row that does something: accent text on the left.
        '*:data-[slot=button]:justify-start *:data-[slot=button]:rounded-none *:data-[slot=button]:bg-transparent *:data-[slot=button]:font-normal *:data-[slot=button]:text-(--accent)',
        // A slider row of its own (not one beside a label).
        '*:data-[slot=slider]:px-3.5 *:data-[slot=slider]:py-2.5',
        className,
      )}
      {...props}
    />
  );
}

/** A small heading over a group, with an optional footnote. */
export function Section({
  title,
  footer,
  className,
  children,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('flex flex-col', className)}>
      {title && (
        <h2 className="mx-3.5 mt-0 mb-1.5 text-caption font-semibold tracking-[0.02em] text-(--text-secondary) uppercase">
          {title}
        </h2>
      )}
      {children}
      {footer && <p className="mx-3.5 mt-1.5 mb-0 text-caption leading-[1.4] text-(--text-secondary)">{footer}</p>}
    </section>
  );
}

/** A label on one side of a control (a value button, a select). `trailing` insets the right edge too. */
export function SettingsRow({
  label,
  trailing,
  className,
  children,
  ...props
}: ComponentProps<'div'> & { label?: ReactNode; trailing?: boolean }) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        'flex min-h-(--control-h) items-center gap-2 pl-3.5 [&>[data-slot=select]]:flex-auto',
        trailing && 'pr-3.5',
        className,
      )}
      {...props}
    >
      {label !== undefined && <Label className="flex-auto font-normal">{label}</Label>}
      {children}
    </div>
  );
}

/** A list row: plain text on the left and, when it opens another screen, a chevron on the right. */
export function ListRow({ chevron = true, className, ...props }: ButtonProps & { chevron?: boolean }) {
  return (
    <Button
      data-slot="list-row"
      icon={chevron ? 'arrow-r' : undefined}
      className={cn(
        'justify-start font-normal text-(--text) in-data-[slot=settings-group]:rounded-none in-data-[slot=settings-group]:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

/** A note over a screen's groups. */
export function SettingsNote({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'mx-1 mt-0 mb-3.5 text-left text-caption leading-[1.4] text-(--text-secondary) in-data-[slot=settings-group]:m-0 in-data-[slot=settings-group]:px-3.5 in-data-[slot=settings-group]:py-2.5',
        className,
      )}
      {...props}
    />
  );
}
