// Checkbox lists: rows with a switch on the right (`list`), a segmented control
// (`horizontal`), or a grid of toggle chips, three to a row (`chips`).

import { cn } from '@/lib/utils';

export type CheckItem = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type CheckListLayout = 'list' | 'horizontal' | 'chips';

const LIST = {
  list: 'overflow-hidden rounded-(--radius) bg-(--group-bg) in-data-[slot=settings-group]:rounded-none in-data-[slot=settings-group]:bg-transparent',
  horizontal: [
    'flex gap-0.5 rounded-[10px] bg-(--btn-bg) p-0.5',
    // Inset in its group's row, so no divider crosses its tray.
    'in-data-[slot=settings-group]:mx-3.5 in-data-[slot=settings-group]:my-2 in-data-[slot=settings-group]:border-t-0! in-data-[slot=settings-group]:bg-(--page-bg)',
  ],
  chips: 'grid grid-cols-3 gap-2',
} as const;

const ROW = {
  list: 'min-h-(--control-h) gap-3 border-t border-(--separator) px-3.5 py-2 text-body font-normal text-(--text) first:border-t-0 engaged:bg-(--btn-bg-active)',
  horizontal:
    'min-h-[34px] flex-1 justify-center rounded-lg px-1.5 py-1 text-caption font-medium text-(--btn-text) transition-colors engaged:bg-(--btn-bg-active) data-on:bg-(--check-on) data-on:font-semibold data-on:text-(--check-on-text) data-on:engaged:bg-(--check-on) data-on:engaged:brightness-90',
  chips:
    'min-h-10 justify-center rounded-(--radius-s) bg-(--btn-bg) px-2 py-1.5 text-[14px] font-medium text-(--btn-text) transition-colors engaged:bg-(--btn-bg-active) data-on:bg-(--check-on) data-on:font-semibold data-on:text-(--check-on-text) data-on:engaged:bg-(--check-on) data-on:engaged:brightness-90',
} as const;

export function CheckList({
  items,
  layout = 'list',
  className,
  'aria-label': ariaLabel,
}: {
  items: readonly CheckItem[];
  layout?: CheckListLayout;
  className?: string;
  /** Names the list as a group, for screen readers. */
  'aria-label'?: string;
}) {
  return (
    <div
      data-slot="check-list"
      data-layout={layout}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      className={cn(LIST[layout], className)}
    >
      {items.map(item => (
        <label
          key={item.label}
          data-on={item.checked || undefined}
          className={cn('flex cursor-pointer items-center select-none', ROW[layout])}
        >
          <span className={layout === 'list' ? 'flex-1' : undefined}>{item.label}</span>
          <input
            type="checkbox"
            role={layout === 'list' ? 'switch' : undefined}
            checked={item.checked}
            disabled={item.disabled}
            onChange={event => item.onChange(event.currentTarget.checked)}
            className={layout === 'list' ? SWITCH : 'sr-only'}
          />
        </label>
      ))}
    </div>
  );
}

/** The switch: a pill with a knob that slides right when on. */
export const SWITCH = cn(
  'm-0 h-[26px] w-11 flex-none cursor-pointer appearance-none rounded-[13px] bg-(--toggle-off) bg-no-repeat',
  'bg-[radial-gradient(circle,var(--toggle-knob)_10px,transparent_10.5px)] bg-size-[26px_26px] bg-position-[0_0]',
  'transition-[background-color,background-position] duration-200 checked:bg-(--check-on) checked:bg-position-[18px_0] disabled:opacity-40',
);
