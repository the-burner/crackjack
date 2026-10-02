// Screen navigation. Screens form a stack: opening a screen hides the one
// below it (keeping its state), and going back destroys the top screen.
//
// A screen factory receives (app, params) and returns
//   { el, onShow?(), onHide?(), destroy?(), onBack?() }
// `onBack` may return true to handle the back request itself.

export class Router {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.factories = new Map();
    this.stack = [];
    this.ignorePop = 0;
    window.addEventListener('popstate', () => {
      if (this.ignorePop > 0) { this.ignorePop -= 1; return; }
      if (this.stack.length > 1) this.back({ fromHistory: true });
    });
  }

  register(name, factory) {
    this.factories.set(name, factory);
    return this;
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Opens a screen on top of the current one. */
  open(name, params = {}, { pushHistory = true } = {}) {
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
    if (pushHistory && this.stack.length > 1) history.pushState({ depth: this.stack.length }, '');
    screen.onShow?.();
    return screen;
  }

  /** Replaces the current screen, reusing its history entry. */
  replace(name, params = {}) {
    const top = this.stack.pop();
    if (top) this.dispose(top);
    return this.open(name, params, { pushHistory: false });
  }

  /** Closes the current screen and shows the one below. */
  back({ fromHistory = false } = {}) {
    if (this.stack.length <= 1) return false;
    const top = this.current;
    if (top.screen.onBack?.()) {
      if (fromHistory) history.pushState({ depth: this.stack.length }, '');
      return true;
    }
    this.stack.pop();
    this.dispose(top);
    if (!fromHistory) { this.ignorePop += 1; history.back(); }
    const below = this.current;
    below.screen.el.hidden = false;
    below.screen.onShow?.();
    return true;
  }

  /** Returns to the bottom (home) screen. */
  home() {
    while (this.stack.length > 1) {
      const top = this.stack.pop();
      this.dispose(top);
      this.ignorePop += 1;
      history.back();
    }
    const home = this.current;
    if (home) { home.screen.el.hidden = false; home.screen.onShow?.(); }
  }

  dispose({ screen }) {
    screen.onHide?.();
    screen.destroy?.();
    screen.el.remove();
  }
}
