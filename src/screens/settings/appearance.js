// Appearance and Customization: the colour theme.

import { field } from '../../ui/components.js';
import { THEMES } from '../../ui/theme.js';
import { group, settingsScreen } from './controls.js';

export function appearanceScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Appearance', help: 'settings.appearance' });
  columns.append(group(field('Theme', form.select('display.theme', THEMES))));
  return { el };
}
