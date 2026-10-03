// Opening the table from the home screen.

import { prepareLaunch } from '../settings/rules-logic.js';

/** Makes sure the player has a seat, then opens the table. */
export function openTable(app) {
  const { changes } = prepareLaunch(key => app.settings.get(key));
  app.settings.update(changes);
  app.open('game.table');
}
