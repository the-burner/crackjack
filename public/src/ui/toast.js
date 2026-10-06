// A short message that appears briefly at the bottom (or top) of the screen,
// without stopping anything: taps go straight through it.

import { h } from './dom.js';

let current = null;

/** @param {{position?: 'bottom'|'top', tone?: 'plain'|'good'}} [o] */
export function toast(message, { position = 'bottom', tone = 'plain' } = {}) {
  current?.remove();
  const classes = ['toast', position === 'top' && 'toast--top', tone === 'good' && 'toast--good'].filter(Boolean).join(' ');
  const el = h('div', { class: classes, role: 'status' }, message);
  document.body.append(el);
  current = el;
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
  }, 1800);
}
