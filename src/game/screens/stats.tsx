// The statistics screen: the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { useReducer } from 'react';
import { useStore } from 'zustand';
import { RefreshCwIcon } from 'lucide-react';
import { money } from '@/core/money';
import { useApp, useSettings } from '@/react/app-context';
import { reactScreen, useOnShow } from '@/react/screen';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@/components/ui/table';
import { ScreenLayout, Section } from '@/components/screen-layout';
import { SettingSwitches } from '@/components/settings-controls';
import { confirm } from '@/components/dialogs';
import type { SettingReader } from '@/settings/schema';
import type { GameSession } from '@/game/session';

/** The in-table readouts, in display order. */
const DISPLAY_OPTIONS = [
  { key: 'display.showBetAccuracy', label: 'Display Bet Accuracy' },
  { key: 'display.showPlayAccuracy', label: 'Display Play Accuracy' },
  { key: 'display.showRunningCount', label: 'Display Running Count' },
  { key: 'display.showTrueCount', label: 'Display True Count' },
] as const;

type StatRow = { label: string; value?: string | number; head?: boolean };

/** A section heading row, across both columns. */
const section = (name: string): StatRow => ({ label: name, head: true });
const row = (label: string, value: string | number): StatRow => ({ label, value });

/** The table's rows for `session`, or a placeholder without one. */
function statRows(session: GameSession | undefined, get: SettingReader): StatRow[] {
  if (!session) return [section('Counts'), row('No session', '-')];
  const { stats } = session;
  const counts = session.counts;
  const accuracy = session.accuracy();
  const average = (total: number, n: number) => (n > 0 ? Math.round(total / n) : 0);
  const out = [
    section('Counts'),
    row('Remaining Decks', round2(counts.decksRemaining)),
    row('Running Count', round1(counts.runningCount)),
    row('True Count', round1(counts.trueCount)),
  ];
  if (get('trueCount.aceSideCount')) out.push(row('Bet Count', round1(counts.betCount)));
  if (get('trueCount.tenSideCount')) out.push(row('Ten Count', counts.tens));
  out.push(
    section('Bankroll'),
    row('Rounds Played', stats.rounds),
    row('Total Initial Bets', money(stats.totalBet)),
    row('Low Bet', money(stats.lowBet)),
    row('Top Bet', money(stats.highBet)),
    row('Average Bet', money(average(stats.totalBet, stats.rounds))),
    row('Bankroll', money(session.bankroll)),
    row('Bankroll Low', money(stats.lowBankroll)),
    row('Bankroll High', money(stats.highBankroll)),
    row('Bankroll Average', money(average(stats.bankrollSum, stats.rounds))),
    section('Errors'),
    row('Play Correct', `${accuracy.play}%`),
    row('Bet Correct', `${accuracy.bet}%`),
    row('Play Errors', stats.playErrors),
    row('Bet Errors', stats.betErrors),
    row('Dealer Error Correct', `${accuracy.foul}%`),
    row('Dealer Errors Missed', stats.foulErrors),
  );
  return out;
}

export function GameStats({ params: { session } }: { params: { session?: GameSession } }) {
  const app = useApp();
  const settings = useSettings();
  // Re-rendered whenever the session saves its figures; the counts are read when shown.
  useStore(app.gameStats, state => state.value);
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useOnShow(refresh);

  async function resetStats() {
    if (!(await confirm('Are you sure that you want to reset the statistics?'))) return;
    session?.resetStats();
    refresh();
  }

  return (
    <ScreenLayout title="Statistics" help="game.stats">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableBody>
              {statRows(session, key => settings.get(key)).map(({ label, value, head }, i) =>
                head ? (
                  <TableRow key={i} className="bg-muted hover:bg-muted">
                    <TableHead colSpan={2} scope="colgroup" className="font-semibold text-foreground">
                      {label}
                    </TableHead>
                  </TableRow>
                ) : (
                  <TableRow key={i}>
                    <TableHead scope="row" className="font-normal text-foreground">
                      {label}
                    </TableHead>
                    <TableCell className="text-right tabular-nums">{String(value)}</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
        <Button variant="secondary" size="lg" onClick={resetStats} data-action="reset-stats">
          <RefreshCwIcon data-icon="inline-start" />
          Reset Stats
        </Button>
        <Section title="Display">
          <SettingSwitches items={DISPLAY_OPTIONS} />
        </Section>
      </div>
    </ScreenLayout>
  );
}

export const gameStatsScreen = reactScreen(GameStats);

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
