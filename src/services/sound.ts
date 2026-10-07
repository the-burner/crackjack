// Sound effects, played through Web Audio: decoded once, started with no delay,
// and free to overlap. An effect that is already playing is not restarted.
//
// iOS only lets audio start after the user has touched the page, so the audio
// context is created (or resumed) on the first touch or key press.

import type { AppSettings } from '@/settings/schema';

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

/** Safari's audio session (iOS 17+), which decides how the app's sound mixes with other audio. */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export class Sound {
  readonly settings: Pick<AppSettings, 'get'>;
  private context: AudioContext | null = null;
  /** Decoded sounds and the ones now playing, by file. */
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private playing = new Set<string>();

  constructor(settings: Pick<AppSettings, 'get'>, target: EventTarget | undefined = globalThis.document) {
    this.settings = settings;
    const unlock = () => this.unlock();
    target?.addEventListener('pointerdown', unlock, { capture: true });
    target?.addEventListener('keydown', unlock, { capture: true });
  }

  /** Creates or resumes the audio context; called from a touch, so iOS allows it. */
  unlock() {
    if (!this.context) {
      if (typeof AudioContext === 'undefined') return;
      // Ambient: follows the silent switch and leaves the player's music playing.
      const session = (navigator as AudioSessionNavigator).audioSession;
      if (session) session.type = 'ambient';
      this.context = new AudioContext();
      for (const file of Object.values(FILES)) this.load(file);
    }
    if (this.context.state !== 'running') this.context.resume().catch(() => {});
  }

  private load(file: string): Promise<AudioBuffer | null> {
    let buffer = this.buffers.get(file);
    if (!buffer) {
      const context = this.context;
      buffer = context
        ? fetch(file)
            .then(response => response.arrayBuffer())
            .then(data => context.decodeAudioData(data))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(file, buffer);
    }
    return buffer;
  }

  /**
   * Plays an effect: card, correct, error, shuffle, win, lose, push, alarm.
   * `quietError` plays the card click instead of the buzzer for errors.
   */
  play(name: SoundName) {
    if (!this.settings.get('display.sound')) return;
    let effect: Effect = name === 'alarm' ? 'error' : name;
    if (name === 'error' && this.settings.get('display.quietErrorSound')) effect = 'card';
    if (this.playing.has(FILES[effect])) return;
    this.output(FILES[effect]);
  }

  /** Starts a sound file. Tests replace it to hear what would play. */
  output(file: string) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    this.playing.add(file);
    this.load(file).then(buffer => {
      if (!buffer) {
        this.playing.delete(file);
        return;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.addEventListener('ended', () => this.playing.delete(file));
      source.start();
    });
  }
}
