// Settings-bound controls.
//
// Every control writes through `applyRuleChange`, so a change that implies other
// rules updates them too, and then re-reads the whole form — the legacy screens
// did the same by re-rendering their checkbox lists after each tap.

import { h } from '../../ui/dom.js';
import { checkList, select, slider, valueButton } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { applyRuleChange } from '../../settings/rules-logic.js';

export { select };

/**
 * A settings screen: the standard title bar plus a body that holds one or two
 * columns of control groups.
 * @param {object} app
 * @param {{title: string, help: string, note?: string}} o
 */
export function settingsScreen(app, { title, help, note }) {
  const { el, body } = standardScreen(app, { title, help, className: 'settings' });
  const columns = h('div', { class: 'settings-cols' });
  if (note) body.append(h('p', { class: 'note settings-note' }, note));
  body.append(columns);
  return { el, columns, form: settingsForm(app) };
}

/**
 * Creates the control factory for one screen. Controls built by it re-read their
 * value from `app.settings` whenever any of them changes.
 */
function settingsForm(app) {
  const controls = [];
  const get = key => app.settings.get(key);
  const write = (key, value) => {
    app.settings.update(applyRuleChange(get, key, value));
    form.refresh();
  };

  const form = {
    /** Re-reads every control on the screen. */
    refresh() {
      for (const refresh of controls) refresh();
    },

    /**
     * A group of checkboxes. An item is either `{label, key}` for a boolean
     * setting or `{label, key, value, off}` for one member of an enum setting.
     * @param {{label: string, key: string, value?: *, off?: *}[]} items
     */
    checks(items, options) {
      const checked = item => (item.value === undefined ? Boolean(get(item.key)) : get(item.key) === item.value);
      const el = checkList(items.map(item => ({
        label: item.label,
        checked: checked(item),
        onChange: on => write(item.key, item.value === undefined ? on : (on ? item.value : item.off)),
      })), options);
      controls.push(() => el.refresh(i => checked(items[i])));
      return el;
    },

    /**
     * A select bound to a setting.
     * @param {string} key
     * @param {{value: *, label: string}[]} options
     */
    select(key, options, { onChange = write, ...rest } = {}) {
      const el = select(options, get(key), value => onChange(key, value), { name: key, ...rest });
      controls.push(() => el.setValue(get(key)));
      return el;
    },

    /**
     * A label and a button showing a number; tapping it prompts for a new one.
     * The prompt clamps to the schema's range; `clamp` narrows it further when
     * the limit depends on another setting.
     */
    number(label, key, { prompt, format, clamp = value => value } = {}) {
      const { min, max } = app.settings.schema[key];
      const el = valueButton(get(key), value => write(key, clamp(value)), { prompt: prompt ?? label, min, max, format });
      controls.push(() => el.setValue(get(key)));
      return row(label, el);
    },

    /** A labelled slider bound to a setting. */
    slider(label, key) {
      const { min, max } = app.settings.schema[key];
      const el = slider(label, get(key), value => write(key, value), { min, max });
      controls.push(() => el.setValue(get(key)));
      return el;
    },
  };
  return form;
}

/** A label on the left and a value button on the right. */
function row(label, control) {
  return h('div', { class: 'settings-row' }, h('span', { class: 'label' }, label), control);
}

/** A group of controls that stays together when the screen splits into columns. */
export function group(...children) {
  return h('div', { class: 'settings-group' }, ...children);
}
