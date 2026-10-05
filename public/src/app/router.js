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
//
// Each guard records how deep it is, because popstate reports going forward as
// well as back and says nothing about the direction. Going back closes as many
// screens as the move covered. Going forward cannot reopen a closed screen, so
// the router returns to its own depth instead, leaving the screen alone.

export class Router {
  constructor(root, app, { history = globalThis.history, window: win = globalThis.window, dismissOverlay = () => false } = {}) {
    this.root = root;
    this.app = app;
    this.history = history;
    /** Closes the top modal overlay, if one is open, instead of a screen. */
    this.dismissOverlay = dismissOverlay;
    this.factories = new Map();
    this.stack = [];
    /** Depth of the current history entry; kept equal to `stack.length - 1`. */
    this.guards = 0;
    /** Popstate events caused by the router itself, which must not move screens. */
    this.selfPops = 0;
    win?.addEventListener('popstate', event => this.onPopState(event));
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
    // An open dialog or sheet is what a back request means to close.
    if (this.dismissOverlay()) return true;
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
      this.guards += 1;
      this.history.pushState({ guard: true, depth: this.guards }, '');
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

  /** The browser moved through the history: match the screens to where it landed. */
  onPopState(event) {
    const depth = event?.state?.depth ?? 0;
    const previous = this.guards;
    this.guards = depth;
    if (this.selfPops > 0) {
      this.selfPops -= 1;
      return;
    }
    if (depth < previous) {
      // Went back. An open dialog or sheet is closed first, and the guard it
      // used is put back, so the screens stay where they are.
      if (this.dismissOverlay()) {
        this.syncGuard();
        return;
      }
      for (let i = previous - depth; i > 0; i -= 1) {
        if (!this.closeTop()) break;
      }
      // Puts a guard back when the top screen kept itself open.
      this.syncGuard();
      return;
    }
    // Went forward, past the screens that were closed on the way back. They
    // cannot be reopened, so return to the depth the open screens stand at.
    this.dropGuards(depth - (this.stack.length - 1));
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
