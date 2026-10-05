// Screen navigation. Screens form a stack: opening a screen hides the one
// below it (keeping its state), and going back destroys the top screen.
//
// A screen factory receives (app, params) and returns
//   { el, onShow?(), onHide?(), destroy?(), onBack?() }
// `onBack` may return true to handle the back request itself.
//
// Each screen gets a history entry, and that entry records the whole stack of
// screens open at the time. Going back or forward therefore needs no guesswork
// about which way the browser moved: `popstate` hands over the stack that entry
// stood for, and the router brings the open screens in line with it, closing
// what is no longer there and reopening what is. Going back inside the app asks
// the browser to go back as well, so the history and the screens are only ever
// changed in one place.
//
// Screens opened with something that cannot be stored in a history entry (a
// callback, a live session) are remembered as unrestorable: going back past one
// still closes it, but going forward stops there rather than rebuilding it
// wrongly.

/** Params a history entry can carry, or null when they cannot be stored. */
function storableParams(params) {
  try {
    return structuredClone(params ?? {});
  } catch {
    return null;
  }
}

export class Router {
  constructor(root, app, { history = globalThis.history, window: win = globalThis.window, dismissOverlay = () => false } = {}) {
    this.root = root;
    this.app = app;
    this.history = history;
    /** Closes the top modal overlay, if one is open, instead of a screen. */
    this.dismissOverlay = dismissOverlay;
    this.factories = new Map();
    this.stack = [];
    win?.addEventListener('popstate', event => this.onPopState(event));
  }

  register(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** The open screens as a history entry describes them. */
  get entry() {
    return { screens: this.stack.map(({ name, params }) => ({ name, params })) };
  }

  /** Opens a screen on top of the current one, and records it in the history. */
  open(name, params = {}) {
    const screen = this.mount(name, params);
    // The bottom screen is the entry the app started on, so it replaces that
    // entry's state rather than adding one of its own.
    if (this.stack.length > 1) this.history?.pushState(this.entry, '');
    else this.history?.replaceState?.(this.entry, '');
    return screen;
  }

  /** Replaces the current screen. */
  replace(name, params = {}) {
    const top = this.stack.pop();
    if (top) this.dispose(top);
    const screen = this.mount(name, params);
    this.history?.replaceState?.(this.entry, '');
    return screen;
  }

  /**
   * Closes the current screen and shows the one below. The history goes back
   * too, and its popstate is what actually closes the screen.
   * @returns {boolean} false when the bottom screen is already showing.
   */
  back() {
    // An open dialog or sheet is what a back request means to close.
    if (this.dismissOverlay()) return true;
    if (this.stack.length <= 1) return false;
    if (this.history) this.history.back();
    else this.closeTop();
    return true;
  }

  /** Returns to the bottom (home) screen. */
  home() {
    const open = this.stack.length - 1;
    if (open <= 0) return;
    if (this.history) this.history.go(-open);
    else while (this.closeTop());
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

  /** Builds a screen and puts it on top of the stack, history untouched. */
  mount(name, params) {
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
    this.stack.push({ name, screen, params: storableParams(params) });
    screen.onShow?.();
    return screen;
  }

  /** The browser moved through the history: show what that entry stood for. */
  onPopState(event) {
    const wanted = event?.state?.screens;
    // An entry that is not the router's own — a foreign one, or one whose state
    // the browser lost — says nothing about the screens, so they are left be.
    if (!Array.isArray(wanted) || wanted.length === 0) return;
    // A back request with a dialog or sheet up closes that instead, and the
    // entry it used goes back.
    if (wanted.length < this.stack.length && this.dismissOverlay()) {
      this.history?.pushState(this.entry, '');
      return;
    }
    this.reconcile(wanted);
  }

  /**
   * Brings the open screens in line with the stack a history entry describes.
   * @param {{name: string, params: object|null}[]} wanted
   */
  reconcile(wanted) {
    // Closes from the top until what is left is the start of the wanted stack.
    while (this.stack.length > wanted.length
      || (this.stack.length > 1 && this.current.name !== wanted[this.stack.length - 1].name)) {
      if (!this.closeTop()) {
        // A screen kept itself open, so the entry it would have used goes back.
        this.history?.pushState(this.entry, '');
        return;
      }
    }
    // Reopens the rest, as far as they can be rebuilt.
    for (const { name, params } of wanted.slice(this.stack.length)) {
      if (params === null || !this.factories.has(name)) break;
      this.mount(name, params);
    }
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
