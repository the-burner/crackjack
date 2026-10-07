// The settings hub: navigation to every option screen.

import { useApp } from '@/react/app-context';
import { reactScreen } from '@/react/screen';
import { ListButton, ScreenLayout, Section } from '@/components/screen-layout';

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
    <ScreenLayout title="Options" help="settings">
      <div className="mx-auto grid max-w-4xl items-start gap-4 md:grid-cols-2">
        {SECTIONS.map(([title, screens], i) => (
          <div key={title} className="space-y-2">
            <Section title={title}>
              {screens.map(([label, screen]) => (
                <ListButton key={screen} onClick={() => app.open(screen)}>
                  {label}
                </ListButton>
              ))}
            </Section>
            {i === 1 && <p className="px-1 text-sm text-muted-foreground">{NOTE}</p>}
          </div>
        ))}
      </div>
    </ScreenLayout>
  );
}

export const settingsHubScreen = reactScreen(SettingsHub);
