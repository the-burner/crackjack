// A short message that appears briefly at the bottom (or top) of the screen,
// without stopping anything: taps go straight through it.

import { h } from './dom.ts';

export type ToastOptions = {
  position?: 'bottom' | 'top';
  tone?: 'plain' | 'good' | 'error';
  ms?: number;
};

let current: HTMLElement | null = null;

/** Returns the pop-up, detached once it has gone. */
export function toast(
  message: string,
  { position = 'bottom', tone = 'plain', ms = 1800 }: ToastOptions = {},
): HTMLDivElement {
  current?.remove();
  const classes = ['toast', position === 'top' && 'toast--top', tone !== 'plain' && `toast--${tone}`]
    .filter(Boolean)
    .join(' ');
  const el = h('div', { class: classes, role: 'status' }, message);
  document.body.append(el);
  current = el;
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
  }, ms);
  return el;
}
