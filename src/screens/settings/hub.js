// The settings hub (legacy frmOpts0): navigation to every option screen.

import { h } from '../../ui/dom.js';
import { button } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { openTable } from '../../game/launch.js';

const NOTE = 'Click on the buttons to reach the various option screens. '
  + 'When options are set to your liking, click Launch Game.';

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
  ['Peeking', 'settings.peeking'],
];

/** Right column: the screens shared with the drills, plus the casino database. */
const PLAY_SCREENS = [
  ['Playing Strategies', 'settings.strategy'],
  ['Betting Strategies', 'settings.betting'],
  ['True Count Calcs', 'settings.trueCount'],
  ['Casino Database', 'settings.casinoDb'],
];

export function settingsHubScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Options', help: 'settings', className: 'settings' });
  const navButton = ([label, screen]) => button(label, { icon: 'arrow-r', block: true, onClick: () => app.open(screen) });

  body.append(h('div', { class: 'settings-hub' },
    h('div', { class: 'settings-hub__col' }, RULE_SCREENS.map(navButton)),
    h('div', { class: 'settings-hub__col' },
      h('p', { class: 'note settings-hub__note' }, NOTE),
      PLAY_SCREENS.map(navButton),
      button('Launch Game', {
        variant: 'primary', icon: 'gear', iconPos: 'bottom', block: true,
        className: 'settings-hub__launch', 'data-action': 'launch', onClick: () => openTable(app),
      }),
    ),
  ));
  return { el };
}

