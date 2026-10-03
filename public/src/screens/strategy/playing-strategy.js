// Playing Strategy: which counting system to play, how many
// of its indices to use, the rules the tables are built for, and the table
// display.

import { h } from '../../ui/dom.js';
import { button, select, checkList, valueButton } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { INDEX_SETS } from '../../core/strategy/strategy-tables.js';

const INDEX_SET_LABELS = {
  all: 'All Indices',
  illustrious18: 'Illustrious 18',
  sweet16: 'Sweet 16',
  catch20: 'Catch 20',
  none: 'No Indices',
  custom: 'Custom',
};

const RULE_CHECKS = [
  { label: 'Warning on Strategy Error', key: 'strategy.warnOnError' },
  { label: 'Double after split', key: 'rules.doubleAfterSplit' },
  { label: 'Hit soft 17', key: 'rules.dealerHitsSoft17' },
  { label: 'No hole card', key: 'rules.noHoleCard' },
  { label: 'Double any number of cards', key: 'rules.doubleAnyNumberOfCards' },
];

export function playingStrategyScreen(app) {
  const { settings, strategies } = app;
  const { el, body } = standardScreen(app, { title: 'Strategies', help: 'settings.strategy' });

  const systemOptions = strategies.list().map(({ id, name }) => ({ value: id, label: name }));
  const systemSelect = select(systemOptions, settings.get('strategy.system'), id => settings.set('strategy.system', id));
  const indexSelect = select(
    INDEX_SETS.map(value => ({ value, label: INDEX_SET_LABELS[value] })),
    settings.get('strategy.indexSet'),
    value => settings.set('strategy.indexSet', value),
    { mini: true },
  );
  const rangeMin = valueButton(settings.get('strategy.indexRangeMin'), v => settings.set('strategy.indexRangeMin', v), { prompt: 'Minimum Count', min: -99, max: 99 });
  const rangeMax = valueButton(settings.get('strategy.indexRangeMax'), v => settings.set('strategy.indexRangeMax', v), { prompt: 'Maximum Count', min: -99, max: 99 });
  const rules = checkList(RULE_CHECKS.map(({ label, key }) => ({
    label, checked: settings.get(key), onChange: on => settings.set(key, on),
  })));
  const ircCheck = checkList([{
    label: 'Adjust IRC',
    checked: settings.get('strategy.adjustInitialCount'),
    onChange: on => settings.set('strategy.adjustInitialCount', on),
  }]);
  const ircValue = valueButton(settings.get('strategy.initialCount'), v => settings.set('strategy.initialCount', v), { prompt: 'Adjust IRC', min: -999, max: 999 });

  body.append(h('div', { class: 'column' },
    h('div', { class: 'strat-row' }, h('span', { class: 'label' }, 'Strategy:'), h('div', { class: 'strat-row__fill' }, systemSelect)),
    h('div', { class: 'strat-row' },
      h('span', { class: 'label' }, 'Indices:'),
      h('div', { class: 'strat-row__fill' }, indexSelect),
      button('Select', { onClick: () => app.open('strategy.tables', { mode: 'editMask', maskKey: 'strategy.customIndexMask' }), 'data-action': 'select-indices' })),
    h('div', { class: 'strat-row' },
      h('span', { class: 'label' }, 'Index Range:'),
      h('div', { class: 'strat-row__fill row' }, rangeMin, h('span', { class: 'label' }, 'to'), rangeMax)),
    h('div', { class: 'strat-row' }, h('span', { class: 'label' }, 'Rules:'), h('div', { class: 'strat-row__fill' }, rules)),
    h('div', { class: 'row' }, ircCheck, ircValue),
    button('Display Tables', { icon: 'grid', iconPos: 'bottom', onClick: () => app.open('strategy.tables', { mode: 'view' }), 'data-action': 'display-tables' }),
  ));

  return {
    el,
    onShow() {
      systemSelect.setValue(settings.get('strategy.system'));
      indexSelect.setValue(settings.get('strategy.indexSet'));
      rangeMin.setValue(settings.get('strategy.indexRangeMin'));
      rangeMax.setValue(settings.get('strategy.indexRangeMax'));
      rules.refresh(i => settings.get(RULE_CHECKS[i].key));
      ircCheck.refresh(() => settings.get('strategy.adjustInitialCount'));
      ircValue.setValue(settings.get('strategy.initialCount'));
    },
  };
}
