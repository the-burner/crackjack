// Home screen: the four drills, the game and the settings.

import { h } from '../ui/dom.js';
import { button } from '../ui/components.js';
import { standardScreen } from '../ui/screen.js';
import { confirm, alert } from '../ui/dialogs.js';

export const APP_VERSION = '3.0.0';

export function homeScreen(app) {
  const { el, body } = standardScreen(app, { title: 'Home Screen', help: 'home', back: false });
  const go = name => () => app.open(name);
  body.append(
    h('div', { class: 'column home' },
      h('img', { class: 'home__logo', src: 'assets/icons/logo.png', alt: '' }),
      button('Play Blackjack', { variant: 'primary', large: true, icon: 'gear', iconPos: 'bottom', block: true, onClick: go('game.table'), 'data-action': 'play' }),
      h('div', { class: 'home__drills' },
        button('Flash Drills', { large: true, icon: 'gear', block: true, onClick: go('drills.flash.options') }),
        button('Depth Drills', { large: true, icon: 'gear', block: true, onClick: go('drills.depth.options') }),
        button('Count Drills', { large: true, icon: 'gear', block: true, onClick: go('drills.count.options') }),
        button('Full Table Drills', { large: true, icon: 'gear', block: true, onClick: go('drills.full.options') }),
      ),
      button('Settings', { large: true, icon: 'arrow-r', block: true, onClick: go('settings'), 'data-action': 'settings' }),
      h('div', { class: 'grid-2' },
        button('Reset Defaults', { icon: 'back', onClick: () => resetDefaults(app) }),
        button('Screen Info', { icon: 'info', onClick: () => screenInfo() }),
      ),
    ),
    h('div', { class: 'footer-note' }, `Blackjack Verité ${APP_VERSION} · Copyright 2025 QFIT, all rights reserved`),
  );
  return { el };
}

async function resetDefaults(app) {
  if (!(await confirm('Are you sure that you want to reset all options to their defaults?'))) return;
  app.settings.reset();
  await alert('Done.');
}

function screenInfo() {
  const info = [
    `Window: ${innerWidth} x ${innerHeight}`,
    `Screen: ${screen.width} x ${screen.height}`,
    `Pixel ratio: ${devicePixelRatio}`,
    navigator.userAgent,
  ];
  return alert(`If you are having screen related problems, e-mail your device model and the following info to support@qfit.com:\n${info.join('\n')}`);
}
