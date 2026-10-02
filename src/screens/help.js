// Help text for a screen.

import { HELP } from '../data/help.js';
import { standardScreen } from '../ui/screen.js';

export function helpScreen(app, { topic }) {
  const { el, body } = standardScreen(app, { title: 'Screen Help', className: 'help' });
  body.innerHTML = HELP[topic] ?? '<p>No help is available for this screen.</p>';
  // Help pages may contain links to qfit.com; open them outside the app.
  body.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  return { el };
}
