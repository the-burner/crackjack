// Modal message, confirmation and input dialogs (promise based).

import { h } from './dom.js';

const APP_TITLE = 'Blackjack Verite';

function open({ title = APP_TITLE, message, input = null, buttons }) {
  return new Promise(resolve => {
    const field = input ? h('input', { class: 'dialog__input', type: input.type ?? 'text', value: input.value ?? '', inputmode: input.inputmode }) : null;
    const close = result => { overlay.remove(); resolve(result); };
    const overlay = h('div', { class: 'dialog-overlay', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'dialog' },
        h('div', { class: 'dialog__title' }, title),
        h('div', { class: 'dialog__body' }, ...String(message).split('\n').flatMap((line, i) => (i ? [h('br'), line] : [line])), field),
        h('div', { class: 'dialog__buttons' },
          buttons.map(b => h('button', { type: 'button', onclick: () => close(b.value === 'input' ? field.value : b.value) }, b.label))),
      ));
    document.body.append(overlay);
    if (field) {
      field.addEventListener('keydown', e => { if (e.key === 'Enter') close(field.value); });
      field.focus();
      field.select();
    }
  });
}

/** Shows a message with an OK button. */
export function alert(message, { title } = {}) {
  return open({ title, message, buttons: [{ label: 'OK', value: true }] });
}

/** Asks a yes/no question; resolves to true for Yes. */
export function confirm(message, { title, yes = 'Yes', no = 'No' } = {}) {
  return open({ title, message, buttons: [{ label: yes, value: true }, { label: no, value: false }] });
}

/** Asks for text; resolves to the entered string, or null when cancelled. */
export function prompt(message, value = '', { title, type = 'text', inputmode } = {}) {
  return open({ title, message, input: { value, type, inputmode }, buttons: [{ label: 'OK', value: 'input' }, { label: 'Cancel', value: null }] });
}

/** Asks for a whole number and clamps it to [min, max]; resolves to null when cancelled or invalid. */
export async function promptNumber(message, value, { min = -Infinity, max = Infinity, title } = {}) {
  const text = await prompt(message, String(value), { title, inputmode: 'numeric' });
  if (text === null || text.trim() === '') return null;
  const n = Math.round(Number(text));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
