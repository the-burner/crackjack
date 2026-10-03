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
    back() { entries.pop(); queueMicrotask(() => listener?.()); },
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

  it('keeps exactly one history guard however deep the stack goes', () => {
    const { router, history } = setup();
    router.open('home');
    expect(history.entries.length).toBe(1);
    router.open('a');
    router.open('b');
    router.open('c');
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
    // Re-armed for the next back press.
    expect(history.entries.length).toBe(2);
  });

  it('survives going home and opening screens in quick succession', async () => {
    const { router, history } = setup();
    router.open('home');
    for (let i = 0; i < 5; i++) {
      router.open('a');
      router.open('b');
      router.home();
    }
    await Promise.resolve();
    router.open('c');
    expect(router.current.name).toBe('c');
    expect(history.entries.length).toBe(2);
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
