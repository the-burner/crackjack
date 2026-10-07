// The statistics screen: the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { useReducer } from 'react';
import { useStore } from 'zustand';
import { money } from '@/core/money';
import { useApp, useSettings } from '@/react/app-context';
import { useOnShow } from '@/react/screen';
import { Button } from '@/components/ui/button';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingChecks } from '@/components/settings-controls';
import { confirm } from '@/components/dialogs';
import type { SettingReader } from '@/settings/schema';
import type { GameSession } from '@/game/session';
import { useTableContext } from '@/game/screens/table-screen';

/** The in-table readouts, in display order. */
const DISPLAY_OPTIONS = [
  { key: 'display.showBetAccuracy', label: 'Display Bet Accuracy' },
  { key: 'display.showPlayAccuracy', label: 'Display Play Accuracy' },
  { key: 'display.showRunningCount', label: 'Display Running Count' },
  { key: 'display.showTrueCount', label: 'Display True Count' },
] as const;

type StatRow = { label: string; value: string | number; head?: boolean };

/** A section heading row: the name in both columns. */
const section = (name: string): StatRow => ({ label: name, value: name, head: true });
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

  const cell = 'border border-(--panel-border) px-2 py-[5px] text-center text-body font-normal text-(--panel-text)';
  return (
    <ScreenLayout title="Statistics" help="game.stats">
      <Column wide className="gap-2.5">
        <table className="w-full border-collapse bg-(--panel-bg)">
          <tbody>
            {statRows(session, key => settings.get(key)).map(({ label, value, head }, i) => (
              // A section row is a heading across the table; its name shows in both columns.
              <tr key={i} className={head ? '*:bg-(--panel-head-bg) *:font-semibold' : undefined}>
                <th scope={head ? 'colgroup' : 'row'} className={cell}>
                  {label}
                </th>
                {head ? <th className={cell}>{String(value)}</th> : <td className={cell}>{String(value)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <Button block icon="refresh" onClick={resetStats} data-action="reset-stats">
          Reset Stats
        </Button>
        <SettingChecks items={DISPLAY_OPTIONS} />
      </Column>
    </ScreenLayout>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stats over the table, for its session. */
export function GameStatsRoute() {
  const { session } = useTableContext();
  return <GameStats params={{ session }} />;
}
