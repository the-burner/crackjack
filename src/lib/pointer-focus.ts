// Marks a control focused by a tap or click, so the `engaged:` variant
// (index.css) shows keyboard focus only. What decides is the last input: a
// select whose picker closes is focused again with no tap of its own, and must
// still count as clicked, while Tab onto a control once clicked must show.

const FOCUSABLE = 'button, select, input, textarea, [tabindex]';

export function trackPointerFocus(root: Document): void {
  let pointer = false;
  const mark = (el: EventTarget | null) => {
    const target = el instanceof Element ? el.closest(FOCUSABLE) : null;
    if (!(target instanceof HTMLElement)) return;
    if (pointer) target.dataset.pointerFocus = '';
    else delete target.dataset.pointerFocus;
  };
  root.addEventListener(
    'pointerdown',
    event => {
      pointer = true;
      mark(event.target);
    },
    { capture: true },
  );
  root.addEventListener(
    'keydown',
    () => {
      pointer = false;
    },
    { capture: true },
  );
  root.addEventListener('focusin', event => mark(event.target), { capture: true });
}
