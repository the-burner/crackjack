// No mid-shoe entry: once the player sits out a round, they may only sit out until the shuffle.
import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import type { SettingsPatch } from '@/settings/schema';
import { seededRandom } from '@/core/random';

function session(settings: SettingsPatch) {
  const app = createServices({ backend: new MemoryBackend() });
  app.sound = { play() {} } as unknown as typeof app.sound;
  // A computer player too, so the player may sit out.
  app.settings.update({
    'table.seatCount': 2,
    'table.computerSeats': [false, true, false, false, false, false],
    ...settings,
  });
  return new GameSession(app);
}

describe('no mid-shoe entry', () => {
  it('shuts the player out of the shoe once they sit out, from the first round on, until the shuffle', () => {
    const s = session({ 'table.noMidShoeEntry': true });
    expect(s.outUntilShuffle).toBe(false);
    s.wong();
    expect(s.outUntilShuffle).toBe(true);
    // Sitting out again does not let them back in, nor is it judged a wonging mistake.
    s.wong();
    expect(s.outUntilShuffle).toBe(true);
    s.game.shuffleAndBurn();
    expect(s.outUntilShuffle).toBe(false);
  });

  it('lets the player come and go as they like without it', () => {
    const s = session({ 'table.noMidShoeEntry': false });
    s.wong();
    expect(s.outUntilShuffle).toBe(false);
  });
});

describe('spreading to more hands', () => {
  it('is refused mid-shoe once the player plays fewer hands, until the shuffle', () => {
    const s = session({
      'table.noSpreadingMidShoe': true,
      'table.seatCount': 4,
      'table.computerSeats': [false, false, true, true, false, false],
    });
    expect(s.mostHands()).toBe(2);
    s.startRound({ betPerHand: 25, hands: 1 });
    expect(s.mostHands()).toBe(1);
    s.game.shuffleAndBurn();
    expect(s.mostHands()).toBe(2);
  });

  it('is never more than one spot at a one-spot table', () => {
    const s = session({
      'table.oneSpot': true,
      'table.seatCount': 4,
      'table.computerSeats': [false, false, true, true, false, false],
    });
    expect(s.mostHands()).toBe(1);
  });
});

describe('new players', () => {
  it('sit down only at the shuffle where they wait for it, though players may leave mid-shoe', () => {
    const s = session({
      'table.newPlayersWaitForShuffle': true,
      'table.playersComeAndGo': true,
      'table.seatCount': 6,
      'table.computerSeats': [false, true, true, true, true, true],
    });
    // Seeded, so the same players come and go on every run.
    s.game.random = seededRandom(1);
    const seated = s.game.computerSeatsThisRound();
    s.game.shoe.roundsDealt = 1;
    let changes = 0;
    for (let i = 0; i < 300; i++) {
      const now = s.game.computerSeatsThisRound();
      for (const seat of now) expect(seated).toContain(seat);
      if (now.length < seated.length) changes += 1;
    }
    // Players did leave, so the table was redrawn mid-shoe, and still no one new sat down.
    expect(changes).toBeGreaterThan(0);
  });

  it('sit down mid-shoe where they need not wait', () => {
    const s = session({
      'table.playersComeAndGo': true,
      'table.seatCount': 6,
      'table.computerSeats': [false, true, true, true, true, true],
    });
    s.game.random = seededRandom(1);
    const seated = s.game.computerSeatsThisRound();
    s.game.shoe.roundsDealt = 1;
    const later = Array.from({ length: 300 }, () => s.game.computerSeatsThisRound()).flat();
    expect(later.some(seat => !seated.includes(seat))).toBe(true);
  });
});
