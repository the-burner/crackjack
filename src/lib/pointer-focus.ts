// Marks a control focused by a tap or click, so the `engaged:` variant
// (index.css) shows keyboard focus only: Safari keeps a clicked select focused.

const FOCUSABLE = 'button, select, input, textarea, [tabindex]';

export function trackPointerFocus(root: Document): void {
  root.addEventListener(
    'pointerdown',
    event => {
      const target = event.target instanceof Element ? event.target.closest(FOCUSABLE) : null;
      if (target instanceof HTMLElement) target.dataset.pointerFocus = '';
    },
    { capture: true },
  );
  root.addEventListener(
    'focusout',
    event => {
      if (event.target instanceof HTMLElement) delete event.target.dataset.pointerFocus;
    },
    { capture: true },
  );
}
