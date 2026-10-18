// Game Options: the settings that apply only to the game, and the button that
// starts it. The playing and betting strategies, true count and appearance are
// global (Settings on the home screen).

import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import { useApp } from '@/react/app-context';
import { openTable } from '@/game/launch';
import { PATHS } from '@/app/paths';
import { PresetPicker } from '@/components/settings/preset-picker';
import { GAME_SETS } from '@/settings/setting-sets';
import type { ScreenName } from '@/app/paths';

const SECTIONS: readonly (readonly [string, readonly (readonly [string, ScreenName])[]])[] = [
  [
    'Strategy',
    [
      ['Playing Strategy', 'game.strategy'],
      ['Betting Strategy', 'game.betting'],
      ['True Count Conversion', 'game.trueCount'],
    ],
  ],
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
  ['Peeking and Warnings', [['Peeking', 'game.peeking']]],
  ['Table', [['Speed/Mechanics', 'game.mechanics']]],
];

export function GameOptions() {
  const app = useApp();
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Blackjack" help="game.options">
      <Column className="gap-6 pt-1">
        <PresetPicker kind={GAME_SETS.kind} store={app.gameConfigs} />
        {SECTIONS.map(([title, screens]) => (
          <Section key={title} title={title}>
            <SettingsGroup>
              {screens.map(([label, screen]) => (
                <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                  {label}
                </ListRow>
              ))}
              {title === 'Peeking and Warnings' && (
                <SettingChecks items={[{ label: 'Warning on Strategy Error', key: 'game.strategy.warnOnError' }]} />
              )}
            </SettingsGroup>
          </Section>
        ))}
        <Button
          variant="primary"
          icon="play"
          large
          block
          onClick={() => openTable(app, () => navigate(PATHS['game.table']))}
          data-action="play"
        >
          Play
        </Button>
      </Column>
    </ScreenLayout>
  );
}
