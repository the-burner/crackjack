// Casino Database: the Current Blackjack News
// list of casinos, their rules, and a button that loads those rules into the
// game's settings.

import { h, replaceChildren } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { alert, prompt } from '../../ui/dialogs.js';
import {
  MAX_RESULTS, casinoDetailRows, casinoRuleSettings, parseCasinoDatabase,
  parseCasinoRecord, searchCasinoDatabase, summarizeCasinoRecord,
} from '../../settings/casino-rules.js';

const STORAGE_KEY = 'casinoDatabase';
const FIRST_USE_NOTE = 'You must initialize the database the first time you use it. '
  + 'If you do NOT have a CBJN subscription, click Update and a database from 2015 will be loaded. '
  + 'If you do have a subscription, click Help for instructions.';
const SEARCH_HINT = 'Click on a game to view details or load the rules into the game.';

const databaseUrl = id => `/apps/cbjn7.php?a=${encodeURIComponent(id)}&b=${encodeURIComponent(id)}`;

export function casinoDbScreen(app) {
  const { settings, storage } = app;
  const { el, body } = standardScreen(app, { title: 'Casino DB', help: 'settings.casinoDb', className: 'casino-screen' });
  let query = '';

  const searchButton = button('Enter search text here', { block: true, onClick: () => runSearch(), 'data-action': 'search' });
  const note = h('div', { class: 'casino__note' }, FIRST_USE_NOTE);
  const list = h('div', { class: 'casino__list' });
  const idButton = button('Enter CBJN id', { block: true, onClick: () => enterId(), 'data-action': 'cbjn-id' });
  const updateButton = button('Update', { icon: 'plus', onClick: () => update(), 'data-action': 'update' });
  const dateButton = button('Last Update: Never', { 'data-action': 'last-update' });

  body.append(h('div', { class: 'casino' },
    searchButton,
    note,
    list,
    h('div', { class: 'casino__bottom' }, idButton, h('div', { class: 'row' }, updateButton, dateButton)),
  ));

  const database = () => storage.get(STORAGE_KEY, { date: null, records: [] });

  function refresh() {
    const { date } = database();
    note.hidden = Boolean(date);
    list.hidden = list.children.length === 0;
    dateButton.textContent = `Last Update: ${date ?? 'Never'}`;
    const id = settings.get('casinoDb.cbjnId');
    idButton.textContent = id || 'Enter CBJN id';
  }

  async function enterId() {
    const entered = await prompt('Userid', settings.get('casinoDb.cbjnId'));
    if (entered === null) return;
    settings.set('casinoDb.cbjnId', entered.trim());
    refresh();
  }

  async function update() {
    const id = settings.get('casinoDb.cbjnId');
    if (id === '') { await alert('Enter your CBJN id first.'); return; }
    updateButton.disabled = true;
    try {
      const response = await fetch(databaseUrl(id));
      if (!response.ok) throw new Error('DB could not be imported. Probably no Internet connection.');
      const { date, records } = parseCasinoDatabase(await response.text(), id);
      if (records.length === 0) throw new Error('DB could not be imported. Probably an incorrect CBJN id.');
      storage.set(STORAGE_KEY, { date, records });
      refresh();
      await alert('Updated. You may now search.');
    } catch (error) {
      await alert(error.message);
    } finally {
      updateButton.disabled = false;
    }
  }

  async function runSearch() {
    const entered = await prompt('Search', query);
    if (entered === null) return;
    query = entered.trim();
    searchButton.textContent = query || 'Enter search text here';
    if (query === '') { await alert('Enter search text'); return; }
    const { records, truncated } = searchCasinoDatabase(database().records, query);
    replaceChildren(list,
      h('div', { class: 'casino__hint' }, records.length ? SEARCH_HINT : 'No games found.'),
      records.map(record => h('button', {
        type: 'button',
        class: 'casino__item',
        onclick: () => app.open('settings.casinoDetail', { record: record.raw }),
      }, summarizeCasinoRecord(record))));
    refresh();
    if (truncated) await alert(`First ${MAX_RESULTS} hits displayed`);
  }

  return { el, onShow: refresh };
}

/** One game's details, with the button that loads its rules into the settings. */
export function casinoDetailScreen(app, { record: raw = '' } = {}) {
  const { el, body } = standardScreen(app, { title: 'Table Details', help: 'settings.casinoDetail' });
  const record = parseCasinoRecord(raw);

  body.append(h('div', { class: 'column' },
    h('table', { class: 'grid casino-detail' },
      h('tbody', {}, casinoDetailRows(record).map(([label, value]) => h('tr', {}, h('td', {}, label), h('td', {}, value))))),
    button('Load Rules', { icon: 'plus', block: true, onClick: () => loadRules(), 'data-action': 'load-rules' }),
  ));

  async function loadRules() {
    app.settings.update(casinoRuleSettings(record));
    await alert(`Rules for ${record.name} loaded.`);
    app.back();
  }

  return { el };
}
