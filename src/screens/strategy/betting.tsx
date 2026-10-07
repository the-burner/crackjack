// Allowed Bets: the table of bets the player
// may make, optionally tied to the count so betting errors can be flagged.

import { useState } from 'react';
import { useOnShow } from '@/react/screen';
import { useApp, useSettings } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScreenLayout } from '@/components/screen-layout';
import { OptionSelect, SettingsGroup } from '@/components/settings-controls';
import { NumberRow, SwitchRow } from '@/components/settings/controls';
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
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Enter the number of different bets in the table and then click on a table cell to enter a new bet.
        </p>
        <SettingsGroup>
          <SwitchRow
            label="Warning on Betting Error"
            checked={showCounts}
            onCheckedChange={on => settings.set('betting.warnOnError', on)}
          />
          <OptionSelect
            label="Chip Value"
            options={CHIP_OPTIONS}
            value={settings.get('betting.chipValue')}
            onChange={value => settings.set('betting.chipValue', value)}
          />
          <NumberRow
            label="Number of bets"
            value={ramp.rows.length}
            onChange={count => settings.set('betting.ramp', setRowCount(ramp, count))}
            prompt="Number of different bets in table"
            min={MIN_ROWS}
            max={MAX_ROWS}
          />
          <NumberRow
            label="Minimum bet count"
            value={ramp.minCount}
            onChange={minCount => settings.set('betting.ramp', normalizeRamp({ ...ramp, minCount }))}
            prompt="Start Count"
            min={-99}
            max={99}
            hidden={!showCounts}
          />
        </SettingsGroup>
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table aria-label="Bets" className="text-base tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%] text-center">Count</TableHead>
                <TableHead className="text-center">Hands x Chips</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ramp.rows.map((row, i) => (
                <TableRow
                  key={i}
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
                  <TableCell className="text-center">{counts[i]}</TableCell>
                  <TableCell className="text-center">{formatRow(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
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
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          In the bottom table, click on the number of chips to bet. If you wish to play more than one spot, click on the
          number of spots at the top first. You can also enter a custom bet at the bottom.
        </p>
        <ToggleGroup
          variant="outline"
          aria-label="Spots"
          className="grid w-full grid-cols-6 gap-1.5"
          value={[String(hands)]}
          onValueChange={(value: string[]) => {
            // Tapping the chosen number again keeps it.
            if (value.length) setHands(Number(value[0]));
          }}
        >
          {HAND_CHOICES.map(n => (
            <ToggleGroupItem
              key={n}
              value={String(n)}
              className="h-11 aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
            >
              {n === 1 ? '1' : `${n}x`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Chips">
          {CHIP_CHOICES.map(n => (
            <Button
              key={n}
              variant="outline"
              className="h-11 tabular-nums"
              disabled={n > maxChipsForHands(hands)}
              onClick={() => choose(n)}
            >
              {String(n)}
            </Button>
          ))}
        </div>
        <Button variant="secondary" className="w-full" onClick={() => customBet()} data-action="custom-bet">
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
