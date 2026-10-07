// Sound effects. Each effect has its own audio element; a sound that is
// already playing is not restarted.

const FILES = {
  card: 'assets/sounds/click.mp3',
  correct: 'assets/sounds/drip.mp3',
  error: 'assets/sounds/buzz.mp3',
  shuffle: 'assets/sounds/shuffle.mp3',
  win: 'assets/sounds/chips-win.mp3',
  lose: 'assets/sounds/chips-lose.mp3',
  push: 'assets/sounds/push.mp3',
};

export class Sound {
  /** @param {import('../settings/store.js').Settings} settings */
  constructor(settings) {
    this.settings = settings;
    this.audio = new Map();
  }

  element(name) {
    if (!this.audio.has(name)) {
      const a = new Audio(FILES[name]);
      a.preload = 'auto';
      this.audio.set(name, a);
    }
    return this.audio.get(name);
  }

  /**
   * Plays an effect: card, correct, error, shuffle, win, lose, push, alarm.
   * `quietError` plays the card click instead of the buzzer for errors.
   */
  play(name) {
    if (!this.settings.get('display.sound')) return;
    let file = name;
    if (name === 'alarm') file = 'error';
    if (name === 'error' && this.settings.get('display.quietErrorSound')) file = 'card';
    const a = this.element(file);
    if (!a.paused) return;
    a.play().catch(() => {});
  }
}
