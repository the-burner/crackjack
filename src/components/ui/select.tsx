// A native select (the system picker on iOS): a filled row with the choice on
// the left and a chevron on the right. Flat inside a settings group. With a
// `label`, the label sits on the left and the choice at the right, as a value
// does; the select still spans the whole row, so a tap anywhere opens it and
// its highlight fills the row.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icon';

export type Option<T> = { value: T; label: string };

/** Which option a value selects. */
export const selectedIndexFor = <T,>(options: readonly Option<T>[], value: T) =>
  options.findIndex(o => o.value === value);

export function Select<T>({
  options,
  value,
  onChange,
  label,
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shown on the left of the row; the select names itself from it unless given an aria-label. */
  label?: ReactNode;
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div data-slot="select" className={cn('relative block w-full text-(--btn-text)', className)}>
      <select
        name={name}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        disabled={disabled}
        value={String(selectedIndexFor(options, value))}
        onChange={event => onChange(options[Number(event.currentTarget.value)].value)}
        className={cn(
          'min-h-(--control-h) w-full cursor-pointer appearance-none truncate rounded-(--radius-s) border-0 bg-(--btn-bg) py-2.5 pr-10 text-body',
          label === undefined
            ? 'pl-3.5 text-left font-medium text-(--btn-text) [text-align-last:left]'
            : // The left half is the label's.
              'pl-[50%] text-right font-normal text-(--text-secondary) [text-align-last:right]',
          'in-data-[slot=settings-group]:rounded-none in-data-[slot=settings-group]:bg-transparent',
          // Hover, a press and keyboard focus show the pressed shade, in place of Safari's focus ring (which the group would clip to two bars).
          'outline-none engaged:bg-(--btn-bg-active) in-data-[slot=settings-group]:engaged:bg-(--btn-bg-active)',
        )}
      >
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o.label}
          </option>
        ))}
      </select>
      {label !== undefined && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 max-w-[calc(50%-1.5rem)] -translate-y-1/2 truncate text-body text-(--text)">
          {label}
        </span>
      )}
      <Icon
        name="arrow-d"
        className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 opacity-50"
      />
    </div>
  );
}
