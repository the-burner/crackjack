// Screen navigation. Screens form a stack: opening a screen hides the one
// below it (keeping its state), and going back destroys the top screen.
//
// A screen factory receives (app, params) and returns
//   { el, onShow?(), onHide?(), destroy?(), onBack?() }
// `onBack` may return true to handle the back request itself.
//
// The browser's back button (or back gesture) should go back one screen
// rather than leave the app, so once a second screen opens the router adds a
// single extra history entry — a guard — and turns its removal into a back
// step, re-adding it while screens remain. The router never removes the guard
// itself (history navigation is asynchronous, and removing and re-adding an
// entry in quick succession can drop the wrong one), so after returning home a
// back press may be absorbed once before the next one leaves the app.

export class Router {
  constructor(root, app, { history = globalThis.history, window: win = globalThis.window } = {}) {
    this.root = root;
    this.app = app;
    this.history = history;
    this.factories = new Map();
    this.stack = [];
    /** Whether the guard history entry is in place. */
    this.guarded = false;
    win?.addEventListener('popstate', () => this.onPopState());
  }

  register(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Opens a screen on top of the current one. */
  open(name, params = {}) {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown screen: ${name}`);
    const previous = this.current;
    if (previous) {
      previous.screen.onHide?.();
      previous.screen.el.hidden = true;
    }
    const screen = factory(this.app, params);
    screen.el.classList.add('screen');
    screen.el.dataset.screen = name;
    this.root.append(screen.el);
    this.stack.push({ name, screen });
    this.syncGuard();
    screen.onShow?.();
    return screen;
  }

  /** Replaces the current screen. */
  replace(name, params = {}) {
    const top = this.stack.pop();
    if (top) this.dispose(top);
    return this.open(name, params);
  }

  /** Closes the current screen and shows the one below. */
  back() {
    if (this.stack.length <= 1) return false;
    const top = this.current;
    if (top.screen.onBack?.()) return true;
    this.stack.pop();
    this.dispose(top);
    this.showCurrent();
    this.syncGuard();
    return true;
  }

  /** Returns to the bottom (home) screen. */
  home() {
    while (this.stack.length > 1) this.dispose(this.stack.pop());
    this.showCurrent();
    this.syncGuard();
  }

  showCurrent() {
    const below = this.current;
    if (!below) return;
    below.screen.el.hidden = false;
    below.screen.onShow?.();
  }

  /** Adds the history guard whenever more than one screen is open. */
  syncGuard() {
    if (!this.history || this.guarded || this.stack.length <= 1) return;
    this.history.pushState({ guard: true }, '');
    this.guarded = true;
  }

  /** The user went back through the guard: go back one screen. */
  onPopState() {
    if (!this.guarded) return;
    this.guarded = false;
    this.back();
    this.syncGuard();
  }

  dispose({ screen }) {
    screen.onHide?.();
    screen.destroy?.();
    screen.el.remove();
  }
}
