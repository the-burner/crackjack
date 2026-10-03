// Unusual Games: the side-bet / bonus game selector.

import { h } from '../../ui/dom.js';
import { BUILTIN_SIDE_BET_GAMES } from '../../data/side-bet-games.js';
import { applyGameChange } from '../../settings/rules-logic.js';
import { group, select, settingsScreen } from './controls.js';

const NOTE = 'You can select one of numerous unusual games above.';

export function unusualGamesScreen(app) {
  const { el, columns } = settingsScreen(app, { title: 'Unusual Games', help: 'settings.unusualGames' });
  const settings = app.settings;
  columns.append(group(
    select(
      BUILTIN_SIDE_BET_GAMES.map(({ id, name }) => ({ value: id, label: name })),
      settings.get('bonuses.game'),
      gameId => settings.update(applyGameChange(key => settings.get(key), gameId)),
      { name: 'bonuses.game' },
    ),
    h('div', { class: 'settings-prose' }, h('p', {}, NOTE)),
  ));
  return { el };
}
