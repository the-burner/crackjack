// Bugs found at the table, checked against the table's pure parts.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import type { SettingsPatch } from '@/settings/schema';
import { seededRandom } from '@/core/random';
import { planSteps } from '@/game/table/choreography';
import { createTableState } from '@/game/table/table-state';
import { createShownCount } from '@/game/table/shown-count';
import { createSideBetPicker, sideBetLabel } from '@/game/table/side-bet-picker';
import type { SideBets } from '@/game/table/side-bet-picker';
import type { GameEvent } from '@/game/engine/events';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeSession(settings: SettingsPatch = {}, seed = 7) {
  vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
  const app = createServices({ backend: new MemoryBackend() });
  app.sound = { play() {} } as unknown as typeof app.sound;
  app.settings.update({
    'table.seatCount': 4,
    'table.computerSeats': [false, false, true, true, true, true],
    'betting.warnOnError': false,
    'strategy.warnOnError': false,
    'rules.surrender': 'none',
    ...settings,
  });
  return new GameSession(app);
}

/** A session whose events are replayed as the table does, with the readout's count. */
function table(settings: SettingsPatch) {
  const session = makeSession(settings);
  const state = createTableState({ decks: session.table.decks });
  const shown = createShownCount({
    strategy: session.strategy,
    settings: session.trueCountSettings(),
    decks: session.table.decks,
  });
  const show = (events: GameEvent[]) => {
    for (const { event } of planSteps(events, { pauses: { dealer: 0, player: 0, payoff: 0 } })) {
      state.apply(event);
      shown.see(event, state.dealt);
    }
  };
  show(session.game.takeEvents());
  /** Plays a round out standing, then deals the table back to betting. */
  const playRound = () => {
    show(session.startRound({ betPerHand: 5 }));
    while (session.state === 'insurance') show(session.declineInsurance());
    while (session.state === 'playerAction') show(session.act('stand'));
    show(session.nextRound());
  };
  return { session, shown, playRound };
}

describe('the count the table shows', () => {
  it('matches the real count when the dealer hole card flashes', () => {
    const { session, shown, playRound } = table({ 'peeking.mode': 'holeCard', 'peeking.percent': 100 });
    for (let round = 0; round < 4; round++) {
      playRound();
      expect(shown.running, `round ${round}`).toBe(session.counts.runningCount);
    }
  });

  it('matches the real count in a face-down game', () => {
    const { session, shown, playRound } = table({ 'table.cardsFaceDown': true });
    for (let round = 0; round < 4; round++) {
      playRound();
      expect(shown.running, `round ${round}`).toBe(session.counts.runningCount);
    }
  });
});

describe('a game with two side-bet spots', () => {
  it('asks for each spot in turn and records both', () => {
    const session = makeSession({ 'bonuses.game': 11 });
    const opened: [number, boolean][] = [];
    let sideBets: SideBets = {};
    const picker = createSideBetPicker({
      open: (index, replace) => opened.push([index, replace]),
      chipValue: () => 5,
      onChange: picked => (sideBets = picked),
    });
    const oneChip = { chips: 1, hands: 1, amount: 5 };
    picker.choose(session.sideBetSpots());
    expect(picker.paramsFor(0)?.title).toBe('U side bet');
    // The second spot is asked for next, not the first one again.
    expect(picker.paramsFor(0)?.onPick?.(oneChip)).toBe(true);
    expect(opened).toEqual([
      [0, false],
      [1, true],
    ]);
    expect(picker.paramsFor(1)?.title).toBe('O side bet');
    expect(picker.paramsFor(1)?.onPick?.(oneChip)).toBe(false);
    expect(sideBetLabel(sideBets)).toBe('U side bet $5, O side bet $5');
  });
});
