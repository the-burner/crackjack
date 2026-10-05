// The options screen every drill has: a column of controls bound to the
// drill's settings and the green "Launch the Drill" button. The playing
// strategy and true count settings the drills use are set from Settings on the
// home screen.

import { h } from '../../ui/dom.js';
import { button, checkList, select, slider, valueButton, field } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { pickDuration, tenthsColumns } from '../../ui/time-wheel.js';
import { clockTime } from './format.js';

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.help
 * @param {string} o.drill      The drill's settings prefix, e.g. 'drills.flash'.
 * @param {() => void} o.onLaunch
 */
export function drillOptionsScreen(app, { title, help, drill, onLaunch }) {
  const { el, body } = standardScreen(app, { title, help, className: 'drill-options' });
  const column = h('div', { class: 'column' });
  const form = optionsForm(app, drill);
  body.append(column);

  // Controls follow settings that other screens write too (the custom-hand
  // editor, the tray-style correction made at launch).
  const unsubscribe = app.settings.subscribe(() => form.refresh());

  const launch = button('Launch the Drill', { variant: 'primary', icon: 'gear', iconPos: 'bottom', block: true, onClick: onLaunch, 'data-action': 'launch' });

  return {
    el,
    body,
    column,
    form,
    /** Adds the controls, then the launch button. */
    append(...children) {
      column.append(...children.filter(Boolean), launch);
    },
    onShow() {
      form.refresh();
    },
    destroy() {
      unsubscribe();
    },
  };
}

/** A group of controls kept together. */
export const group = (...children) => h('div', { class: 'drill-options__group' }, ...children.filter(Boolean));

/** A label on the left and a control on the right. */
export const row = (label, control) => field(label, control, { inline: true });

/** A label over one or more cards, keeping them together. */
export const section = (title, ...children) => h('div', { class: 'drill-options__section' },
  h('div', { class: 'note drill-options__heading' }, title), ...children.filter(Boolean));

/** A select and a small button side by side. */
export const withButton = (main, extra) => h('div', { class: 'drill-options__pair' }, main, extra);

/**
 * Controls bound to settings under one prefix. Every control re-reads its value
 * when `refresh()` is called, which happens whenever any of them changes.
 */
function optionsForm(app, prefix) {
  const controls = [];
  const full = key => (key.includes('.') ? key : `${prefix}.${key}`);
  const get = key => app.settings.get(full(key));
  const set = (key, value) => { app.settings.set(full(key), value); form.refresh(); };

  const form = {
    get,
    set,

    refresh() {
      controls.forEach(fn => fn());
    },

    /** Runs `fn` whenever the form is re-read (for notes that depend on a value). */
    watch(fn) {
      controls.push(fn);
      fn();
    },

    /** A select bound to a setting; options are `{value, label}`. */
    select(key, options) {
      const el = select(options, get(key), value => set(key, value), { name: full(key) });
      controls.push(() => el.setValue(get(key)));
      return el;
    },

    /** A select whose value is spread over more than one setting. */
    custom(name, options, read, write) {
      const el = select(options, read(), value => { write(value); form.refresh(); }, { name: full(name) });
      controls.push(() => el.setValue(read()));
      return el;
    },

    /** Checkboxes for boolean settings: `{label, key}`. */
    checks(items, options) {
      const el = checkList(items.map(item => ({
        label: item.label,
        checked: Boolean(get(item.key)),
        onChange: on => set(item.key, on),
      })), options);
      controls.push(() => el.refresh(i => get(items[i].key)));
      return el;
    },

    /**
     * Checkboxes for the booleans inside one object setting (the Flash
     * situations), as `{label, flag}`.
     */
    flags(key, items, options) {
      const el = checkList(items.map(item => ({
        label: item.label,
        checked: Boolean(get(key)[item.flag]),
        onChange: on => set(key, { ...get(key), [item.flag]: on }),
      })), options);
      controls.push(() => el.refresh(i => get(key)[items[i].flag]));
      return el;
    },

    /** A labelled button showing a number; tapping it prompts for a new one. */
    number(label, key, { prompt, format, min, max } = {}) {
      const schema = app.settings.schema[full(key)];
      const el = valueButton(get(key), value => set(key, value), {
        prompt: prompt ?? label, min: min ?? schema.min, max: max ?? schema.max, format,
      });
      controls.push(() => el.setValue(get(key)));
      return el;
    },

    /**
     * A row showing a duration setting as hh:mm:ss (or, with `tenths`, a value
     * in tenths of a second as "0.8 s"); tapping it opens the wheels.
     */
    duration(label, key, { tenths = false } = {}) {
      const { min, max } = app.settings.schema[full(key)];
      const show = n => (tenths ? `${(n / 10).toFixed(1)} s` : clockTime(n));
      const value = button(show(get(key)), {
        className: 'value-btn',
        'aria-label': label,
        onClick: async () => {
          const picked = await pickDuration({ title: label, value: get(key), min, max, columns: tenths ? tenthsColumns(max) : undefined });
          if (picked !== null) set(key, picked);
        },
      });
      controls.push(() => { value.textContent = show(get(key)); });
      return h('div', { class: 'settings-row' }, h('span', { class: 'label' }, label), value);
    },

    /** A labelled slider bound to a setting. */
    slider(label, key, { min, max } = {}) {
      const schema = app.settings.schema[full(key)];
      const el = slider(label, get(key), value => set(key, value), { min: min ?? schema.min, max: max ?? schema.max });
      controls.push(() => el.setValue(get(key)));
      return el;
    },
  };
  return form;
}

/** Deck-count options; drills that allow Spanish decks add them separately. */
export const DECK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map(value => ({
  value, label: `${['Single', 'Double', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][value - 1]} Deck${value > 1 ? 's' : ''}`,
}));

/** The timer mode every drill offers besides its own timed mode: stop when the drill time runs out. */
export const COUNT_DOWN_HALT_OPTION = { value: 'countDownHalt', label: 'Timer Mode: Count Down & Halt' };

export const ACCURACY_OPTIONS = [
  { value: 0, label: 'Accuracy: Exact' },
  { value: 1, label: 'Accuracy: ±1' },
  { value: 2, label: 'Accuracy: ±2' },
];

export const TRAY_OPTIONS = [
  { value: 'eightDeckFront', label: 'Eight-deck tray, front' },
  { value: 'sixDeckFront', label: 'Six-deck tray, front' },
  { value: 'doubleDeckFront', label: 'Double-deck tray, front' },
  { value: 'sixDeckRear', label: 'Six-deck tray, rear' },
  { value: 'doubleDeckRear', label: 'Double-deck tray, rear' },
];

export const BIAS_OPTIONS = [
  { value: 'none', label: 'Bias: None' },
  { value: 'negative', label: 'Bias: Negative' },
  { value: 'positive', label: 'Bias: Positive' },
];

export const END_WARNING_OPTIONS = [
  { value: 'none', label: 'End warning: None' },
  { value: 'oneCardLeft', label: 'End warning: one card left' },
  { value: 'twoCardsLeft', label: 'End warning: two cards left' },
];
