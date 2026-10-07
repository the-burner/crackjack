import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';

function makeApp(backend = new MemoryBackend()) {
  const app = createServices({ backend });
  // A silent stand-in for the Web Audio player.
  app.sound = { play() {} } as unknown as typeof app.sound;
  return app;
}

/** A round played out to settlement, so the stats are saved. */
function playRound(session: GameSession, betPerHand: number, hands = 1) {
  session.startRound({ betPerHand, hands });
  while (session.state === 'insurance') session.declineInsurance();
  while (session.state === 'playerAction') session.act('stand');
  session.nextRound();
}

describe('bet stats', () => {
  it('counts the top and low bet by the round, not by the hand', () => {
    const session = new GameSession(makeApp());
    playRound(session, 10, 2);
    expect(session.stats.totalBet).toBe(20);
    expect(session.stats.highBet).toBe(20);
    expect(session.stats.lowBet).toBe(20);
  });

  it('never averages above the top bet across rounds of different sizes', () => {
    const session = new GameSession(makeApp());
    playRound(session, 10, 2);
    playRound(session, 25, 1);
    const { totalBet, rounds, highBet, lowBet } = session.stats;
    expect(totalBet).toBe(45);
    expect(highBet).toBe(25);
    expect(lowBet).toBe(20);
    expect(totalBet / rounds).toBeLessThanOrEqual(highBet);
    expect(totalBet / rounds).toBeGreaterThanOrEqual(lowBet);
  });
});

describe('accuracy', () => {
  it('truncates bets and rounds plays', () => {
    const session = new GameSession(makeApp());
    Object.assign(session.stats, { playDecisions: 3, playErrors: 1, betDecisions: 3, betErrors: 1 });
    expect(session.accuracy()).toMatchObject({ play: 67, bet: 66 });
  });

  it('is 100% before any decision', () => {
    const session = new GameSession(makeApp());
    expect(session.accuracy()).toEqual({ play: 100, bet: 100, foul: 100 });
  });
});

describe('dealer error calls', () => {
  it('counts a caught error as a correct call', () => {
    const session = new GameSession(makeApp());
    session.recordFoulCaught();
    expect(session.stats).toMatchObject({ foulDecisions: 1, foulErrors: 0 });
    expect(session.accuracy().foul).toBe(100);
  });

  it('counts a false call and a missed error as errors', () => {
    const session = new GameSession(makeApp());
    session.recordFoulCaught();
    session.recordFalseFoul();
    session.recordMissedDealerError();
    expect(session.stats).toMatchObject({ foulDecisions: 3, foulErrors: 2 });
    expect(session.accuracy().foul).toBe(33);
  });

  it('persists the calls', () => {
    const app = makeApp();
    const session = new GameSession(app);
    session.recordFalseFoul();
    expect(app.storage.get('gameStats')).toMatchObject({ foulDecisions: 1, foulErrors: 1 });
  });

  it('clears the calls with the rest of the stats', () => {
    const session = new GameSession(makeApp());
    session.recordFalseFoul();
    session.resetStats();
    expect(session.stats).toMatchObject({ foulDecisions: 0, foulErrors: 0 });
  });
});

describe('saved stats from an older version', () => {
  it('fills in the missing counters instead of reading NaN', () => {
    const app = makeApp();
    app.storage.set('gameStats', {
      rounds: 4,
      totalBet: 40,
      highBet: 10,
      lowBet: 10,
      highBankroll: 100,
      lowBankroll: 50,
      bankrollSum: 300,
      playDecisions: 2,
      playErrors: 0,
      betDecisions: 2,
      betErrors: 0,
    });
    const session = new GameSession(app);
    expect(session.stats).toMatchObject({ rounds: 4, foulDecisions: 0, foulErrors: 0 });
    expect(session.accuracy().foul).toBe(100);
    session.recordFalseFoul();
    expect(session.accuracy().foul).toBe(0);
  });
});
