// Opening the table from the home screen.

import { prepareLaunch } from '@/settings/rules-logic';
import type { App } from '@/app/app';

/** Makes sure the player has a seat, then opens the table with `open`. */
export function openTable(app: App, open: () => void): void {
  const { changes } = prepareLaunch(key => app.settings.get(key));
  app.settings.update(changes);
  open();
}
