// Reusable controls. Each returns a DOM element; controls that hold a value
// expose `setValue()` on the element so screens can refresh them.

import { h } from './dom';
import type { Children, Props } from './dom';
import { promptNumber } from './dialogs';

export type ButtonOptions = Props & {
  onClick?: (event: MouseEvent) => void;
  /** Icon name (gear, back, info, grid, plus, refresh, arrow-r, ...). */
  icon?: string;
  /** Default 'right'. */
  iconPos?: 'right' | 'bottom';
  /** Default 'default'. */
  variant?: 'default' | 'nav' | 'primary';
  large?: boolean;
  block?: boolean;
  className?: string;
};

export function button(
  label: string,
  {
    onClick,
    icon,
    iconPos = 'right',
    variant = 'default',
    large = false,
    block = false,
    className = '',
    ...attrs
  }: ButtonOptions = {},
): HTMLButtonElement {
  const classes = ['btn'];
  if (variant !== 'default') classes.push(`btn--${variant}`);
  if (large) classes.push('btn--large');
  if (block) classes.push('btn--block');
  if (icon) classes.push(`icon-${icon}`, `btn--icon-${iconPos}`);
  if (className) classes.push(className);
  return h('button', { type: 'button', class: classes.join(' '), onclick: onClick, ...attrs }, label);
}

/** Title bar with Back on the left, the title, and Help (plus optional extra buttons) on the right. */
export type TopBarOptions = {
  onBack?: (() => void) | null;
  onHelp?: (() => void) | null;
  end?: readonly Children[];
  backLabel?: string;
};

export function topBar(
  title: string,
  { onBack, onHelp, end = [], backLabel = 'Back' }: TopBarOptions = {},
): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    onBack ? button(backLabel, { variant: 'nav', onClick: onBack, 'data-action': 'back' }) : h('span'),
    h('div', { class: 'topbar__title', role: 'heading' }, title),
    h(
      'div',
      { class: 'topbar__end' },
      ...end,
      onHelp ? button('Help', { variant: 'nav', onClick: onHelp, 'data-action': 'help' }) : null,
    ),
  );
}

export type SelectOption<T> = { value: T; label: string };

/** A select's wrapper, with `setValue()` and the native `control`. */
export type SelectHandle<T> = HTMLDivElement & {
  setValue: (value: T) => void;
  control: HTMLSelectElement;
};

/**
 * A native select styled like the rest of the UI.
 */
/**
 * Which option a value selects, or -1 when it is none of them. Showing the
 * first option for an unknown value would claim a value nobody chose.
 */
export const selectedIndexFor = <T>(options: readonly SelectOption<T>[], value: T): number =>
  options.findIndex(o => o.value === value);

export function select<T>(
  options: readonly SelectOption<T>[],
  value: T,
  onChange: (value: T) => void,
  { mini = false, name }: { mini?: boolean; name?: string } = {},
): SelectHandle<T> {
  const el: HTMLSelectElement = h(
    'select',
    { name, onchange: () => onChange(options[el.selectedIndex].value) },
    options.map(o => h('option', {}, o.label)),
  );
  const wrap = Object.assign(h('div', { class: `select icon-arrow-d${mini ? ' select--mini' : ''}` }, el), {
    setValue: (v: T) => {
      el.selectedIndex = selectedIndexFor(options, v);
    },
    control: el,
  });
  wrap.setValue(value);
  return wrap;
}

export type CheckItem = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type CheckListOptions = { horizontal?: boolean; chips?: boolean };

/** One row of a checkList. */
export type CheckRow = HTMLLabelElement & { setChecked: (checked: boolean) => void };

export type CheckListHandle = HTMLDivElement & {
  refresh: (getChecked: (index: number) => unknown) => void;
};

/**
 * A group of checkboxes: toggle rows, a segmented control (`horizontal`), or a
 * grid of separate toggle chips (`chips`, three per row).
 */
export function checkList(
  items: readonly CheckItem[],
  { horizontal = false, chips = false }: CheckListOptions = {},
): CheckListHandle {
  const rows = items.map((item): CheckRow => {
    const input = h('input', { type: 'checkbox', checked: Boolean(item.checked), disabled: item.disabled });
    const row = h('label', { class: `check${item.checked ? ' is-on' : ''}` }, input, h('span', {}, item.label));
    input.addEventListener('change', () => {
      row.classList.toggle('is-on', input.checked);
      item.onChange(input.checked);
    });
    return Object.assign(row, {
      setChecked: (c: boolean) => {
        input.checked = c;
        row.classList.toggle('is-on', c);
      },
    });
  });
  const el = h(
    'div',
    { class: `checklist${horizontal ? ' checklist--horizontal' : ''}${chips ? ' checklist--chips' : ''}` },
    rows,
  );
  return Object.assign(el, {
    /** Re-reads every item's state from `getChecked(index)`. */
    refresh: (getChecked: (index: number) => unknown) => rows.forEach((r, i) => r.setChecked(Boolean(getChecked(i)))),
  });
}

/** A button showing a number; tapping it prompts for a new value within [min, max]. */
export type ValueButtonOptions = {
  prompt?: string;
  min?: number;
  max?: number;
  format?: (value: number) => string;
};

export type ValueHandle<E extends HTMLElement> = E & { setValue: (value: number) => void };

export function valueButton(
  value: number,
  onChange: (value: number) => void,
  { prompt = 'Value', min = -Infinity, max = Infinity, format = String }: ValueButtonOptions = {},
): ValueHandle<HTMLButtonElement> {
  let current = value;
  const btn = button(format(current), {
    className: 'value-btn',
    onClick: async () => {
      const n = await promptNumber(prompt, current, { min, max });
      if (n === null) return;
      el.setValue(n);
      onChange(n);
    },
  });
  const el = Object.assign(btn, {
    setValue: (v: number) => {
      current = v;
      btn.textContent = format(v);
    },
  });
  return el;
}

/**
 * A labelled range slider with a number box. The number can be typed in as well
 * as dragged; a typed value is rounded to the step and kept within [min, max].
 */
export function slider(
  label: string,
  value: number,
  onChange: (value: number) => void,
  { min, max, step = 1 }: { min: number; max: number; step?: number },
): ValueHandle<HTMLDivElement> {
  const range = h('input', { type: 'range', min, max, step, value });
  const box = h('input', {
    type: 'number',
    class: 'slider__value',
    min,
    max,
    step,
    value,
    inputmode: 'numeric',
    'aria-label': label || 'Value',
  });
  const clamp = (n: number) => {
    const stepped = Math.round((n - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  };
  const commit = (n: number) => {
    range.value = String(n);
    box.value = String(n);
    onChange(n);
  };
  range.addEventListener('input', () => {
    box.value = range.value;
  });
  range.addEventListener('change', () => commit(Number(range.value)));
  // Typing updates the slider once the value is complete (Enter or leaving the box).
  box.addEventListener('change', () => {
    const typed = Number(box.value);
    if (box.value.trim() === '' || !Number.isFinite(typed)) {
      box.value = range.value;
      return;
    }
    commit(clamp(typed));
  });
  box.addEventListener('keydown', event => {
    if (event.key === 'Enter') box.blur();
  });
  box.addEventListener('focus', () => box.select());
  const el = h(
    'div',
    { class: 'slider' },
    label ? h('div', { class: 'slider__label' }, label) : null,
    h('div', { class: 'slider__row' }, box, range),
  );
  return Object.assign(el, {
    setValue: (v: number) => {
      range.value = String(v);
      box.value = String(v);
    },
  });
}

/** Label + control, stacked or inline. */
export function field(label: string, control: Children, { inline = false }: { inline?: boolean } = {}): HTMLDivElement {
  return h('div', { class: `field${inline ? ' field--inline' : ''}` }, h('span', { class: 'label' }, label), control);
}
