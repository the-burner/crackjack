// The statistics screen (the original's frmStats): the counts, the bankroll and
// bet history, how accurate the player has been, and the switches that control
// what the table itself shows.

import { h, replaceChildren } from '../../ui/dom.js';
import { button, checkList } from '../../ui/components.js';
import { standardScreen } from '../../ui/screen.js';
import { confirm } from '../../ui/dialogs.js';

/** The in-table readouts, in the order the original listed them. */
const DISPLAY_OPTIONS = [
  ['display.showBetAccuracy', 'Display Bet Accuracy'],
  ['display.showPlayAccuracy', 'Display Play Accuracy'],
  ['display.showRunningCount', 'Display Running Count'],
  ['display.showTrueCount', 'Display True Count'],
];

/**
 * @param {object} app
 * @param {object} params
 * @param {import('../session.js').GameSession} params.session
 */
export function gameStatsScreen(app, { session } = {}) {
  const { settings } = app;
  const { el, body } = standardScreen(app, { title: 'Statistics', help: 'game.stats', className: 'game-stats' });
  const table = h('table', { class: 'stats-table' });

  const checks = checkList(DISPLAY_OPTIONS.map(([key, label]) => ({
    label,
    checked: settings.get(key),
    onChange: on => settings.set(key, on),
  })));

  /** A section heading row, shown across both columns as the original was. */
  const section = name => ({ label: name, value: name, head: true });
  const row = (label, value) => ({ label, value });

  function rows() {
    if (!session) return [section('Counts'), row('No session', '-')];
    const { stats } = session;
    const counts = session.counts;
    const accuracy = session.accuracy();
    const average = (total, n) => (n > 0 ? Math.round(total / n) : 0);
    const out = [
      section('Counts'),
      row('Remaining Decks', round2(counts.decksRemaining)),
      row('Running Count', round1(counts.runningCount)),
      row('True Count', round1(counts.trueCount)),
    ];
    if (settings.get('trueCount.aceSideCount')) out.push(row('Bet Count', round1(counts.betCount)));
    if (settings.get('trueCount.tenSideCount')) out.push(row('Ten Count', counts.tens));
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
    );
    return out;
  }

  function render() {
    replaceChildren(table, h('tbody', {}, rows().map(({ label, value, head }) => h(
      'tr',
      { class: head ? 'stats-table__head' : null },
      h('th', {}, label),
      h('td', {}, String(value)),
    ))));
  }

  async function resetStats() {
    if (!(await confirm('Are you sure that you want to reset the statistics?'))) return;
    session?.resetStats();
    render();
  }

  body.append(h('div', { class: 'column column--wide' },
    table,
    button('Reset Stats', { block: true, icon: 'refresh', onClick: resetStats, 'data-action': 'reset-stats' }),
    checks));

  render();
  return { el, onShow: render };
}

const round1 = n => Math.round(n * 10) / 10;
const round2 = n => Math.round(n * 100) / 100;
const money = amount => `$${Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2)}`;
