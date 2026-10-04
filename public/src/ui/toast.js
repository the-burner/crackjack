// A short message that appears briefly at the bottom of the screen.

import { h } from './dom.js';

let current = null;

export function toast(message) {
  current?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  current = el;
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
  }, 1800);
}
