// @ts-nocheck
// Appearance and Customization: the colour theme.

import { field } from '../../ui/components.ts';
import { THEMES } from '../../ui/theme.ts';
import { group, settingsScreen } from './controls.ts';

export function appearanceScreen(app) {
  const { el, columns, form } = settingsScreen(app, { title: 'Appearance', help: 'settings.appearance' });
  columns.append(group(field('Theme', form.select('display.theme', THEMES))));
  return { el };
}
