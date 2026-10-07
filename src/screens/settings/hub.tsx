// The settings hub: navigation to every option screen.

import { ScreenLayout } from '@/components/screen-layout';
import { ListRow, Section, SettingsCols, SettingsGroup } from '@/components/ui/settings-group';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

const NOTE = 'The playing strategy and true count settings are also used by the drills.';

const SECTIONS: readonly (readonly [string, readonly (readonly [string, ScreenName])[]])[] = [
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
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Options" help="settings">
      <SettingsCols className="gap-6 pt-1">
        {SECTIONS.map(([title, screens], i) => (
          <Section key={title} title={title} footer={i === 1 ? NOTE : undefined}>
            <SettingsGroup>
              {screens.map(([label, screen]) => (
                <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                  {label}
                </ListRow>
              ))}
            </SettingsGroup>
          </Section>
        ))}
      </SettingsCols>
    </ScreenLayout>
  );
}
