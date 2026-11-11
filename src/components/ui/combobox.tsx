// A searchable choice: a field showing the choice, which lists the options that fuzzy-match what is typed,
// best first, refreshed with every character. An option may have a line of detail under its name, searched
// with it. The field and the list are islands of their own, the list just under the field while it is open.
// Tap or Enter takes one; Escape or leaving the field keeps the choice as it was.

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { fuzzyFilter } from '@/lib/fuzzy';
import { Icon } from './icon';
import { SettingsGroup } from './settings-group';

export interface ComboOption<T> {
  value: T;
  label: string;
  detail?: string;
}

export function Combobox<T>({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search',
  className,
}: {
  options: readonly ComboOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The field's accessible name. */
  label: string;
  /** Shown in the empty field while searching. */
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const current = options.find(o => o.value === value);
  const matches = open ? fuzzyFilter(options, query, o => `${o.label} ${o.detail ?? ''}`) : [];

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(option: ComboOption<T>) {
    close();
    input.current?.blur();
    if (option.value !== value) onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // From no highlight, down starts at the top and up at the bottom.
      setActive(i =>
        !matches.length
          ? 0
          : i < 0
            ? step > 0
              ? 0
              : matches.length - 1
            : (i + step + matches.length) % matches.length,
      );
    } else if (event.key === 'Enter' && open && matches.length) {
      // With nothing highlighted, Enter takes the best match.
      event.preventDefault();
      choose(matches[active] ?? matches[0]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <div data-slot="combobox" className={cn('flex w-full flex-col gap-2.5 text-(--btn-text)', className)}>
      <SettingsGroup className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 opacity-50"
        />
        <input
          ref={input}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          // Closed, it shows the choice; open, what is typed, with the choice as the hint.
          value={open ? query : (current?.label ?? '')}
          placeholder={open ? (current?.label ?? placeholder) : placeholder}
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onBlur={close}
          onChange={event => {
            setQuery(event.currentTarget.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            // 16px, so iOS does not zoom into the field.
            'min-h-(--control-h) w-full truncate rounded-(--radius-s) border-0 bg-(--btn-bg) py-2.5 pr-3.5 pl-10 text-[16px] font-medium text-(--btn-text) placeholder:font-normal placeholder:text-(--text-secondary)',
            'in-data-[slot=settings-group]:rounded-none in-data-[slot=settings-group]:bg-transparent',
            'outline-none focus:bg-(--btn-bg-active) in-data-[slot=settings-group]:focus:bg-(--btn-bg-active)',
          )}
        />
      </SettingsGroup>
      {open && (
        <SettingsGroup>
          <ul
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            // The pointer leaving the list takes its highlight with it.
            onPointerLeave={() => setActive(-1)}
            className="max-h-[calc(5.5*var(--control-h))] overflow-y-auto"
          >
            {matches.map((option, i) => (
              <li
                key={i}
                id={`${id}-${i}`}
                role="option"
                aria-selected={option.value === value}
                // Taken on the press, before the field loses focus and closes the list.
                onPointerDown={event => {
                  event.preventDefault();
                  choose(option);
                }}
                onPointerEnter={() => setActive(i)}
                className={cn(
                  'flex min-h-(--control-h) cursor-pointer flex-col justify-center border-t border-(--separator) px-3.5 py-2 first:border-t-0',
                  i === active && 'bg-(--btn-bg-active)',
                )}
              >
                <span className={cn('text-body text-(--text)', option.value === value && 'font-semibold')}>
                  {option.label}
                </span>
                {option.detail && <span className="text-caption text-(--text-secondary)">{option.detail}</span>}
              </li>
            ))}
            {matches.length === 0 && (
              <li role="presentation" className="px-3.5 py-2.5 text-body text-(--text-secondary)">
                No matches
              </li>
            )}
          </ul>
        </SettingsGroup>
      )}
    </div>
  );
}
