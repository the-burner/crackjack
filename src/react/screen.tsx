// React screens for the router: a component rendered into the screen's element,
// with the router's lifecycle passed on through hooks.

import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { App, Screen, ScreenFactory, ScreenParams } from '../app/app.ts';
import { AppContext } from './app-context.ts';

type Handler = () => boolean | void;
/** The handlers a screen's components registered for the router's calls. */
export type Lifecycle = Record<'show' | 'hide' | 'back', Set<Handler>>;

export const createLifecycle = (): Lifecycle => ({ show: new Set(), hide: new Set(), back: new Set() });

const LifecycleContext = createContext<Lifecycle | null>(null);

function useLifecycle(): Lifecycle {
  const lifecycle = useContext(LifecycleContext);
  if (!lifecycle) throw new Error('Screen hooks need a screen built by reactScreen()');
  return lifecycle;
}

/** Registers `fn` for one lifecycle event, always calling the latest render's `fn`. */
function useScreenEvent(event: keyof Lifecycle, fn: Handler) {
  const lifecycle = useLifecycle();
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  useLayoutEffect(() => {
    const call = () => latest.current();
    lifecycle[event].add(call);
    return () => {
      lifecycle[event].delete(call);
    };
  }, [lifecycle, event]);
}

/** Called each time the screen comes to the top of the stack, including the first. */
export const useOnShow = (fn: () => void) => useScreenEvent('show', fn);
/** Called when another screen covers this one, and before it closes. */
export const useOnHide = (fn: () => void) => useScreenEvent('hide', fn);
/** Return true to handle a back request instead of closing the screen. */
export const useOnBack = (fn: () => boolean | void) => useScreenEvent('back', fn);

export type ScreenProps<P extends ScreenParams> = { params: P };

/** What a screen's components need around them: the app, and the lifecycle hooks. */
export function ScreenProviders({ app, lifecycle, children }: { app: App; lifecycle: Lifecycle; children: ReactNode }) {
  return (
    <AppContext.Provider value={app}>
      <LifecycleContext.Provider value={lifecycle}>{children}</LifecycleContext.Provider>
    </AppContext.Provider>
  );
}

/**
 * A screen factory rendering `Component` into a `<section>` with `className`.
 * The first render happens before the factory returns, so the router shows a
 * finished screen.
 */
export function reactScreen<P extends ScreenParams = ScreenParams>(
  Component: (props: ScreenProps<P>) => ReactNode,
  { className = '' }: { className?: string } = {},
): ScreenFactory<P> {
  return (app: App, params: P): Screen => {
    const el = document.createElement('section');
    if (className) el.className = className;
    const lifecycle = createLifecycle();
    const root = createRoot(el);
    flushSync(() =>
      root.render(
        <ScreenProviders app={app} lifecycle={lifecycle}>
          <Component params={params} />
        </ScreenProviders>,
      ),
    );
    return {
      el,
      onShow: () => lifecycle.show.forEach(fn => fn()),
      onHide: () => lifecycle.hide.forEach(fn => fn()),
      onBack: () => [...lifecycle.back].some(fn => fn() === true),
      // Deferred: the close may come from one of this root's own event handlers.
      destroy: () => queueMicrotask(() => root.unmount()),
    };
  };
}
