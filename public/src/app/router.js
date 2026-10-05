// Screen navigation. Screens form a stack: opening a screen hides the one
// below it (keeping its state), and going back destroys the top screen.
//
// A screen factory receives (app, params) and returns
//   { el, onShow?(), onHide?(), destroy?(), onBack?() }
// `onBack` may return true to handle the back request itself.
//
// The browser's back button (or the phone's back gesture) should go back one
// screen rather than leave the app, so the router keeps one extra history entry
// — a guard — per screen above the bottom one. Matching history depth to screen
// depth means a back gesture from any depth can only ever consume a guard, never
// the app's own entry. Going back in the app consumes a guard too (and ignores
// the popstate that causes), so the two depths never drift apart.

export class Router {
  constructor(root, app, { history = globalThis.history, window: win = globalThis.window } = {}) {
    this.root = root;
    this.app = app;
    this.history = history;
    this.factories = new Map();
    this.stack = [];
    /** Guard history entries in place; kept equal to `stack.length - 1`. */
    this.guards = 0;
    /** Popstate events caused by the router itself, which must not go back again. */
    this.selfPops = 0;
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
      // Dropped so the screen does not animate again when it is revealed on back.
      previous.screen.el.classList.remove('is-entering');
      previous.screen.el.hidden = true;
    }
    const screen = factory(this.app, params);
    screen.el.classList.add('screen', 'is-entering');
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

  /**
   * Closes the current screen and shows the one below.
   * @returns {boolean} false when the bottom screen is already showing.
   */
  back() {
    if (this.stack.length <= 1) return false;
    if (this.closeTop()) this.dropGuards(1);
    return true;
  }

  /** Returns to the bottom (home) screen. */
  home() {
    const closed = this.stack.length - 1;
    if (closed <= 0) return;
    while (this.stack.length > 1) this.dispose(this.stack.pop());
    this.showCurrent();
    this.dropGuards(closed);
  }

  /**
   * Closes the top screen, unless it handles back itself.
   * @returns {boolean} false when there was nothing to close.
   */
  closeTop() {
    if (this.stack.length <= 1) return false;
    const top = this.current;
    if (top.screen.onBack?.()) return false;
    this.stack.pop();
    this.dispose(top);
    this.showCurrent();
    return true;
  }

  showCurrent() {
    const below = this.current;
    if (!below) return;
    below.screen.el.hidden = false;
    below.screen.onShow?.();
  }

  /** Adds guard entries until there is one per screen above the bottom. */
  syncGuard() {
    if (!this.history) return;
    while (this.guards < this.stack.length - 1) {
      this.history.pushState({ guard: true }, '');
      this.guards += 1;
    }
  }

  /** Gives `count` guards back to the browser, ignoring the popstate that follows. */
  dropGuards(count) {
    const going = Math.min(count, this.guards);
    if (!this.history || going === 0) return;
    this.guards -= going;
    // One history move reports one popstate, however many entries it covers.
    this.selfPops += 1;
    if (going === 1) this.history.back();
    else this.history.go(-going);
  }

  /** The user went back through a guard: go back one screen. */
  onPopState() {
    if (this.selfPops > 0) {
      this.selfPops -= 1;
      return;
    }
    // The browser has already taken the guard back.
    if (this.guards > 0) this.guards -= 1;
    this.closeTop();
    // Puts the guard back when the top screen kept itself open.
    this.syncGuard();
  }

  dispose({ screen }) {
    try {
      screen.onHide?.();
      screen.destroy?.();
    } finally {
      // Always detaches, so a failing screen cannot leave an element catching taps.
      screen.el.remove();
    }
  }
}
