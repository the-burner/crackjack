// Home screen: the four drills, the game and the settings.

import { h } from '../ui/dom.js';
import { button } from '../ui/components.js';
import { standardScreen } from '../ui/screen.js';
import { confirm, alert } from '../ui/dialogs.js';
import { toast } from '../ui/toast.js';
import { openTable } from '../game/launch.js';
import { WORDMARK_SVG } from '../ui/wordmark.js';

export const APP_VERSION = '3.0.0';

export function homeScreen(app) {
  const { el, body } = standardScreen(app, { title: '', help: 'home', back: false });
  const go = name => () => app.open(name);
  const drill = (name, detail, screen) => h('button', { type: 'button', class: 'home__drill', onclick: go(screen) },
    h('span', { class: 'home__drill-name' }, name), h('span', { class: 'home__drill-detail' }, detail));
  body.append(
    h('div', { class: 'column home' },
      h('h1', { class: 'home__name', html: WORDMARK_SVG }),
      button('Play Blackjack', { variant: 'primary', large: true, icon: 'arrow-r', block: true, onClick: () => openTable(app), 'data-action': 'play' }),
      h('div', { class: 'section' },
        h('h2', { class: 'section__title' }, 'Drills'),
        h('div', { class: 'home__drills' },
          drill('Flash Drills', 'Strategy and index plays', 'drills.flash.options'),
          drill('Depth Drills', 'Estimate decks played', 'drills.depth.options'),
          drill('Count Drills', 'Running and true count', 'drills.count.options'),
          drill('Full Table Drills', 'Count a whole table', 'drills.full.options'),
        )),
      h('div', { class: 'settings-group' },
        button('Settings', { icon: 'arrow-r', block: true, className: 'list-row', onClick: go('settings'), 'data-action': 'settings' }),
        button('Reset Defaults', { block: true, className: 'list-row', onClick: () => resetDefaults(app) }),
        button('Screen Info', { block: true, className: 'list-row', onClick: () => screenInfo() }),
      ),
    ),
    h('div', { class: 'footer-note' }, `Crackjack ${APP_VERSION} · Copyright 2025 Crackjack, all rights reserved`),
  );
  return { el };
}

async function resetDefaults(app) {
  if (!(await confirm('Are you sure that you want to reset all options to their defaults?'))) return;
  app.settings.reset();
  toast('Settings reset to defaults');
}

function screenInfo() {
  const info = [
    `Window: ${innerWidth} x ${innerHeight}`,
    `Screen: ${screen.width} x ${screen.height}`,
    `Pixel ratio: ${devicePixelRatio}`,
    navigator.userAgent,
  ];
  return alert(`${info.join('\n')}`);
}
