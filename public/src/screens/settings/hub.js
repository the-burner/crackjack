// The settings hub: navigation to every option screen.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';

const NOTE = 'Click on the buttons to reach the various option screens. '
  + 'The playing strategy and true count settings are also used by the drills.';

/** Left column: the screens that set up the game's rules and mechanics. */
const RULE_SCREENS = [
  ['Basic Setup', 'settings.setup'],
  ['Common Rules', 'settings.commonRules'],
  ['Rule Variations', 'settings.ruleVariations'],
  ['Speed/Mechanics', 'settings.mechanics'],
  ['Bonuses', 'settings.bonuses'],
  ['Play Variations', 'settings.playVariations'],
  ['Unusual Games', 'settings.unusualGames'],
  ['Dealer Errs/Biases', 'settings.dealerErrors'],
];

/** Right column: the screens shared with the drills, appearance and peeking. */
const PLAY_SCREENS = [
  ['Playing Strategies', 'settings.strategy'],
  ['Betting Strategies', 'settings.betting'],
  ['True Count Calcs', 'settings.trueCount'],
  ['Appearance & Customization', 'settings.appearance'],
  ['Peeking', 'settings.peeking'],
];

export function settingsHubScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Options', help: 'settings', className: 'settings' });
  const navButton = ([label, screen]) => button(label, { icon: 'arrow-r', block: true, onClick: () => app.open(screen) });

  body.append(h('div', { class: 'settings-hub' },
    h('div', { class: 'settings-hub__col' }, RULE_SCREENS.map(navButton)),
    h('div', { class: 'settings-hub__col' },
      h('p', { class: 'note settings-hub__note' }, NOTE),
      PLAY_SCREENS.map(navButton),
    ),
  ));
  return { el };
}

