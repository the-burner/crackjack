// Entry point: renders the app's routes and registers the service worker.

import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { toast } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import { createServices } from '@/app/app';
import type { App } from '@/app/app';
import { router } from '@/app/routes';
import { confirm } from '@/components/dialogs';
import { AppContext } from '@/react/app-context';
import { applyTheme } from '@/lib/theme';

declare global {
  interface Window {
    /** The running app and its router, for debugging and the browser tests. */
    app: App & { router: typeof router };
  }
}

const app = createServices();
applyTheme(app.settings.get('display.theme'));
app.settings.subscribe((key, value) => {
  if (key === 'display.theme') applyTheme(value);
});

const root = document.getElementById('app');
if (!root) throw new Error('index.html has no #app element');
createRoot(root).render(
  <StrictMode>
    <AppContext.Provider value={app}>
      <RouterProvider router={router} />
    </AppContext.Provider>
  </StrictMode>,
);

// Storage can be blocked or full; the app still runs, but says so once.
app.storage.onWriteError = () => toast.error('Out of storage: this change will not be saved.');
if (!app.storage.persistent) toast.error('Storage is blocked: settings will not be saved.');

const updateServiceWorker = registerSW({
  async onNeedRefresh() {
    if (await confirm('A new version of Crackjack is ready.', { title: 'Update', yes: 'Reload', no: 'Later' }))
      void updateServiceWorker(true);
  },
  onRegisterError: err => console.warn('Service worker registration failed:', err),
});
void navigator.storage?.persist?.();

window.app = { ...app, router };
