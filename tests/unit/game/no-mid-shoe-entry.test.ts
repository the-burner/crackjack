// No mid-shoe entry: once the player sits out a round, they may only sit out until the shuffle.
import { describe, it, expect } from 'vitest';
import { GameSession } from '@/game/session';
import { createServices } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import type { SettingsPatch } from '@/settings/schema';

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
