// A native select (the system picker on iOS): a filled row with the choice on
// the left and a chevron on the right. Flat inside a settings group.

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
  mini = false,
  name,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  mini?: boolean;
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
          'w-full cursor-pointer appearance-none truncate rounded-(--radius-s) border-0 bg-(--btn-bg) text-left text-body font-medium text-(--btn-text) [text-align-last:left]',
          mini ? 'min-h-9 py-1.5 pr-[30px] pl-2.5 text-caption' : 'min-h-(--control-h) py-2.5 pr-10 pl-3.5',
          'in-data-[slot=settings-group]:rounded-none in-data-[slot=settings-group]:bg-transparent',
          // Hover, a press and keyboard focus show the pressed shade, in place of Safari's focus ring (which the group would clip to two bars).
          'outline-none engaged:bg-(--btn-bg-active) in-data-[slot=settings-group]:engaged:bg-(--btn-bg-active)',
          '[[data-slot=settings-group]_[data-slot=field]_&]:pl-0',
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
        className={cn(
          'pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 opacity-50',
          mini ? 'right-2.5' : 'right-3.5',
        )}
      />
    </div>
  );
}
