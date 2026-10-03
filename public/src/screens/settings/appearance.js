// Appearance and Customization: the theme. Themes are not applied yet.

import { field } from '../../ui/components.js';
import { group, settingsScreen } from './controls.js';

const THEMES = [
  { value: 'classic', label: 'Classic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function appearanceScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Appearance', help: 'settings.appearance' });
  columns.append(group(field('Theme', form.select('display.theme', THEMES))));
  return { el };
}
