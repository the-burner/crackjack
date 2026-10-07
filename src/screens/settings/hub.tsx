// The settings hub: navigation to every option screen.

import { useApp } from '../../react/app-context.ts';
import { Button, StandardScreen } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';

const NOTE = 'The playing strategy and true count settings are also used by the drills.';

const SECTIONS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = [
  [
    'Table and Rules',
    [
      ['Basic Setup', 'settings.setup'],
      ['Common Rules', 'settings.commonRules'],
      ['Rule Variations', 'settings.ruleVariations'],
      ['Bonuses', 'settings.bonuses'],
      ['Play Variations', 'settings.playVariations'],
      ['Unusual Games', 'settings.unusualGames'],
      ['Dealer Errs/Biases', 'settings.dealerErrors'],
    ],
  ],
  [
    'Strategy',
    [
      ['Playing Strategies', 'settings.strategy'],
      ['Betting Strategies', 'settings.betting'],
      ['True Count Calcs', 'settings.trueCount'],
      ['Peeking', 'settings.peeking'],
    ],
  ],
  [
    'App',
    [
      ['Speed/Mechanics', 'settings.mechanics'],
      ['Appearance & Customization', 'settings.appearance'],
    ],
  ],
];

export function SettingsHub() {
  const app = useApp();
  return (
    <StandardScreen title="Options" help="settings">
      <div className="settings-cols settings-hub">
        {SECTIONS.map(([title, screens], i) => (
          <div key={title} className="section">
            <h2 className="section__title">{title}</h2>
            <div className="settings-group">
              {screens.map(([label, screen]) => (
                <Button key={screen} icon="arrow-r" block className="list-row" onClick={() => app.open(screen)}>
                  {label}
                </Button>
              ))}
            </div>
            {i === 1 && <p className="section__footer">{NOTE}</p>}
          </div>
        ))}
      </div>
    </StandardScreen>
  );
}

export const settingsHubScreen = reactScreen(SettingsHub, { className: 'settings' });
