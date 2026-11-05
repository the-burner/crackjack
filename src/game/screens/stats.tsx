// The statistics screen: the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { useReducer } from 'react';
import { useStore } from 'zustand';
import { money } from '@/core/money';
import { clockTime } from '@/drills/shared/format';
import { useApp, useSettings } from '@/react/app-context';
import { useOnShow } from '@/react/screen';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { StatTiles } from '@/components/ui/stat-tiles';
import type { Stat } from '@/components/ui/stat-tiles';
import { Note } from '@/components/ui/text';
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
  { key: 'display.showSessionClock', label: 'Display Session Clock' },
] as const;

type StatSection = { title: string; rows: Stat[]; columnRows?: number };

const row = (label: string, value: string | number, strong = false): Stat => ({ label, value: String(value), strong });

const REMAINING_LABELS = { dealt: 'Dealt', shown: 'Shown', inTray: 'In Tray' } as const;

/** The screen's sections for `session`. */
function statSections(session: GameSession, get: SettingReader): StatSection[] {
  const { stats, pace } = session;
  const counts = session.counts;
  const accuracy = session.accuracy();
  const average = (total: number, n: number) => (n > 0 ? Math.round(total / n) : 0);
  const countRows = [
    row('Running Count', round1(counts.runningCount)),
    row('Decks Left', round2(counts.decksRemaining)),
    row('True Count', round1(counts.trueCount)),
  ];
  if (get('game.trueCount.aceSideCount')) countRows.push(row('Bet Count', round1(counts.betCount)));
  if (get('game.trueCount.tenSideCount')) countRows.push(row('Ten Count', counts.tens));
  const advanced = session.advancedCounts();
  return [
    { title: 'Counts', rows: countRows },
    {
      title: 'Exact Count',
      rows: [
        row('Running Count', round2(counts.runningCount)),
        row('Decks Left', advanced.exactDecks.toFixed(2)),
        row('True Count', advanced.exactTrueCount.toFixed(2)),
      ],
    },
    {
      title: 'Cards Remaining',
      rows: (['dealt', 'shown', 'inTray'] as const).map(choice =>
        row(REMAINING_LABELS[choice], advanced.cardsLeft[choice], choice === advanced.inUse),
      ),
    },
    {
      title: 'Bankroll',
      // Columns: rounds, bets, bankroll.
      rows: [
        row('Rounds Played', stats.rounds),
        row('Time Played', clockTime(pace.seconds())),
        row('Rounds/Hour', pace.perHour()),
        row('Time/Round', pace.rounds > 0 ? clockTime(pace.seconds() / pace.rounds) : '-'),
        row('Total Bets', money(stats.totalBet)),
        row('Average Bet', money(average(stats.totalBet, stats.rounds))),
        row('Low Bet', money(stats.lowBet)),
        row('Top Bet', money(stats.highBet)),
        row('Bankroll', money(session.bankroll)),
        row('Avg Bankroll', money(average(stats.bankrollSum, stats.rounds))),
        row('Low Bankroll', money(stats.lowBankroll)),
        row('High Bankroll', money(stats.highBankroll)),
      ],
      columnRows: 4,
    },
    {
      title: 'Errors',
      // Columns: plays, bets, dealer errors.
      rows: [
        row('Play Correct', `${accuracy.play}%`),
        row('Play Errors', stats.playErrors),
        row('Bet Correct', `${accuracy.bet}%`),
        row('Bet Errors', stats.betErrors),
        row('Dealer Correct', `${accuracy.foul}%`),
        row('Dealer Missed', stats.foulErrors),
      ],
      columnRows: 2,
    },
  ];
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
      <Column>
        {session ? (
          statSections(session, key => settings.get(key)).map(({ title, rows, columnRows }) => (
            <Section key={title} title={title}>
              <StatTiles stats={rows} rows={columnRows} />
            </Section>
          ))
        ) : (
          <Note>No session.</Note>
        )}
        <Section title="Display">
          <SettingsGroup>
            <SettingChecks items={DISPLAY_OPTIONS} />
          </SettingsGroup>
        </Section>
        <SettingsGroup>
          <ListRow chevron={false} block onClick={resetStats}>
            Reset Stats
          </ListRow>
        </SettingsGroup>
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
