// Unusual Games: the side-bet / bonus game selector and the
// import of custom games exported from Casino Verite Blackjack.

import { h, replaceChildren } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { alert, prompt } from '../../ui/dialogs.js';
import { BUILTIN_SIDE_BET_GAMES } from '../../data/side-bet-games.js';
import { sideBetGameName } from '../../settings/side-bet-games.js';
import { applyGameChange } from '../../settings/rules-logic.js';
import { group, select, settingsScreen } from './controls.js';

/** Imported game definitions, as `[{id, name, definition}]`. */
const STORAGE_KEY = 'customSideBetGames';

/** First id used for an imported game, above every built-in game id. */
const FIRST_CUSTOM_ID = 1001;

const NOTE = [
  'You can select one of numerous unusual games above.',
  'Custom side bets and bonuses can also be imported from Casino Verite Blackjack on a '
  + 'Windows PC. If you do not have a license, the free demo version will also allow exports. '
  + 'In Casino Verite, click on Options, Settings, Unusual Games. Select a custom game. Then hit '
  + 'Export. (If the button is not there, download the latest update.) You will be presented with '
  + 'a number. Enter the number below and click Import. You will see your game in the list. '
  + 'Multiple games can be imported.',
];

export function unusualGamesScreen(app) {
  const { el, columns } = settingsScreen(app, { title: 'Unusual Games', help: 'settings.unusualGames' });
  const settings = app.settings;
  const slot = h('div', { class: 'settings-select-slot' });
  const render = () => replaceChildren(slot, select(
    gameOptions(app),
    settings.get('bonuses.game'),
    gameId => settings.update(applyGameChange(key => settings.get(key), gameId)),
    { name: 'bonuses.game' },
  ));

  columns.append(group(
    slot,
    h('div', { class: 'settings-prose' }, NOTE.map(text => h('p', {}, text))),
    button('Import', { icon: 'plus', block: true, onClick: () => importGame(app, render) }),
  ));
  render();
  return { el };
}

/** Imported games first, then the built-in ones. */
function gameOptions(app) {
  const custom = app.storage.get(STORAGE_KEY, []);
  return [
    ...custom.map(({ id, name }) => ({ value: id, label: name })),
    ...BUILTIN_SIDE_BET_GAMES.map(({ id, name }) => ({ value: id, label: name })),
  ];
}

/** Downloads a game exported from Casino Verite, stores it and selects it. */
async function importGame(app, render) {
  const code = (await prompt('Enter the export code from Casino Verite Blackjack.'))?.trim();
  if (!code) return;
  let definition;
  try {
    const response = await fetch(`/Apps/u${encodeURIComponent(code)}.php`);
    if (!response.ok) throw new Error(`status ${response.status}`);
    definition = (await response.text()).replaceAll('%20', ' ');
  } catch (error) {
    await alert(`File could not be imported: ${error.message}`);
    return;
  }
  if (definition.indexOf('|', 1) === -1) {
    await alert('File could not be imported. Probably an incorrect code.');
    return;
  }
  const custom = app.storage.get(STORAGE_KEY, []);
  const id = custom.reduce((max, game) => Math.max(max, game.id), FIRST_CUSTOM_ID - 1) + 1;
  const name = sideBetGameName(definition);
  app.storage.set(STORAGE_KEY, [...custom, { id, name, definition }]);
  app.settings.update(applyGameChange(key => app.settings.get(key), id));
  render();
  await alert(`${name} imported`);
}
