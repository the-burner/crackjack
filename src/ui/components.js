// Reusable controls. Each returns a DOM element; controls that hold a value
// expose `setValue()` on the element so screens can refresh them.

import { h } from './dom.js';
import { promptNumber } from './dialogs.js';

/**
 * @param {string} label
 * @param {object} [o]
 * @param {() => void} [o.onClick]
 * @param {string} [o.icon]       Icon name (gear, back, info, grid, plus, refresh, arrow-r, ...).
 * @param {'right'|'bottom'} [o.iconPos='right']
 * @param {'default'|'nav'|'primary'} [o.variant='default']
 * @param {boolean} [o.large]
 * @param {boolean} [o.block]
 */
export function button(label, { onClick, icon, iconPos = 'right', variant = 'default', large = false, block = false, className = '', ...attrs } = {}) {
  const classes = ['btn'];
  if (variant !== 'default') classes.push(`btn--${variant}`);
  if (large) classes.push('btn--large');
  if (block) classes.push('btn--block');
  if (icon) classes.push(`icon-${icon}`, `btn--icon-${iconPos}`);
  if (className) classes.push(className);
  return h('button', { type: 'button', class: classes.join(' '), onclick: onClick, ...attrs }, label);
}

/** Title bar with Back on the left, the title, and Help (plus optional extra buttons) on the right. */
export function topBar(title, { onBack, onHelp, end = [], backLabel = 'Back' } = {}) {
  return h('header', { class: 'topbar' },
    onBack ? button(backLabel, { variant: 'nav', onClick: onBack, 'data-action': 'back' }) : h('span'),
    h('div', { class: 'topbar__title', role: 'heading' }, title),
    h('div', { class: 'topbar__end' }, ...end, onHelp ? button('Help', { variant: 'nav', onClick: onHelp, 'data-action': 'help' }) : null),
  );
}

/**
 * A native select styled like the rest of the UI.
 * @param {{value: *, label: string}[]} options
 */
export function select(options, value, onChange, { mini = false, name } = {}) {
  const el = h('select', { name, onchange: () => onChange(options[el.selectedIndex].value) },
    options.map(o => h('option', {}, o.label)));
  const wrap = h('div', { class: `select icon-arrow-d${mini ? ' select--mini' : ''}` }, el);
  wrap.setValue = v => { el.selectedIndex = Math.max(0, options.findIndex(o => o.value === v)); };
  wrap.setValue(value);
  wrap.control = el;
  return wrap;
}

/**
 * A group of checkboxes.
 * @param {{label: string, checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean}[]} items
 */
export function checkList(items, { horizontal = false } = {}) {
  const rows = items.map(item => {
    const input = h('input', { type: 'checkbox', checked: Boolean(item.checked), disabled: item.disabled });
    const row = h('label', { class: `check${item.checked ? ' is-on' : ''}` }, input, h('span', {}, item.label));
    input.addEventListener('change', () => {
      row.classList.toggle('is-on', input.checked);
      item.onChange(input.checked);
    });
    row.setChecked = c => { input.checked = c; row.classList.toggle('is-on', c); };
    return row;
  });
  const el = h('div', { class: `checklist${horizontal ? ' checklist--horizontal' : ''}` }, rows);
  /** Re-reads every item's state from `getChecked(index)`. */
  el.refresh = getChecked => rows.forEach((r, i) => r.setChecked(Boolean(getChecked(i))));
  return el;
}

/** A button showing a number; tapping it prompts for a new value within [min, max]. */
export function valueButton(value, onChange, { prompt = 'Value', min = -Infinity, max = Infinity, format = String } = {}) {
  let current = value;
  const el = button(format(current), {
    className: 'value-btn',
    onClick: async () => {
      const n = await promptNumber(prompt, current, { min, max });
      if (n === null) return;
      el.setValue(n);
      onChange(n);
    },
  });
  el.setValue = v => { current = v; el.textContent = format(v); };
  return el;
}

/**
 * A labelled range slider with a number box. The number can be typed in as well
 * as dragged; a typed value is rounded to the step and kept within [min, max].
 */
export function slider(label, value, onChange, { min, max, step = 1 }) {
  const range = h('input', { type: 'range', min, max, step, value });
  const box = h('input', {
    type: 'number', class: 'slider__value', min, max, step, value,
    inputmode: 'numeric', 'aria-label': label || 'Value',
  });
  const clamp = n => {
    const stepped = Math.round((n - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  };
  const commit = n => {
    range.value = n;
    box.value = n;
    onChange(n);
  };
  range.addEventListener('input', () => { box.value = range.value; });
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
  box.addEventListener('keydown', event => { if (event.key === 'Enter') box.blur(); });
  box.addEventListener('focus', () => box.select());
  const el = h('div', { class: 'slider' }, label ? h('div', { class: 'slider__label' }, label) : null, h('div', { class: 'slider__row' }, box, range));
  el.setValue = v => { range.value = v; box.value = v; };
  return el;
}

/** Label + control, stacked or inline. */
export function field(label, control, { inline = false } = {}) {
  return h('div', { class: `field${inline ? ' field--inline' : ''}` }, h('span', { class: 'label' }, label), control);
}
