// Home screen: the four drills, the game and the settings.

import { useApp } from '../react/app-context.ts';
import { Button, StandardScreen } from '../react/components.tsx';
import { reactScreen } from '../react/screen.tsx';
import type { App } from '../app/app.ts';
import { confirm, alert } from '../ui/dialogs.ts';
import { toast } from '../ui/toast.ts';
import { openTable } from '../game/launch.ts';
import { WORDMARK_SVG } from '../ui/wordmark.ts';

export const APP_VERSION = '3.0.0';

const DRILLS = [
  ['Flash Drills', 'Strategy and index plays', 'drills.flash.options'],
  ['Depth Drills', 'Estimate decks played', 'drills.depth.options'],
  ['Count Drills', 'Running and true count', 'drills.count.options'],
  ['Full Table Drills', 'Count a whole table', 'drills.full.options'],
] as const;

function Home() {
  const app = useApp();
  return (
    <StandardScreen title="" help="home" back={false}>
      <div className="column home">
        <h1 className="home__name" dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }} />
        <Button variant="primary" large icon="arrow-r" block onClick={() => openTable(app)} data-action="play">
          Play Blackjack
        </Button>
        <div className="section">
          <h2 className="section__title">Drills</h2>
          <div className="home__drills">
            {DRILLS.map(([name, detail, screen]) => (
              <button key={screen} type="button" className="home__drill" onClick={() => app.open(screen)}>
                <span className="home__drill-name">{name}</span>
                <span className="home__drill-detail">{detail}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-group">
          <Button icon="arrow-r" block className="list-row" onClick={() => app.open('settings')} data-action="settings">
            Settings
          </Button>
          <Button block className="list-row" onClick={() => resetDefaults(app)}>
            Reset Defaults
          </Button>
          <Button block className="list-row" onClick={() => screenInfo()}>
            Screen Info
          </Button>
        </div>
      </div>
      <div className="footer-note">{`Crackjack ${APP_VERSION} · Copyright 2025 Crackjack, all rights reserved`}</div>
    </StandardScreen>
  );
}

async function resetDefaults(app: App) {
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

export const homeScreen = reactScreen(Home);
