// Renders a screen component the way reactScreen() does: inside the app and
// lifecycle providers, with a fresh in-memory app.
import type { ReactElement, ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { createServices } from '../../src/app/app.ts';
import type { App } from '../../src/app/app.ts';
import { MemoryBackend } from '../../src/services/storage.ts';
import { createLifecycle, ScreenProviders } from '../../src/react/screen.tsx';

/** An app whose navigation is mocked, so tests can assert on it. */
export type TestApp = App & { open: Mock<App['open']>; back: Mock<App['back']>; help: Mock<App['help']> };

export function createTestApp(): TestApp {
  return {
    ...createServices({ backend: new MemoryBackend() }),
    // No screen uses the router itself.
    router: {} as App['router'],
    open: vi.fn<App['open']>(),
    back: vi.fn<App['back']>(() => true),
    help: vi.fn<App['help']>(),
  };
}

export function renderScreen(ui: ReactElement, { app = createTestApp() }: { app?: TestApp } = {}) {
  const lifecycle = createLifecycle();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ScreenProviders app={app} lifecycle={lifecycle}>
      {children}
    </ScreenProviders>
  );
  return {
    ...render(ui, { wrapper }),
    app,
    lifecycle,
    /** What the router does when the screen comes back to the top. */
    show: () => act(() => lifecycle.show.forEach(fn => fn())),
  };
}
