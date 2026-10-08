// A native select (the system picker on iOS): a filled row with the choice on
// the left and a chevron on the right. Flat inside a settings group. In a row
// after a label (`align="end"`), the choice sits at the right, as a value does.

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
  align = 'start',
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  align?: 'start' | 'end';
  name?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div data-slot="select" className={cn('relative block w-full text-(--btn-text)', className)}>
      <select
        name={name}
        aria-label={ariaLabel}
        disabled={disabled}
        value={String(selectedIndexFor(options, value))}
        onChange={event => onChange(options[Number(event.currentTarget.value)].value)}
        className={cn(
          'min-h-(--control-h) w-full cursor-pointer appearance-none truncate rounded-(--radius-s) border-0 bg-(--btn-bg) py-2.5 pr-10 text-body',
          align === 'start'
            ? 'pl-3.5 text-left font-medium text-(--btn-text) [text-align-last:left]'
            : 'pl-2 text-right font-normal text-(--text-secondary) [text-align-last:right]',
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
      <Icon
        name="arrow-d"
        className="pointer-events-none absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 opacity-50"
      />
    </div>
  );
}
