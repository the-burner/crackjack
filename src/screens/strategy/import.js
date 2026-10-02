// Import Strategy (legacy frmImport): download a strategy exported by Casino
// Verite Blackjack on a PC and add it to the strategy list.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { alert, prompt } from '../../ui/dialogs.js';
import { isStrategyFileText, normalizeImportedText, strategyCodeUrl } from '../../settings/strategy-import.js';

const INSTRUCTIONS = 'Playing strategies can be imported from Casino Verite Blackjack on a Windows PC. '
  + 'If you do not have a license, the free demo version will also allow exports. '
  + 'In Casino Verite, click on Strategies then Playing Strategies Simple. Select a strategy. '
  + 'Then hit Export Strategy. (If the button is not there, download the latest update.) '
  + 'You will be presented with a number. Enter the number below and click Import. '
  + 'Click Exit, then Select a Strategy, and you will see your strategy in the list. '
  + 'Multiple strategies can be imported.';

export function importStrategyScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Import Strategy', help: 'strategy.import' });
  let code = '';

  const codeButton = button('Enter text here', { block: true, onClick: () => enterCode(), 'data-action': 'code' });
  const importButton = button('Import', { icon: 'plus', block: true, onClick: () => runImport(), 'data-action': 'import' });

  body.append(h('div', { class: 'column' },
    h('textarea', { class: 'import__text', readonly: true }, INSTRUCTIONS),
    h('div', { class: 'import__code' }, codeButton),
    h('div', { class: 'import__btn' }, importButton),
  ));

  async function enterCode() {
    const entered = await prompt('Code', code, { inputmode: 'numeric' });
    if (entered === null) return;
    const trimmed = entered.trim();
    if (trimmed === '') return;
    if (!/^\d+$/.test(trimmed)) { await alert('Non-numeric input'); return; }
    code = trimmed;
    codeButton.textContent = code;
  }

  async function runImport() {
    if (code === '') { await alert('Enter the code from Casino Verite.'); return; }
    importButton.disabled = true;
    try {
      const text = await download(code);
      const id = app.strategies.add(text);
      const name = app.strategies.custom().find(s => s.id === id).name;
      app.settings.set('strategy.system', id);
      await alert(`${name} imported`);
      app.back();
    } catch (error) {
      await alert(error.message);
    } finally {
      importButton.disabled = false;
    }
  }

  return { el };
}

async function download(code) {
  let response;
  try {
    response = await fetch(strategyCodeUrl(code));
  } catch {
    throw new Error('File could not be read. Probably no Internet connection.');
  }
  if (!response.ok) throw new Error(`File could not be read: ${response.status}`);
  const text = normalizeImportedText(await response.text());
  if (text === '') throw new Error('File could not be imported. Probably an incorrect code.');
  if (!isStrategyFileText(text)) throw new Error('That code did not return a strategy. Probably an incorrect code.');
  return text;
}
