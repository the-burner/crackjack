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
    replaceState(state) { entries[index] = state; },
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

const names = router => router.stack.map(s => s.name);
/** Lets the history's popstate run. */
const settle = () => Promise.resolve();

describe('Router', () => {
  it('stacks screens and hides the ones underneath', () => {
    const { router } = setup();
    router.open('home');
    const a = router.open('a');
    expect(router.current.name).toBe('a');
    expect(router.stack[0].screen.el.hidden).toBe(true);
    router.closeTop();
    expect(router.current.name).toBe('home');
    expect(a.el.removed).toBe(true);
  });

  it('gives every screen a history entry describing the whole stack', () => {
    const { router, history } = setup();
    router.open('home');
    // The bottom screen takes over the entry the app started on.
    expect(history.index).toBe(0);
    expect(history.entries[0].screens.map(s => s.name)).toEqual(['home']);

    router.open('a');
    router.open('b');
    expect(history.index).toBe(2);
    expect(history.entries[2].screens.map(s => s.name)).toEqual(['home', 'a', 'b']);
  });

  it('goes back one screen per back press from a deep stack', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    router.open('c');
    for (const name of ['b', 'a', 'home']) {
      history.back();
      await settle();
      expect(router.current.name).toBe(name);
    }
    // Home is showing on the first entry; the next press leaves the app.
    expect(history.index).toBe(0);
  });

  it('closes a screen when the app itself goes back, and takes the entry with it', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');

    router.back();
    await settle();
    expect(names(router)).toEqual(['home', 'a']);
    expect(history.index).toBe(1);

    router.home();
    await settle();
    expect(names(router)).toEqual(['home']);
    expect(history.index).toBe(0);
  });

  it('reopens a screen when the browser goes forward', async () => {
    const { router, history, shown } = setup();
    router.open('home');
    router.open('a');
    router.open('b');

    history.back();
    await settle();
    expect(names(router)).toEqual(['home', 'a']);
    expect(history.ahead).toBe(1);

    shown.length = 0;
    history.forward();
    await settle();
    // The entry says b was open, so b comes back.
    expect(names(router)).toEqual(['home', 'a', 'b']);
    expect(shown).toEqual(['b']);

    history.back();
    await settle();
    expect(names(router)).toEqual(['home', 'a']);
  });

  it('reopens a screen with the params it was given', async () => {
    const { router, history } = setup();
    const seen = [];
    router.register('topic', (app, params) => { seen.push(params); return { el: element() }; });
    router.open('home');
    router.open('topic', { topic: 'rules', page: 2 });

    history.back();
    await settle();
    history.forward();
    await settle();
    expect(names(router)).toEqual(['home', 'topic']);
    expect(seen).toEqual([{ topic: 'rules', page: 2 }, { topic: 'rules', page: 2 }]);
  });

  it('does not rebuild a screen whose params cannot be stored', async () => {
    const { router, history } = setup();
    router.register('picker', () => ({ el: element() }));
    router.open('home');
    // A callback cannot go in a history entry.
    router.open('picker', { onPick: () => {} });

    history.back();
    await settle();
    expect(names(router)).toEqual(['home']);

    history.forward();
    await settle();
    // Rebuilding it without its callback would be worse than leaving it closed.
    expect(names(router)).toEqual(['home']);
  });

  it('follows a jump of several entries at once', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    router.open('c');

    history.go(-2);
    await settle();
    expect(names(router)).toEqual(['home', 'a']);

    history.go(2);
    await settle();
    expect(names(router)).toEqual(['home', 'a', 'b', 'c']);
  });

  it('ignores a history entry that is not its own', () => {
    const { router } = setup();
    router.open('home');
    router.open('a');
    router.open('b');

    // A foreign entry, or one whose state the browser lost, must not tear down
    // screens the user is looking at.
    router.onPopState({ state: null });
    router.onPopState({});
    router.onPopState({ state: { screens: [] } });
    expect(names(router)).toEqual(['home', 'a', 'b']);
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

    history.back();
    await settle();
    expect(overlays).toBe(0);
    expect(router.current.name).toBe('a');
    // The entry it used is back in place, so the next press closes the screen.
    expect(history.index).toBe(1);
    history.back();
    await settle();
    expect(router.current.name).toBe('home');
  });

  it('lets a screen keep itself open on back', async () => {
    const { router, history } = setup();
    router.open('home');
    router.register('sticky', () => ({ el: element(), onBack: () => true }));
    router.open('sticky');

    history.back();
    await settle();
    expect(router.current.name).toBe('sticky');
    // Its entry is back, so the screen is not left without one.
    expect(history.index).toBe(1);
  });

  it('detaches a screen even when it fails to tear itself down', () => {
    const { router } = setup();
    router.open('home');
    const el = element();
    router.register('broken', () => ({ el, destroy() { throw new Error('boom'); } }));
    router.open('broken');
    expect(() => router.closeTop()).toThrow('boom');
    // The element is gone, so it cannot sit over the screen below catching taps.
    expect(el.removed).toBe(true);
    expect(router.current.name).toBe('home');
  });

  it('survives going home and opening screens in quick succession', async () => {
    const { router, history } = setup();
    router.open('home');
    for (let i = 0; i < 5; i++) {
      router.open('a');
      router.open('b');
      router.home();
      await settle();
    }
    router.open('c');
    expect(router.current.name).toBe('c');
    expect(history.index).toBe(1);
  });
});
