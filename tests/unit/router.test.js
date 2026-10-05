import { describe, it, expect } from 'vitest';
import { Router } from '../../public/src/app/router.js';

/** Minimal DOM stand-ins: elements with `hidden`, `remove()` and `classList`. */
function element() {
  return { hidden: false, dataset: {}, classList: { add() {}, remove() {} }, removed: false, remove() { this.removed = true; } };
}

/**
 * A history with a pointer, as browsers have: pushing truncates whatever was
 * ahead, and moving the pointer reports the entry it lands on.
 */
function fakeHistory() {
  const entries = [null];
  let index = 0;
  let listener = null;
  return {
    entries,
    get index() { return index; },
    /** Entries ahead of the pointer, which a forward gesture could reach. */
    get ahead() { return entries.length - 1 - index; },
    pushState(state) {
      entries.length = index + 1;
      entries.push(state);
      index += 1;
    },
    back() { this.go(-1); },
    forward() { this.go(1); },
    go(delta) {
      index = Math.min(entries.length - 1, Math.max(0, index + delta));
      queueMicrotask(() => listener?.({ state: entries[index] }));
    },
    window: { addEventListener: (type, fn) => { if (type === 'popstate') listener = fn; } },
  };
}

function setup() {
  const history = fakeHistory();
  const root = { append() {} };
  const router = new Router(root, {}, { history, window: history.window });
  const shown = [];
  for (const name of ['home', 'a', 'b', 'c']) {
    router.register(name, () => ({ el: element(), onShow: () => shown.push(name) }));
  }
  return { router, history, shown };
}

describe('Router', () => {
  it('stacks screens and hides the ones underneath', () => {
    const { router } = setup();
    router.open('home');
    const a = router.open('a');
    expect(router.current.name).toBe('a');
    expect(router.stack[0].screen.el.hidden).toBe(true);
    router.back();
    expect(router.current.name).toBe('home');
    expect(a.el.removed).toBe(true);
  });

  it('keeps one history guard per screen above the bottom', () => {
    const { router, history } = setup();
    router.open('home');
    expect(history.entries.length).toBe(1);
    router.open('a');
    router.open('b');
    router.open('c');
    // One guard each for a, b and c, so a back gesture can never reach past the app.
    expect(history.index).toBe(3);
  });

  it('gives a guard back for every screen closed inside the app', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    expect(history.index).toBe(2);

    router.back();
    await Promise.resolve();
    // The guard went back with the screen, and the popstate it caused was ignored.
    expect(history.index).toBe(1);
    expect(router.current.name).toBe('a');

    router.home();
    await Promise.resolve();
    expect(history.index).toBe(0);
    expect(router.current.name).toBe('home');
  });

  it('leaves the screens alone when the browser goes forward', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');

    history.back();
    await Promise.resolve();
    expect(router.current.name).toBe('a');
    expect(history.ahead).toBe(1);

    // Forward cannot reopen the closed screen, so it must not close another one.
    history.forward();
    await Promise.resolve();
    await Promise.resolve();
    expect(router.current.name).toBe('a');
    expect(router.stack.map(s => s.name)).toEqual(['home', 'a']);
    // Back is still worth exactly one screen afterwards.
    history.back();
    await Promise.resolve();
    expect(router.current.name).toBe('home');
  });

  it('survives the browser running forward several times over', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    router.open('c');
    history.go(-3);
    await Promise.resolve();
    expect(router.current.name).toBe('home');

    for (let i = 0; i < 3; i++) {
      history.forward();
      await Promise.resolve();
      await Promise.resolve();
      expect(router.current.name).toBe('home');
    }
  });

  it('never runs out of guards, however often screens are opened and closed', async () => {
    const { router, history } = setup();
    router.open('home');
    for (let i = 0; i < 5; i++) {
      router.open('a');
      router.open('b');
      history.back();
      await Promise.resolve();
      router.back();
      await Promise.resolve();
    }
    expect(router.current.name).toBe('home');
    expect(history.index).toBe(0);
    router.open('a');
    expect(history.index).toBe(1);
  });

  it('turns the browser back button into one step back', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    history.back();
    await Promise.resolve();
    expect(router.current.name).toBe('a');
    // One guard left, for the screen still open above home.
    expect(history.index).toBe(1);
  });

  it('closes one screen per guard when the browser goes back several at once', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    router.open('c');
    history.go(-2);
    await Promise.resolve();
    expect(router.stack.map(s => s.name)).toEqual(['home', 'a']);
  });

  it('goes back one screen per back press from a deep stack', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    router.open('c');
    for (const name of ['b', 'a', 'home']) {
      history.back();
      await Promise.resolve();
      expect(router.current.name).toBe(name);
    }
    // Home is showing with no guards left; the next press leaves the app.
    expect(history.index).toBe(0);
  });

  it('survives going home and opening screens in quick succession', async () => {
    const { router, history } = setup();
    router.open('home');
    for (let i = 0; i < 5; i++) {
      router.open('a');
      router.open('b');
      router.home();
      await Promise.resolve();
    }
    router.open('c');
    expect(router.current.name).toBe('c');
    expect(history.index).toBe(1);
  });

  it('detaches a screen even when it fails to tear itself down', () => {
    const { router } = setup();
    router.open('home');
    const el = element();
    router.register('broken', () => ({ el, destroy() { throw new Error('boom'); } }));
    router.open('broken');
    expect(() => router.back()).toThrow('boom');
    // The element is gone, so it cannot sit over the screen below catching taps.
    expect(el.removed).toBe(true);
    expect(router.current.name).toBe('home');
  });

  it('closes an open dialog instead of the screen behind it', async () => {
    const history = fakeHistory();
    let overlays = 1;
    const router = new Router({ append() {} }, {}, {
      history,
      window: history.window,
      dismissOverlay: () => (overlays > 0 ? (overlays -= 1, true) : false),
    });
    for (const name of ['home', 'a']) router.register(name, () => ({ el: element() }));
    router.open('home');
    router.open('a');

    // A back gesture while the dialog is up closes the dialog only.
    history.back();
    await Promise.resolve();
    expect(overlays).toBe(0);
    expect(router.current.name).toBe('a');
    // The guard it used is back in place, so the next press closes the screen.
    expect(history.index).toBe(1);
    history.back();
    await Promise.resolve();
    expect(router.current.name).toBe('home');
  });

  it('lets a screen keep itself open on back', () => {
    const { router } = setup();
    router.open('home');
    router.register('sticky', () => ({ el: element(), onBack: () => true }));
    router.open('sticky');
    expect(router.back()).toBe(true);
    expect(router.current.name).toBe('sticky');
  });
});
