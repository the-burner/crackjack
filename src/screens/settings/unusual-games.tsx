// Unusual Games: the side-bet / bonus game selector.

import { useSettings } from '../../react/app-context.ts';
import { Select } from '../../react/components.tsx';
import { reactScreen } from '../../react/screen.tsx';
import { SettingsGroup, SettingsScreen } from '../../react/settings-form.tsx';
import { BUILTIN_SIDE_BET_GAMES } from '../../data/side-bet-games.ts';
import { applyGameChange } from '../../settings/rules-logic.ts';

const NOTE = 'You can select one of numerous unusual games above.';

const GAMES = BUILTIN_SIDE_BET_GAMES.map(({ id, name }) => ({ value: id, label: name }));

export function UnusualGames() {
  const settings = useSettings();
  return (
    <SettingsScreen title="Unusual Games" help="settings.unusualGames">
      <SettingsGroup>
        <Select
          name="bonuses.game"
          options={GAMES}
          value={settings.get('bonuses.game')}
          onChange={gameId => settings.update(applyGameChange(key => settings.get(key), gameId))}
        />
        <div className="settings-prose">
          <p>{NOTE}</p>
        </div>
      </SettingsGroup>
    </SettingsScreen>
  );
}

export const unusualGamesScreen = reactScreen(UnusualGames, { className: 'settings' });
