// Game Options: the settings that apply only to the game, and the button that
// starts it. The playing strategy, true count and appearance are global
// (Settings on the home screen).

import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import { useApp } from '@/react/app-context';
import { openTable } from '@/game/launch';
import { PATHS } from '@/app/paths';
import type { ScreenName } from '@/app/paths';

const SECTIONS: readonly (readonly [string, readonly (readonly [string, ScreenName])[]])[] = [
  [
    'Table and Rules',
    [
      ['Basic Setup', 'game.setup'],
      ['Common Rules', 'game.commonRules'],
      ['Rule Variations', 'game.ruleVariations'],
      ['Bonuses', 'game.bonuses'],
      ['Play Variations', 'game.playVariations'],
      ['Unusual Games', 'game.unusualGames'],
      ['Dealer Errs/Biases', 'game.dealerErrors'],
    ],
  ],
  [
    'Betting and Peeking',
    [
      ['Betting Strategies', 'game.betting'],
      ['Peeking', 'game.peeking'],
    ],
  ],
  ['Table', [['Speed/Mechanics', 'game.mechanics']]],
];

export function GameOptions() {
  const app = useApp();
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Game Options" help="game.options">
      <Column className="gap-6 pt-1">
        {SECTIONS.map(([title, screens]) => (
          <Section key={title} title={title}>
            <SettingsGroup>
              {screens.map(([label, screen]) => (
                <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                  {label}
                </ListRow>
              ))}
              {title === 'Betting and Peeking' && (
                <SettingChecks items={[{ label: 'Warning on Strategy Error', key: 'strategy.warnOnError' }]} />
              )}
            </SettingsGroup>
          </Section>
        ))}
        <Button
          variant="primary"
          icon="arrow-r"
          large
          block
          onClick={() => openTable(app, () => navigate(PATHS['game.table']))}
          data-action="play"
        >
          Play Blackjack
        </Button>
      </Column>
    </ScreenLayout>
  );
}
