// Allowed Bets: the table of bets the player
// may make, optionally tied to the count so betting errors can be flagged.

import { useState } from 'react';
import { useOnShow } from '@/react/screen';
import { useApp, useSettings } from '@/react/app-context';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CheckList } from '@/components/ui/check-list';
import { Grid } from '@/components/ui/grid';
import { Select } from '@/components/ui/select';
import { SettingsGroup, SettingsNote } from '@/components/ui/settings-group';
import { Label, Note } from '@/components/ui/text';
import { Tile } from '@/components/ui/tile';
import { ValueButton } from '@/components/ui/value-button';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { promptNumber } from '@/components/dialogs';
import { useNavigate, useParams } from 'react-router';
import { useGoBack } from '@/app/navigation';
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

/** A long label and a fixed-width control. */
function TcRow({ label, hidden, children }: { label: string; hidden?: boolean; children: ReactNode }) {
  return (
    <div
      hidden={hidden}
      className="flex min-h-(--control-h) items-center justify-between gap-2 px-3.5 *:not-data-[slot=label]:flex-[0_0_150px]"
    >
      <Label className="min-w-0 flex-1">{label}</Label>
      {children}
    </div>
  );
}

const chunk = <T,>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

export function Betting() {
  const navigate = useNavigate();
  const settings = useSettings();
  // A ramp saved out of range is shown tidied, so keep the tidied one.
  useOnShow(() => {
    const tidy = rampToSave(settings.get('betting.ramp'));
    if (tidy) settings.set('betting.ramp', tidy);
  });

  const ramp = normalizeRamp(settings.get('betting.ramp'));
  const showCounts = settings.get('betting.warnOnError');
  const counts = countLabels(ramp, { showCounts });
  // The row picker sits under this screen, wherever it was opened from.
  const openRow = (row: number) => navigate(String(row));

  return (
    <ScreenLayout title="Allowed Bets" help="settings.betting">
      <Column>
        <SettingsNote>
          Enter the number of different bets in the table and then click on a table cell to enter a new bet.
        </SettingsNote>
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
          <TcRow label="Chip Value:">
            <Select
              aria-label="Chip Value"
              options={CHIP_OPTIONS}
              value={settings.get('betting.chipValue')}
              onChange={value => settings.set('betting.chipValue', value)}
            />
          </TcRow>
          <TcRow label="Number of bets:">
            <ValueButton
              label="Number of bets"
              value={ramp.rows.length}
              onChange={count => settings.set('betting.ramp', setRowCount(ramp, count))}
              prompt="Number of different bets in table"
              min={MIN_ROWS}
              max={MAX_ROWS}
            />
          </TcRow>
          <TcRow label="Minimum bet count:" hidden={!showCounts}>
            <ValueButton
              label="Minimum bet count"
              value={ramp.minCount}
              onChange={minCount => settings.set('betting.ramp', normalizeRamp({ ...ramp, minCount }))}
              prompt="Start Count"
              min={-99}
              max={99}
            />
          </TcRow>
        </SettingsGroup>
        <div>
          <Grid
            aria-label="Bets"
            className="mx-auto max-w-[365px] [&_td]:h-[34px] [&_td]:bg-transparent [&_td]:text-[16px] [&_th]:text-[16px] [&_th:first-child]:w-[35%]"
          >
            <thead>
              <tr>
                <th>Count</th>
                <th>Hands x Chips</th>
              </tr>
            </thead>
            <tbody>
              {ramp.rows.map((row, i) => (
                <tr
                  key={i}
                  data-row={i}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => openRow(i)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openRow(i);
                    }
                  }}
                >
                  <td>{counts[i]}</td>
                  <td>{formatRow(row)}</td>
                </tr>
              ))}
            </tbody>
          </Grid>
        </div>
      </Column>
    </ScreenLayout>
  );
}

export type BetSelectParams = { row?: number };

/** Picks the number of hands and chips for one row of the bet table. */
export function BetSelect({ params: { row = 0 } }: { params: BetSelectParams }) {
  const app = useApp();
  const goBack = useGoBack();
  const { settings } = app;
  const [current] = useState(() => normalizeRamp(settings.get('betting.ramp')));
  const [hands, setHands] = useState(current.rows[row]?.hands ?? 1);

  function choose(chips: number) {
    settings.set('betting.ramp', setRow(normalizeRamp(settings.get('betting.ramp')), row, { chips, hands }));
    goBack();
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
    <ScreenLayout title="Allowed Bets" help="settings.betting">
      <div className="mx-auto flex max-w-[365px] flex-col gap-4">
        <Note className="my-0">
          In the bottom table, click on the number of chips to bet. If you wish to play more than one spot, click on the
          number of spots at the top first. You can also enter a custom bet at the bottom.
        </Note>
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Spots">
          {HAND_CHOICES.map(n => (
            <Tile
              key={n}
              kind="hands"
              on={n === hands}
              aria-pressed={n === hands}
              data-hands={n}
              onClick={() => setHands(n)}
            >
              {n === 1 ? '1' : `${n}x`}
            </Tile>
          ))}
        </div>
        <div className="flex flex-col gap-1.5" role="group" aria-label="Chips">
          {chunk(CHIP_CHOICES, HAND_CHOICES.length).map((cells, i) => (
            <div key={i} className="grid grid-cols-6 gap-1.5">
              {cells.map(n => (
                <Tile
                  key={n}
                  kind="chips"
                  data-chips={n}
                  disabled={n > maxChipsForHands(hands)}
                  onClick={() => choose(n)}
                >
                  {String(n)}
                </Tile>
              ))}
            </div>
          ))}
        </div>
        <Button block onClick={() => customBet()} data-action="custom-bet">
          Custom Bet
        </Button>
      </div>
    </ScreenLayout>
  );
}

/** The row picker at its route (`betting/:row`). */
export function BetSelectRoute() {
  const { row } = useParams();
  return <BetSelect params={{ row: Number(row) || 0 }} />;
}
