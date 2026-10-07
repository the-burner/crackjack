// Allowed Bets: the table of bets the player
// may make, optionally tied to the count so betting errors can be flagged.

import { useState } from 'react';
import { reactScreen, useOnShow } from '@/react/screen';
import type { ScreenProps } from '@/react/screen';
import { useApp, useSettings } from '@/react/app-context';
import { Button, CheckList, Select, StandardScreen, ValueButton } from '@/react/components';
import { SettingsGroup } from '@/react/settings-form';
import { promptNumber } from '@/ui/dialogs';
import {
  CHIP_CHOICES,
  HAND_CHOICES,
  MIN_ROWS,
  MAX_ROWS,
  countLabels,
  formatRow,
  maxChipsForHands,
  normalizeRamp,
  rampToSave,
  setRow,
  setRowCount,
} from '@/settings/bet-ramp';

const CHIP_OPTIONS = ([1, 5, 10, 25, 100, 500, 1000] as const).map(value => ({ value, label: `$${value}` }));

export function Betting() {
  const app = useApp();
  const settings = useSettings();
  // A ramp saved out of range is shown tidied, so keep the tidied one.
  useOnShow(() => {
    const tidy = rampToSave(settings.get('betting.ramp'));
    if (tidy) settings.set('betting.ramp', tidy);
  });

  const ramp = normalizeRamp(settings.get('betting.ramp'));
  const showCounts = settings.get('betting.warnOnError');
  const counts = countLabels(ramp, { showCounts });

  return (
    <StandardScreen title="Allowed Bets" help="settings.betting">
      <div className="column">
        <p className="note settings-note">
          Enter the number of different bets in the table and then click on a table cell to enter a new bet.
        </p>
        <SettingsGroup>
          <CheckList
            items={[
              {
                label: 'Warning on Betting Error',
                checked: showCounts,
                onChange: on => settings.set('betting.warnOnError', on),
              },
            ]}
          />
          <div className="tc-row">
            <span className="label">Chip Value:</span>
            <Select
              label="Chip Value:"
              options={CHIP_OPTIONS}
              value={settings.get('betting.chipValue')}
              onChange={value => settings.set('betting.chipValue', value)}
            />
          </div>
          <div className="tc-row">
            <span className="label">Number of bets:</span>
            <ValueButton
              value={ramp.rows.length}
              onChange={count => settings.set('betting.ramp', setRowCount(ramp, count))}
              prompt="Number of different bets in table"
              min={MIN_ROWS}
              max={MAX_ROWS}
            />
          </div>
          <div className="tc-row" hidden={!showCounts}>
            <span className="label">Minimum bet count:</span>
            <ValueButton
              value={ramp.minCount}
              onChange={minCount => settings.set('betting.ramp', normalizeRamp({ ...ramp, minCount }))}
              prompt="Start Count"
              min={-99}
              max={99}
            />
          </div>
        </SettingsGroup>
        <div>
          <table className="strategy-grid bet-table">
            <thead>
              <tr>
                <th>Count</th>
                <th>Hands x Chips</th>
              </tr>
            </thead>
            <tbody>
              {ramp.rows.map((row, i) => (
                <tr key={i} data-row={i} onClick={() => app.open('settings.betting.select', { row: i })}>
                  <td>{counts[i]}</td>
                  <td>{formatRow(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StandardScreen>
  );
}

export const bettingScreen = reactScreen(Betting);

export type BetSelectParams = { row?: number };

/** Picks the number of hands and chips for one row of the bet table. */
export function BetSelect({ params: { row = 0 } }: ScreenProps<BetSelectParams>) {
  const app = useApp();
  const { settings } = app;
  const [current] = useState(() => normalizeRamp(settings.get('betting.ramp')));
  const [hands, setHands] = useState(current.rows[row]?.hands ?? 1);

  function choose(chips: number) {
    settings.set('betting.ramp', setRow(normalizeRamp(settings.get('betting.ramp')), row, { chips, hands }));
    app.back();
  }

  async function customBet() {
    const chips = await promptNumber('Enter number of chips', current.rows[row]?.chips ?? 1, {
      min: 1,
      max: maxChipsForHands(hands),
    });
    if (chips === null) return;
    choose(chips);
  }

  return (
    <StandardScreen title="Allowed Bets" help="settings.betting">
      <div className="bet-pad">
        <div className="note">
          In the bottom table, click on the number of chips to bet. If you wish to play more than one spot, click on the
          number of spots at the top first. You can also enter a custom bet at the bottom.
        </div>
        <div className="bet-pad__row" role="group" aria-label="Spots">
          {HAND_CHOICES.map(n => (
            <button
              key={n}
              type="button"
              className={n === hands ? 'tile tile--hands is-on' : 'tile tile--hands'}
              data-hands={n}
              onClick={() => setHands(n)}
            >
              {n === 1 ? '1' : `${n}x`}
            </button>
          ))}
        </div>
        <div className="bet-pad__chips" role="group" aria-label="Chips">
          {chunk(CHIP_CHOICES, HAND_CHOICES.length).map((cells, i) => (
            <div key={i} className="bet-pad__row">
              {cells.map(n => (
                <button
                  key={n}
                  type="button"
                  className="tile tile--chips"
                  data-chips={n}
                  disabled={n > maxChipsForHands(hands)}
                  onClick={() => choose(n)}
                >
                  {String(n)}
                </button>
              ))}
            </div>
          ))}
        </div>
        <Button block onClick={() => customBet()} data-action="custom-bet">
          Custom Bet
        </Button>
      </div>
    </StandardScreen>
  );
}

export const betSelectScreen = reactScreen(BetSelect);

const chunk = <T,>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
