// Sound effects. Each effect has its own audio element; a sound that is
// already playing is not restarted.

import type { AppSettings } from '../settings/schema.ts';

const FILES = {
  card: 'assets/sounds/click.mp3',
  correct: 'assets/sounds/drip.mp3',
  error: 'assets/sounds/buzz.mp3',
  shuffle: 'assets/sounds/shuffle.mp3',
  win: 'assets/sounds/chips-win.mp3',
  lose: 'assets/sounds/chips-lose.mp3',
  push: 'assets/sounds/push.mp3',
};

type Effect = keyof typeof FILES;
/** An effect `play` accepts; the alarm uses the error sound. */
export type SoundName = Effect | 'alarm';

export class Sound {
  readonly settings: Pick<AppSettings, 'get'>;
  private audio = new Map<Effect, HTMLAudioElement>();

  constructor(settings: Pick<AppSettings, 'get'>) {
    this.settings = settings;
  }

  element(name: Effect): HTMLAudioElement {
    let a = this.audio.get(name);
    if (!a) {
      a = new Audio(FILES[name]);
      a.preload = 'auto';
      this.audio.set(name, a);
    }
    return a;
  }

  /**
   * Plays an effect: card, correct, error, shuffle, win, lose, push, alarm.
   * `quietError` plays the card click instead of the buzzer for errors.
   */
  play(name: SoundName) {
    if (!this.settings.get('display.sound')) return;
    let file: Effect = name === 'alarm' ? 'error' : name;
    if (name === 'error' && this.settings.get('display.quietErrorSound')) file = 'card';
    const a = this.element(file);
    if (!a.paused) return;
    a.play().catch(() => {});
  }
}
