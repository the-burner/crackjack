// Standard screen layout: title bar plus a scrolling body.

import { h } from './dom.js';
import { topBar } from './components.js';

/**
 * @param {object} app
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.help]   Help topic for the Help button.
 * @param {boolean} [o.back=true]
 * @param {string} [o.className]
 */
export function standardScreen(app, { title, help, back = true, className = '', end = [] }) {
  const body = h('div', { class: 'screen__body' });
  const el = h(
    'section',
    { class: className },
    topBar(title, {
      onBack: back ? () => app.back() : null,
      onHelp: help ? () => app.help(help, title || 'Crackjack') : null,
      end,
    }),
    body,
  );
  return { el, body };
}
