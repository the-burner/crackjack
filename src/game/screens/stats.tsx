// The statistics screen: the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { useReducer } from 'react';
import { money } from '@/core/money';
import { useSettings } from '@/react/app-context';
import { Button, StandardScreen } from '@/react/components';
import { reactScreen, useOnShow } from '@/react/screen';
import { SettingChecks } from '@/react/settings-form';
import type { SettingReader } from '@/settings/schema';
import { confirm } from '@/ui/dialogs';
import type { GameSession } from '@/game/session';

/** The in-table readouts, in display order. */
const DISPLAY_OPTIONS = [
  { key: 'display.showBetAccuracy', label: 'Display Bet Accuracy' },
  { key: 'display.showPlayAccuracy', label: 'Display Play Accuracy' },
  { key: 'display.showRunningCount', label: 'Display Running Count' },
  { key: 'display.showTrueCount', label: 'Display True Count' },
] as const;

type StatRow = { label: string; value: string | number; head?: boolean };

/** A section heading row, shown across both columns. */
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
  const settings = useSettings();
  // The session changes while the table covers this screen.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useOnShow(refresh);

  async function resetStats() {
    if (!(await confirm('Are you sure that you want to reset the statistics?'))) return;
    session?.resetStats();
    refresh();
  }

  return (
    <StandardScreen title="Statistics" help="game.stats">
      <div className="column column--wide">
        <table className="stats-table">
          <tbody>
            {statRows(session, key => settings.get(key)).map(({ label, value, head }, i) => (
              <tr key={i} className={head ? 'stats-table__head' : undefined}>
                <th>{label}</th>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button block icon="refresh" onClick={resetStats} data-action="reset-stats">
          Reset Stats
        </Button>
        <SettingChecks items={DISPLAY_OPTIONS} />
      </div>
    </StandardScreen>
  );
}

export const gameStatsScreen = reactScreen(GameStats, { className: 'game-stats' });

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
