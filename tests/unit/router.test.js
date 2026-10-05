import { describe, it, expect } from 'vitest';
import { Router } from '../../public/src/app/router.js';

/** Minimal DOM stand-ins: elements with `hidden`, `remove()` and `classList`. */
function element() {
  return { hidden: false, dataset: {}, classList: { add() {} }, removed: false, remove() { this.removed = true; } };
}

function fakeHistory() {
  const entries = [{}];
  let listener = null;
  return {
    entries,
    pushState(state) { entries.push(state); },
    back() { this.go(-1); },
    go(delta) {
      for (let i = 0; i < -delta && entries.length > 1; i++) entries.pop();
      queueMicrotask(() => listener?.());
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
    expect(history.entries.length).toBe(4);
  });

  it('gives a guard back for every screen closed inside the app', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');
    expect(history.entries.length).toBe(3);

    router.back();
    await Promise.resolve();
    // The guard went back with the screen, and the popstate it caused was ignored.
    expect(history.entries.length).toBe(2);
    expect(router.current.name).toBe('a');

    router.home();
    await Promise.resolve();
    expect(history.entries.length).toBe(1);
    expect(router.current.name).toBe('home');
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
    expect(history.entries.length).toBe(1);
    router.open('a');
    expect(history.entries.length).toBe(2);
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
    expect(history.entries.length).toBe(2);
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
    expect(history.entries.length).toBe(1);
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
    expect(history.entries.length).toBe(2);
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

  it('lets a screen keep itself open on back', () => {
    const { router } = setup();
    router.open('home');
    router.register('sticky', () => ({ el: element(), onBack: () => true }));
    router.open('sticky');
    expect(router.back()).toBe(true);
    expect(router.current.name).toBe('sticky');
  });
});
