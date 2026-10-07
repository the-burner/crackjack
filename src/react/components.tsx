// The controls of ui/components.ts as React components, rendering the same
// markup so the stylesheets and tests apply to both.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { promptNumber } from '@/ui/dialogs';
import { selectedIndexFor } from '@/ui/components';
import type { SelectOption } from '@/ui/components';
import { useApp } from './app-context';

const classes = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  /** Icon name (gear, back, info, grid, plus, refresh, arrow-r, ...). */
  icon?: string;
  iconPos?: 'right' | 'bottom';
  variant?: 'default' | 'nav' | 'primary';
  large?: boolean;
  block?: boolean;
  'data-action'?: string;
};

export function Button({
  icon,
  iconPos = 'right',
  variant = 'default',
  large = false,
  block = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={classes(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        large && 'btn--large',
        block && 'btn--block',
        icon && `icon-${icon} btn--icon-${iconPos}`,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type TopBarProps = {
  title: string;
  onBack?: (() => void) | null;
  onHelp?: (() => void) | null;
  end?: ReactNode;
  backLabel?: string;
};

/** Title bar with Back on the left, the title, and Help (plus optional extra buttons) on the right. */
export function TopBar({ title, onBack, onHelp, end, backLabel = 'Back' }: TopBarProps) {
  return (
    <header className="topbar">
      {onBack ? (
        <Button variant="nav" onClick={onBack} data-action="back">
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="topbar__title" role="heading" aria-level={1}>
        {title}
      </div>
      <div className="topbar__end">
        {end}
        {onHelp && (
          <Button variant="nav" onClick={onHelp} data-action="help">
            Help
          </Button>
        )}
      </div>
    </header>
  );
}

export type StandardScreenProps = {
  title: string;
  /** Help topic for the Help button. */
  help?: string;
  back?: boolean;
  end?: ReactNode;
  children?: ReactNode;
};

/** The title bar and scrolling body of a screen (its section comes from reactScreen). */
export function StandardScreen({ title, help, back = true, end, children }: StandardScreenProps) {
  const app = useApp();
  return (
    <>
      <TopBar
        title={title}
        onBack={back ? () => app.back() : null}
        onHelp={help ? () => app.help(help, title || 'Crackjack') : null}
        end={end}
      />
      <div className="screen__body">{children}</div>
    </>
  );
}

export type SelectProps<T> = {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  mini?: boolean;
  name?: string;
  /** Accessible name, for a select whose visible label is beside it. */
  label?: string;
  hidden?: boolean;
};

/** A native select styled like the rest of the UI. A value none of the options has selects nothing. */
export function Select<T>({ options, value, onChange, mini = false, name, label, hidden }: SelectProps<T>) {
  const ref = useRef<HTMLSelectElement>(null);
  const index = selectedIndexFor(options, value);
  // Set on the element: a controlled select cannot show "no option".
  useLayoutEffect(() => {
    if (ref.current) ref.current.selectedIndex = index;
  });
  return (
    <div className={classes('select icon-arrow-d', mini && 'select--mini')} hidden={hidden}>
      <select
        ref={ref}
        name={name}
        aria-label={label}
        onChange={event => {
          onChange(options[event.currentTarget.selectedIndex].value);
          // Back to the current value: a new one re-renders, a rejected one does not.
          event.currentTarget.selectedIndex = index;
        }}
      >
        {options.map((o, i) => (
          <option key={i}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export type CheckItem = { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean };

/**
 * A group of checkboxes: toggle rows, a segmented control (`horizontal`), or a
 * grid of separate toggle chips (`chips`, three per row).
 */
export function CheckList({
  items,
  horizontal = false,
  chips = false,
  hidden,
}: {
  items: readonly CheckItem[];
  horizontal?: boolean;
  chips?: boolean;
  hidden?: boolean;
}) {
  return (
    <div
      className={classes('checklist', horizontal && 'checklist--horizontal', chips && 'checklist--chips')}
      hidden={hidden}
    >
      {items.map((item, i) => (
        <label key={i} className={classes('check', item.checked && 'is-on')}>
          <input
            type="checkbox"
            checked={item.checked}
            disabled={item.disabled}
            onChange={event => item.onChange(event.currentTarget.checked)}
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  );
}

export type ValueButtonProps = {
  value: number;
  onChange: (value: number) => void;
  prompt?: string;
  min?: number;
  max?: number;
  format?: (value: number) => string;
  hidden?: boolean;
};

/** A button showing a number; tapping it prompts for a new value within [min, max]. */
export function ValueButton({
  value,
  onChange,
  prompt = 'Value',
  min = -Infinity,
  max = Infinity,
  format = String,
  hidden,
}: ValueButtonProps) {
  return (
    <Button
      className="value-btn"
      hidden={hidden}
      onClick={async () => {
        const n = await promptNumber(prompt, value, { min, max });
        if (n !== null) onChange(n);
      }}
    >
      {format(value)}
    </Button>
  );
}

export type SliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
};

/**
 * A labelled range slider with a number box. The number can be typed in as well
 * as dragged; a typed value is rounded to the step and kept within [min, max].
 */
export function Slider({ label, value, onChange, min, max, step = 1 }: SliderProps) {
  const range = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLInputElement>(null);
  // What each input shows before a change is committed: the box follows a drag,
  // and the slider waits for a typed number to be complete.
  const [boxDraft, setBoxDraft] = useState(String(value));
  const [rangeDraft, setRangeDraft] = useState(String(value));
  // A new value from outside replaces both drafts.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setBoxDraft(String(value));
    setRangeDraft(String(value));
  }
  const latest = useRef({ onChange, value, min, max, step });
  useLayoutEffect(() => {
    latest.current = { onChange, value, min, max, step };
  });

  // React's onChange fires on every input; the value is committed on the native
  // change event, when the drag ends or the typed number is complete.
  useEffect(() => {
    const rangeEl = range.current;
    const boxEl = box.current;
    if (!rangeEl || !boxEl) return;
    const commit = (n: number) => {
      setBoxDraft(String(n));
      setRangeDraft(String(n));
      latest.current.onChange(n);
    };
    const onRangeChange = () => commit(Number(rangeEl.value));
    const onBoxChange = () => {
      const { min: lo, max: hi, step: by, value: current } = latest.current;
      const typed = Number(boxEl.value);
      if (boxEl.value.trim() === '' || !Number.isFinite(typed)) {
        setBoxDraft(String(current));
        return;
      }
      const stepped = Math.round((typed - lo) / by) * by + lo;
      commit(Math.min(hi, Math.max(lo, stepped)));
    };
    rangeEl.addEventListener('change', onRangeChange);
    boxEl.addEventListener('change', onBoxChange);
    return () => {
      rangeEl.removeEventListener('change', onRangeChange);
      boxEl.removeEventListener('change', onBoxChange);
    };
  }, []);

  return (
    <div className="slider">
      {label && <div className="slider__label">{label}</div>}
      <div className="slider__row">
        <input
          ref={box}
          type="number"
          className="slider__value"
          min={min}
          max={max}
          step={step}
          value={boxDraft}
          inputMode="numeric"
          aria-label={label || 'Value'}
          onChange={event => setBoxDraft(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          onFocus={event => event.currentTarget.select()}
        />
        <input
          ref={range}
          type="range"
          min={min}
          max={max}
          step={step}
          value={rangeDraft}
          aria-label={label || 'Value'}
          onChange={event => {
            setRangeDraft(event.currentTarget.value);
            setBoxDraft(event.currentTarget.value);
          }}
        />
      </div>
    </div>
  );
}

/** Label + control, stacked or inline. */
export function Field({
  label,
  inline = false,
  hidden,
  children,
}: {
  label: string;
  inline?: boolean;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={classes('field', inline && 'field--inline')} hidden={hidden}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
