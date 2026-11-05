// The pace of play: time at the table while it shows, and the rounds dealt in it.

export class SessionPace {
  rounds = 0;
  now: () => number;
  played = 0;
  since: number | null = null;

  constructor(now = () => Date.now()) {
    this.now = now;
  }

  resume(): void {
    this.since ??= this.now();
  }

  pause(): void {
    if (this.since === null) return;
    this.played += this.now() - this.since;
    this.since = null;
  }

  reset(): void {
    this.rounds = 0;
    this.played = 0;
    if (this.since !== null) this.since = this.now();
  }

  seconds(): number {
    return (this.played + (this.since === null ? 0 : this.now() - this.since)) / 1000;
  }

  perHour(): number {
    const seconds = this.seconds();
    return seconds > 0 ? Math.round((this.rounds * 3600) / seconds) : 0;
  }
}
