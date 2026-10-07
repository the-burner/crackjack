// Unusual Games: the side-bet / bonus game selector.

import { useSettings } from '@/react/app-context';
import { OptionSelect, SettingsGroup, SettingsScreen } from '@/components/settings-controls';
import { BUILTIN_SIDE_BET_GAMES } from '@/data/side-bet-games';
import { applyGameChange } from '@/settings/rules-logic';

const NOTE = 'You can select one of numerous unusual games above.';

const GAMES = BUILTIN_SIDE_BET_GAMES.map(({ id, name }) => ({ value: id, label: name }));

export function UnusualGames() {
  const settings = useSettings();
  return (
    <SettingsScreen title="Unusual Games" help="settings.unusualGames">
      <div className="space-y-2">
        <SettingsGroup>
          <OptionSelect
            label="Game"
            options={GAMES}
            value={settings.get('bonuses.game')}
            onChange={gameId => settings.update(applyGameChange(key => settings.get(key), gameId))}
          />
        </SettingsGroup>
        <p className="px-1 text-sm text-muted-foreground">{NOTE}</p>
      </div>
    </SettingsScreen>
  );
}
