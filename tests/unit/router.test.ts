import { describe, it, expect } from 'vitest';
import type { App } from '../../src/app/app.ts';
import { Router, type HistoryScreen } from '../../src/app/router.ts';

type FakeElement = HTMLElement & { removed: boolean };
/** A history entry as the router writes it; the one the app started on is null. */
type Entry = { screens: HistoryScreen[] } | null;
/** The router never reaches into the app here. */
const NO_APP = {} as App;

/** Minimal DOM stand-ins: elements with `hidden`, `remove()` and `classList`. */
function element() {
  const el = {
    hidden: false,
    dataset: {},
    classList: { add() {}, remove() {} },
    removed: false,
    remove() {
      this.removed = true;
    },
  };
  return el as unknown as FakeElement;
}

/** A root that takes screens and does nothing else. */
const fakeRoot = () => ({ append() {} }) as unknown as HTMLElement;

/**
 * A history with a pointer, as browsers have: pushing truncates whatever was
 * ahead, and moving the pointer reports the entry it lands on.
 */
function fakeHistory() {
  const entries: Entry[] = [null];
  let index = 0;
  let listener: ((event: { state: unknown }) => void) | null = null;
  return {
    entries,
    get index() {
      return index;
    },
    /** Entries ahead of the pointer, which a forward gesture could reach. */
    get ahead() {
      return entries.length - 1 - index;
    },
    get state() {
      return entries[index];
    },
    pushState(state: unknown) {
      entries.length = index + 1;
      entries.push(state as Entry);
      index += 1;
    },
    replaceState(state: unknown) {
      entries[index] = state as Entry;
    },
    back() {
      this.go(-1);
    },
    forward() {
      this.go(1);
    },
    go(delta: number) {
      index = Math.min(entries.length - 1, Math.max(0, index + delta));
      queueMicrotask(() => listener?.({ state: entries[index] }));
    },
    window: {
      addEventListener: (type: string, fn: (event: { state: unknown }) => void) => {
        if (type === 'popstate') listener = fn;
      },
    } as Pick<Window, 'addEventListener'>,
  };
}

function setup() {
  const history = fakeHistory();
  const root = fakeRoot();
  const router = new Router(root, NO_APP, { history, window: history.window });
  const shown: string[] = [];
  for (const name of ['home', 'a', 'b', 'c']) {
    router.register(name, () => ({ el: element(), onShow: () => shown.push(name) }));
  }
  return { router, history, shown };
}

const names = (router: Router) => router.stack.map(s => s.name);
/** Lets the history's popstate run. */
const settle = () => Promise.resolve();

describe('Router', () => {
  it('stacks screens and hides the ones underneath', () => {
    const { router } = setup();
    router.open('home');
    const a = router.open('a');
    expect(router.current!.name).toBe('a');
    expect(router.stack[0].screen.el.hidden).toBe(true);
    router.closeTop();
    expect(router.current!.name).toBe('home');
    expect((a.el as FakeElement).removed).toBe(true);
  });

  it('gives every screen a history entry describing the whole stack', () => {
    const { router, history } = setup();
    router.open('home');
    // The bottom screen sits on the entry above the one the app started on.
    expect(history.index).toBe(1);
    expect(history.entries[1]!.screens.map(s => s.name)).toEqual(['home']);

    router.open('a');
    router.open('b');
    expect(history.index).toBe(3);
    expect(history.entries[3]!.screens.map(s => s.name)).toEqual(['home', 'a', 'b']);
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
      expect(router.current!.name).toBe(name);
    }
    // Home is showing on its own entry; the next press leaves the app.
    expect(history.index).toBe(1);
  });

  it('closes a screen when the app itself goes back, and takes the entry with it', async () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.open('b');

    router.back();
    await settle();
    expect(names(router)).toEqual(['home', 'a']);
    expect(history.index).toBe(2);

    router.home();
    await settle();
    expect(names(router)).toEqual(['home']);
    expect(history.index).toBe(1);
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
    const seen: object[] = [];
    router.register('topic', (app, params) => {
      seen.push(params);
      return { el: element() };
    });
    router.open('home');
    router.open('topic', { topic: 'rules', page: 2 });

    history.back();
    await settle();
    history.forward();
    await settle();
    expect(names(router)).toEqual(['home', 'topic']);
    expect(seen).toEqual([
      { topic: 'rules', page: 2 },
      { topic: 'rules', page: 2 },
    ]);
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
    const router = new Router(fakeRoot(), NO_APP, {
      history,
      window: history.window,
      dismissOverlay: () => (overlays > 0 ? ((overlays -= 1), true) : false),
    });
    for (const name of ['home', 'a']) router.register(name, () => ({ el: element() }));
    router.open('home');
    router.open('a');

    history.back();
    await settle();
    expect(overlays).toBe(0);
    expect(router.current!.name).toBe('a');
    // The entry it used is back in place, so the next press closes the screen.
    expect(history.index).toBe(2);
    history.back();
    await settle();
    expect(router.current!.name).toBe('home');
  });

  it('closes an open dialog when the app itself goes back, leaving the history alone', () => {
    const history = fakeHistory();
    let overlays = 1;
    const router = new Router(fakeRoot(), NO_APP, {
      history,
      window: history.window,
      dismissOverlay: () => (overlays > 0 ? ((overlays -= 1), true) : false),
    });
    for (const name of ['home', 'a']) router.register(name, () => ({ el: element() }));
    router.open('home');
    router.open('a');

    expect(router.back()).toBe(true);
    expect(overlays).toBe(0);
    expect(names(router)).toEqual(['home', 'a']);
    expect(history.index).toBe(2);
  });

  it('lets a screen keep itself open on back', async () => {
    const { router, history } = setup();
    router.open('home');
    router.register('sticky', () => ({ el: element(), onBack: () => true }));
    router.open('sticky');

    history.back();
    await settle();
    expect(router.current!.name).toBe('sticky');
    // Its entry is back, so the screen is not left without one.
    expect(history.index).toBe(2);
  });

  it('detaches a screen even when it fails to tear itself down', () => {
    const { router } = setup();
    router.open('home');
    const el = element();
    router.register('broken', () => ({
      el,
      destroy() {
        throw new Error('boom');
      },
    }));
    router.open('broken');
    expect(() => router.closeTop()).toThrow('boom');
    // The element is gone, so it cannot sit over the screen below catching taps.
    expect(el.removed).toBe(true);
    expect(router.current!.name).toBe('home');
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
    expect(router.current!.name).toBe('c');
    expect(history.index).toBe(2);
  });

  it('has no current screen before anything is opened', () => {
    expect(setup().router.current).toBe(null);
  });

  it('refuses to open a screen it does not know', () => {
    const { router } = setup();
    expect(() => router.open('ghost')).toThrow('Unknown screen: ghost');
  });

  it('reports that there is nothing to go back to from the bottom screen', () => {
    const { router } = setup();
    router.open('home');
    expect(router.back()).toBe(false);
    expect(router.closeTop()).toBe(false);
  });

  it('stays put when asked to go home from home', () => {
    const { router, history } = setup();
    router.open('home');
    router.home();
    expect(history.index).toBe(1);
    expect(names(router)).toEqual(['home']);
  });
});

describe('Router.replace', () => {
  it('swaps the top screen for another, keeping the one below', () => {
    const { router } = setup();
    router.open('home');
    const a = router.open('a');
    router.replace('b');
    expect(names(router)).toEqual(['home', 'b']);
    expect((a.el as FakeElement).removed).toBe(true);
  });

  it('reuses the entry the replaced screen had', () => {
    const { router, history } = setup();
    router.open('home');
    router.open('a');
    router.replace('b');
    expect(history.index).toBe(2);
    expect(history.entries[2]!.screens.map(s => s.name)).toEqual(['home', 'b']);
  });

  it('acts as an open when nothing is showing yet', () => {
    const { router, history } = setup();
    router.replace('home');
    expect(names(router)).toEqual(['home']);
    expect(history.entries[0]!.screens.map(s => s.name)).toEqual(['home']);
  });

  it('shows the replacement, not the screen it replaced', async () => {
    const { router, history, shown } = setup();
    router.open('home');
    router.open('a');
    shown.length = 0;
    router.replace('b');
    expect(shown).toEqual(['b']);
    // The entry now stands for b, so going back lands on home.
    history.back();
    await settle();
    expect(names(router)).toEqual(['home']);
  });
});

describe('Router without a browser history', () => {
  /** A router built the way the app's bare constructor would in Node: no history, no window. */
  const bare = () => {
    const router = new Router(fakeRoot(), NO_APP);
    for (const name of ['home', 'a', 'b']) router.register(name, () => ({ el: element() }));
    return router;
  };

  it('closes the top screen itself when it goes back', () => {
    const router = bare();
    router.open('home');
    router.open('a');
    expect(router.back()).toBe(true);
    expect(names(router)).toEqual(['home']);
  });

  it('unwinds to the bottom screen itself when it goes home', () => {
    const router = bare();
    router.open('home');
    router.open('a');
    router.open('b');
    router.home();
    expect(names(router)).toEqual(['home']);
  });

  it('still replaces the top screen', () => {
    const router = bare();
    router.open('home');
    router.open('a');
    router.replace('b');
    expect(names(router)).toEqual(['home', 'b']);
  });
});

describe('Router with a dialog over the bottom screen', () => {
  /** A router showing home, with one dialog open over it. */
  const atHome = (history: ReturnType<typeof fakeHistory>) => {
    const overlays = { count: 1 };
    const router = new Router(fakeRoot(), NO_APP, {
      history,
      window: history.window,
      dismissOverlay: () => (overlays.count > 0 ? ((overlays.count -= 1), true) : false),
    });
    router.register('home', () => ({ el: element() }));
    router.open('home');
    return { router, overlays };
  };

  it('dismisses the dialog on back instead of leaving the app', async () => {
    const history = fakeHistory();
    const { router, overlays } = atHome(history);
    // Home has an entry below it, so back has one to spend on the dialog.
    expect(history.index).toBe(1);

    history.back();
    await settle();
    expect(overlays.count).toBe(0);
    expect(names(router)).toEqual(['home']);
    // Home's entry is back in place, so the next press leaves the app.
    expect(history.index).toBe(1);
  });

  it('leaves the app on back from home with no dialog open', async () => {
    const history = fakeHistory();
    const { router, overlays } = atHome(history);
    overlays.count = 0;

    history.back();
    await settle();
    await settle();
    expect(names(router)).toEqual(['home']);
    // With nowhere to go, the entry it is left on stands for home.
    expect(history.entries[0]!.screens.map(s => s.name)).toEqual(['home']);
  });
});

describe('Router reconciling an entry it cannot honour', () => {
  it('leaves back working after going forward onto a screen it cannot rebuild', async () => {
    const { router, history } = setup();
    router.register('picker', () => ({ el: element() }));
    router.open('home');
    router.open('picker', { onPick: () => {} });

    history.back();
    await settle();
    history.forward();
    await settle();
    await settle();
    expect(names(router)).toEqual(['home']);
    // The entry stood for a screen that is not open; left that way it would
    // swallow the next back press, so it is given up.
    expect(history.state).toEqual(router.entry);
  });

  it('stops at a screen the app no longer has', () => {
    const history = fakeHistory();
    const router = new Router(fakeRoot(), NO_APP, { history, window: history.window });
    for (const name of ['home', 'a']) router.register(name, () => ({ el: element() }));
    router.open('home');
    // An entry left by an older version of the app, naming a screen that is gone.
    router.onPopState({
      state: {
        screens: [
          { name: 'home', params: {} },
          { name: 'a', params: {} },
          { name: 'ghost', params: {} },
        ],
      },
    });
    expect(names(router)).toEqual(['home', 'a']);
  });
});
