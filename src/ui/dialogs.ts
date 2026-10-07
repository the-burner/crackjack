// Modal message, confirmation and input dialogs (promise based).

import { h } from './dom';
import { registerOverlay } from './overlays';

const APP_TITLE = 'Crackjack';
let dialogs = 0;

type DialogButton<T> = { label: string; value: T };
type DialogInput = { type?: string; value?: string; inputmode?: string };
/** A button whose value is 'input' resolves to the entered text. */
type InputValue = 'input';
type DialogOptions<T> = {
  title?: string;
  message: string;
  input?: DialogInput | null;
  buttons: readonly DialogButton<T>[];
};

function open<T>(o: DialogOptions<T> & { input?: null }): Promise<T>;
function open<T>(o: DialogOptions<T | InputValue> & { input: DialogInput }): Promise<T | string | null>;
function open<T>({
  title = APP_TITLE,
  message,
  input = null,
  buttons,
}: DialogOptions<T | InputValue>): Promise<T | string | null> {
  return new Promise(resolve => {
    const field = input
      ? h('input', {
          class: 'dialog__input',
          type: input.type ?? 'text',
          value: input.value ?? '',
          inputmode: input.inputmode,
        })
      : null;
    const close = (result: T | string | null) => {
      unregister();
      // Closing hands focus back to whatever had it before.
      overlay.close();
      overlay.remove();
      resolve(result);
    };
    // A back request or Escape dismisses the dialog as its last button would (Cancel, No, OK).
    const dismissed = buttons[buttons.length - 1].value;
    const dismiss = () => close(dismissed === 'input' ? null : dismissed);
    const unregister = registerOverlay(dismiss);
    const id = `dialog-${++dialogs}`;
    // A modal <dialog> keeps focus inside and the screens behind it inert.
    const overlay = h(
      'dialog',
      { class: 'dialog-overlay', 'aria-labelledby': `${id}-title`, 'aria-describedby': `${id}-body` },
      h(
        'div',
        { class: 'dialog' },
        h('div', { class: 'dialog__title', id: `${id}-title` }, title),
        h(
          'div',
          { class: 'dialog__body', id: `${id}-body` },
          ...String(message)
            .split('\n')
            .flatMap((line, i) => (i ? [h('br'), line] : [line])),
          field,
        ),
        h(
          'div',
          { class: 'dialog__buttons' },
          buttons.map(b =>
            h(
              'button',
              { type: 'button', onclick: () => close(b.value === 'input' && field ? field.value : b.value) },
              b.label,
            ),
          ),
        ),
      ),
    );
    overlay.addEventListener('cancel', event => {
      event.preventDefault();
      dismiss();
    });
    document.body.append(overlay);
    overlay.showModal();
    if (field) {
      field.addEventListener('keydown', e => {
        if (e.key === 'Enter') close(field.value);
      });
      field.focus();
      field.select();
    }
  });
}

/** Shows a message with an OK button. */
export function alert(message: string, { title }: { title?: string } = {}): Promise<true> {
  return open<true>({ title, message, buttons: [{ label: 'OK', value: true }] });
}

/** Asks a yes/no question; resolves to true for Yes. */
export function confirm(
  message: string,
  { title, yes = 'Yes', no = 'No' }: { title?: string; yes?: string; no?: string } = {},
): Promise<boolean> {
  return open({
    title,
    message,
    buttons: [
      { label: yes, value: true },
      { label: no, value: false },
    ],
  });
}

/** Asks for text; resolves to the entered string, or null when cancelled. */
export function prompt(
  message: string,
  value = '',
  { title, type = 'text', inputmode }: { title?: string; type?: string; inputmode?: string } = {},
): Promise<string | null> {
  return open<null>({
    title,
    message,
    input: { value, type, inputmode },
    buttons: [
      { label: 'OK', value: 'input' },
      { label: 'Cancel', value: null },
    ],
  });
}

/** Asks for a whole number and clamps it to [min, max]; resolves to null when cancelled or invalid. */
export async function promptNumber(
  message: string,
  value: number,
  { min = -Infinity, max = Infinity, title }: { min?: number; max?: number; title?: string } = {},
): Promise<number | null> {
  const text = await prompt(message, String(value), { title, inputmode: 'numeric' });
  if (text === null || text.trim() === '') return null;
  const n = Math.round(Number(text));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
