// Renders a screen component the way reactScreen() does: inside the app and
// lifecycle providers, with a fresh in-memory app.
import type { ReactElement, ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { createServices } from '@/app/app';
import type { App } from '@/app/app';
import { MemoryBackend } from '@/services/storage';
import { createLifecycle, ScreenProviders } from '@/react/screen';
import { DialogHost } from '@/components/dialogs';

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
      {/* As at the app's root, so a screen's dialogs show and can be answered. */}
      <DialogHost />
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
