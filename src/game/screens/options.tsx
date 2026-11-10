// Blackjack's options: its configuration, the table, the player's strategies and bankroll,
// practice aids and display, and the button that starts it.

import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import type { SettingCheck } from '@/components/settings-controls';
import { useApp } from '@/react/app-context';
import { openTable } from '@/game/launch';
import { PATHS } from '@/app/paths';
import { PresetPicker } from '@/components/settings/preset-picker';
import { GAME_SETS } from '@/settings/setting-sets';
import type { ScreenName } from '@/app/paths';

/** Each section: its screens, then (Practice Aids) its switches. */
type OptionsSection = readonly [
  title: string,
  screens: readonly (readonly [string, ScreenName])[],
  checks?: readonly SettingCheck[],
];
const SECTIONS: readonly OptionsSection[] = [
  ['Table', [['Table Rules and Conditions', 'game.tableRules']]],
  [
    'Player',
    [
      ['Playing Strategy', 'game.strategy'],
      ['Betting Strategy', 'game.betting'],
      ['True Count Conversion', 'game.trueCount'],
      ['Bankroll', 'game.bankroll'],
    ],
  ],
  [
    'Practice Aids',
    [
      ['Peeking', 'game.peeking'],
      ['Dealer Errors and Biases', 'game.dealerErrors'],
    ],
    [
      { label: 'Warning on Strategy Error', key: 'game.strategy.warnOnError' },
      { label: 'Dealer makes obvious plays', key: 'mechanics.dealerMakesObviousPlays' },
      { label: 'Dealer points out stupid plays', key: 'mechanics.dealerPointsOutStupidPlays' },
    ],
  ],
  ['Display', [['Display and Speed', 'game.display']]],
];

export function GameOptions() {
  const app = useApp();
  const navigate = useNavigate();
  return (
    <ScreenLayout title="Blackjack" help="game.options">
      <Column className="gap-6 pt-1">
        <PresetPicker kind={GAME_SETS.kind} store={app.gameConfigs} />
        {SECTIONS.map(([title, screens, checks]) => (
          <Section key={title} title={title}>
            <SettingsGroup>
              {screens.map(([label, screen]) => (
                <ListRow key={screen} block onClick={() => navigate(PATHS[screen])}>
                  {label}
                </ListRow>
              ))}
              {checks && <SettingChecks items={checks} />}
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
