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

import type { App } from './app.ts';

/** What a screen factory returns. */
export interface Screen {
  el: HTMLElement;
  onShow?(): void;
  onHide?(): void;
  destroy?(): void;
  /** Returns true to handle the back request itself. */
  onBack?(): boolean | void;
}

/** What a screen is opened with. */
export type ScreenParams = object;

/**
 * Builds a screen. Declared as a method so that a factory taking its own params
 * type can be registered alongside the others.
 */
export type ScreenFactory<P extends ScreenParams = ScreenParams> = {
  build(app: App, params: P): Screen;
}['build'];

/** The parts of `window.history` the router uses. */
export interface RouterHistory {
  pushState(data: unknown, unused: string): void;
  replaceState?(data: unknown, unused: string): void;
  back(): void;
  go(delta: number): void;
}

/** A screen as a history entry records it; params are null when they could not be stored. */
export interface HistoryScreen {
  name: string;
  params: ScreenParams | null;
}

interface OpenScreen extends HistoryScreen {
  screen: Screen;
}

export interface RouterOptions {
  history?: RouterHistory | null;
  window?: Pick<Window, 'addEventListener'> | null;
  dismissOverlay?: () => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Params a history entry can carry, or null when they cannot be stored. */
function storableParams(params: ScreenParams | undefined): ScreenParams | null {
  try {
    return structuredClone(params ?? {});
  } catch {
    return null;
  }
}

export class Router {
  readonly root: HTMLElement;
  readonly app: App;
  readonly history: RouterHistory | null;
  readonly dismissOverlay: () => boolean;
  private factories = new Map<string, ScreenFactory>();
  stack: OpenScreen[] = [];

  constructor(
    root: HTMLElement,
    app: App,
    { history = globalThis.history, window: win = globalThis.window, dismissOverlay = () => false }: RouterOptions = {},
  ) {
    this.root = root;
    this.app = app;
    this.history = history;
    /** Closes the top modal overlay, if one is open, instead of a screen. */
    this.dismissOverlay = dismissOverlay;
    win?.addEventListener('popstate', event => this.onPopState(event));
  }

  register<P extends ScreenParams>(name: string, factory: ScreenFactory<P>): this {
    this.factories.set(name, factory);
    return this;
  }

  get current(): OpenScreen | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** The open screens as a history entry describes them. */
  get entry(): { screens: HistoryScreen[] } {
    return { screens: this.stack.map(({ name, params }) => ({ name, params })) };
  }

  /** Opens a screen on top of the current one, and records it in the history. */
  open(name: string, params: ScreenParams = {}): Screen {
    const screen = this.mount(name, params);
    // The bottom screen keeps the entry the app started on below it, so that a
    // back request with a dialog over it has an entry to spend on dismissing it.
    if (this.stack.length === 1) this.history?.replaceState?.({ bottom: true }, '');
    this.history?.pushState(this.entry, '');
    return screen;
  }

  /** Replaces the current screen. */
  replace(name: string, params: ScreenParams = {}): Screen {
    const top = this.stack.pop();
    if (top) this.dispose(top);
    const screen = this.mount(name, params);
    this.history?.replaceState?.(this.entry, '');
    return screen;
  }

  /**
   * Closes the current screen and shows the one below. The history goes back
   * too, and its popstate is what actually closes the screen.
   * @returns false when the bottom screen is already showing.
   */
  back(): boolean {
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
   * @returns false when there was nothing to close.
   */
  closeTop(): boolean {
    const top = this.current;
    if (!top || this.stack.length <= 1) return false;
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
  mount(name: string, params: ScreenParams): Screen {
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
  onPopState(event: { state?: unknown } | null) {
    const state = isRecord(event?.state) ? event.state : null;
    // The entry below the bottom screen: a dialog over home is what a back
    // request there means to close, and otherwise it means to leave the app.
    if (state?.bottom) {
      if (this.dismissOverlay()) this.history?.pushState(this.entry, '');
      else {
        // Nothing to leave to (an installed app, a fresh tab) leaves this entry
        // standing for the bottom screen, so the stack and the history agree.
        this.history?.replaceState?.(this.entry, '');
        this.history?.back?.();
      }
      return;
    }
    const wanted = state?.screens;
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

  /** Brings the open screens in line with the stack a history entry describes. */
  reconcile(wanted: HistoryScreen[]) {
    // Closes from the top until what is left is the start of the wanted stack.
    while (
      this.stack.length > wanted.length ||
      (this.stack.length > 1 && this.current?.name !== wanted[this.stack.length - 1].name)
    ) {
      if (!this.closeTop()) {
        // A screen kept itself open, so the entry it would have used goes back.
        this.history?.pushState(this.entry, '');
        return;
      }
    }
    // Reopens the rest, as far as they can be rebuilt.
    for (const { name, params } of wanted.slice(this.stack.length)) {
      if (params === null || !this.factories.has(name)) {
        // The entry stands for more than is open, so it is given up rather than
        // left one ahead of the screens, swallowing the next back press.
        this.history?.back?.();
        return;
      }
      this.mount(name, params);
    }
  }

  dispose({ screen }: OpenScreen) {
    try {
      screen.onHide?.();
      screen.destroy?.();
    } finally {
      // Always detaches, so a failing screen cannot leave an element catching taps.
      screen.el.remove();
    }
  }
}
