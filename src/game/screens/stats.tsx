// The statistics screen: the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { useReducer } from 'react';
import { useStore } from 'zustand';
import { money } from '@/core/money';
import { cn } from '@/lib/utils';
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

type StatRow = { label: string; value: string | number; head?: boolean; strong?: boolean };

/** A section heading row: the name in both columns. */
const section = (name: string): StatRow => ({ label: name, value: name, head: true });
const row = (label: string, value: string | number, strong = false): StatRow => ({ label, value, strong });

const REMAINING_LABELS = { dealt: 'Dealt', shown: 'Shown', inTray: 'In Tray' } as const;

/** The counts as betting opened for the round, as the Counts rows show them ('-' before the first round). */
function roundStartRows(start: GameSession['roundStartCounts']): StatRow[] {
  return [
    row('Running Count (Round Start)', start ? round1(start.runningCount) : '-'),
    row('Remaining Decks (Round Start)', start ? round2(start.decksRemaining) : '-'),
    row('True Count (Round Start)', start ? round1(start.trueCount) : '-'),
  ];
}

/** The table's rows for `session`, or a placeholder without one. */
function statRows(session: GameSession | undefined, get: SettingReader): StatRow[] {
  if (!session) return [section('Counts'), row('No session', '-')];
  const { stats } = session;
  const counts = session.counts;
  const accuracy = session.accuracy();
  const average = (total: number, n: number) => (n > 0 ? Math.round(total / n) : 0);
  const out = [
    section('Counts'),
    row('Running Count', round1(counts.runningCount)),
    row('Remaining Decks', round2(counts.decksRemaining)),
    row('True Count', round1(counts.trueCount)),
  ];
  if (get('trueCount.aceSideCount')) out.push(row('Bet Count', round1(counts.betCount)));
  if (get('trueCount.tenSideCount')) out.push(row('Ten Count', counts.tens));
  const advanced = session.advancedCounts();
  out.push(
    section('Advanced Count'),
    ...(['dealt', 'shown', 'inTray'] as const).map(choice =>
      row(`Cards Remaining (${REMAINING_LABELS[choice]})`, advanced.cardsLeft[choice], choice === advanced.inUse),
    ),
    row('Exact Decks Remaining', advanced.exactDecks.toFixed(2)),
    row('Exact True Count', advanced.exactTrueCount.toFixed(2)),
    ...roundStartRows(session.roundStartCounts),
  );
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
            {statRows(session, key => settings.get(key)).map(({ label, value, head, strong }, i) => (
              // A section row is a heading across the table; its name shows in both columns.
              <tr key={i} className={cn(head && '*:bg-(--panel-head-bg) *:font-semibold', strong && '*:font-semibold')}>
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
