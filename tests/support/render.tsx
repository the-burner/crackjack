// Renders a screen component as the app does: inside the app's services and a
// router, with a fresh in-memory app. The screen sits at `path`, one entry
// after the home page, so Back has somewhere to go.
import type { ReactElement } from 'react';
import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createServices } from '@/app/app';
import type { App } from '@/app/app';
import { helpState } from '@/app/help';
import type { HelpPage } from '@/app/help';
import { MemoryBackend } from '@/services/storage';
import { AppContext } from '@/react/app-context';
import { DialogHost } from '@/components/dialogs';

export type TestApp = App;

const helpOf = (router: { state: { location: { state: unknown } } }): HelpPage | null =>
  (router.state.location.state as { help?: HelpPage } | null)?.help ?? null;

export function createTestApp(): TestApp {
  return createServices({ backend: new MemoryBackend() });
}

export function renderScreen(
  ui: ReactElement,
  { app = createTestApp(), path = '/screen' }: { app?: TestApp; path?: string } = {},
) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Home</p> },
      // Every other path shows the screen, so navigating away is seen in the location only.
      {
        path: '*',
        element: (
          <>
            {ui}
            {/* As at the app's root, so a screen's dialogs show and can be answered. */}
            <DialogHost />
          </>
        ),
      },
    ],
    { initialEntries: ['/', path], initialIndex: 1 },
  );
  const result = render(
    <AppContext.Provider value={app}>
      <RouterProvider router={router} />
    </AppContext.Provider>,
  );
  return {
    ...result,
    app,
    router,
    /** Where the screen has navigated to. */
    location: () => router.state.location,
    /** The help page's topic and title, when open. */
    help: () => helpOf(router),
    /** Covers the screen (with a help page), as another screen would. */
    cover: () => act(() => void router.navigate(router.state.location, { state: helpState('test') })),
    /** Uncovers it again. */
    show: () =>
      act(() => {
        if (helpOf(router)) void router.navigate(-1);
      }),
  };
}
