// The settings hub: navigation to every option screen.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';

const NOTE = 'The playing strategy and true count settings are also used by the drills.';

const SECTIONS = [
  ['Table and Rules', [
    ['Basic Setup', 'settings.setup'],
    ['Common Rules', 'settings.commonRules'],
    ['Rule Variations', 'settings.ruleVariations'],
    ['Bonuses', 'settings.bonuses'],
    ['Play Variations', 'settings.playVariations'],
    ['Unusual Games', 'settings.unusualGames'],
    ['Dealer Errs/Biases', 'settings.dealerErrors'],
  ]],
  ['Strategy', [
    ['Playing Strategies', 'settings.strategy'],
    ['Betting Strategies', 'settings.betting'],
    ['True Count Calcs', 'settings.trueCount'],
    ['Peeking', 'settings.peeking'],
  ]],
  ['App', [
    ['Speed/Mechanics', 'settings.mechanics'],
    ['Appearance & Customization', 'settings.appearance'],
  ]],
];

export function settingsHubScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Options', help: 'settings', className: 'settings' });
  const navButton = ([label, screen]) => button(label, { icon: 'arrow-r', block: true, className: 'list-row', onClick: () => app.open(screen) });

  body.append(h('div', { class: 'column settings-hub' },
    SECTIONS.map(([title, screens], i) => h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, title),
      h('div', { class: 'settings-group' }, screens.map(navButton)),
      i === 1 ? h('p', { class: 'section__footer' }, NOTE) : null,
    )),
  ));
  return { el };
}
