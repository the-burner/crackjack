// Unusual Games: the side-bet / bonus game selector.

import { useSettings } from '@/react/app-context';
import { SettingsScreen } from '@/components/settings-controls';
import { Select } from '@/components/ui/select';
import { SettingsGroup } from '@/components/ui/settings-group';
import { BUILTIN_SIDE_BET_GAMES } from '@/data/side-bet-games';
import { applyGameChange } from '@/settings/rules-logic';

const NOTE = 'You can select one of numerous unusual games above.';

const GAMES = BUILTIN_SIDE_BET_GAMES.map(({ id, name }) => ({ value: id, label: name }));

export function UnusualGames() {
  const settings = useSettings();
  return (
    <SettingsScreen title="Unusual Games" help="settings.unusualGames">
      <SettingsGroup>
        <Select
          name="bonuses.game"
          aria-label="Game"
          options={GAMES}
          value={settings.get('bonuses.game')}
          onChange={gameId => settings.update(applyGameChange(key => settings.get(key), gameId))}
        />
        {/* The explanation, in a scrolling box. */}
        <div className="max-h-[46vh] overflow-y-auto px-3.5 py-0.5 text-caption leading-[1.45] text-(--text-secondary) [&_p]:my-[1em]">
          <p>{NOTE}</p>
        </div>
      </SettingsGroup>
    </SettingsScreen>
  );
}
