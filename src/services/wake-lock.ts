// Keeps the screen on while a drill or the table is showing. The browser drops
// the lock whenever the page is hidden, so it is asked for again on return.

type WakeLockApi = { request(type: 'screen'): Promise<WakeLockSentinel> };

export class ScreenWakeLock {
  private holders = 0;
  private sentinel: WakeLockSentinel | null = null;
  private readonly api: WakeLockApi | undefined;
  private readonly doc: Pick<Document, 'visibilityState' | 'addEventListener'> | undefined;

  constructor(
    api: WakeLockApi | undefined = globalThis.navigator?.wakeLock,
    doc: Pick<Document, 'visibilityState' | 'addEventListener'> | undefined = globalThis.document,
  ) {
    this.api = api;
    this.doc = doc;
    doc?.addEventListener('visibilitychange', () => {
      if (this.holders > 0 && doc.visibilityState === 'visible') this.request();
    });
  }

  /** Keeps the screen on until the returned function is called. */
  hold(): () => void {
    this.holders += 1;
    if (this.holders === 1) this.request();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders -= 1;
      if (this.holders === 0) this.drop();
    };
  }

  private request() {
    if (!this.api || this.sentinel || this.doc?.visibilityState !== 'visible') return;
    this.api.request('screen').then(
      sentinel => {
        // Released while the request was pending.
        if (this.holders === 0) sentinel.release().catch(() => {});
        else {
          this.sentinel = sentinel;
          sentinel.addEventListener('release', () => {
            if (this.sentinel === sentinel) this.sentinel = null;
          });
        }
      },
      // Refused (low battery, no permission): the screen just sleeps as usual.
      () => {},
    );
  }

  private drop() {
    const sentinel = this.sentinel;
    this.sentinel = null;
    sentinel?.release().catch(() => {});
  }
}
