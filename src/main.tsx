// Entry point: creates the app, registers screens and shows the home screen.

import './index.css';

import { createApp } from './app/app';
import type { App } from './app/app';
import { registerScreens } from './screens/index';
import { applyTheme } from './ui/theme';
import { toast } from './ui/toast';
import { confirm } from './ui/dialogs';
import { registerSW } from 'virtual:pwa-register';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { AppContext } from '@/react/app-context';
import { OverlayRoot } from '@/components/overlay-root';

declare global {
  interface Window {
    /** The running app, for debugging and the browser tests. */
    app: App;
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('index.html has no #app element');
const app = createApp(root);
applyTheme(app.settings.get('display.theme'));
app.settings.subscribe((key, value) => {
  if (key === 'display.theme') applyTheme(value);
});
registerScreens(app.router);
app.router.open('home');

// Dialogs and toasts, above every screen.
createRoot(document.body.appendChild(document.createElement('div'))).render(
  <StrictMode>
    <AppContext.Provider value={app}>
      <OverlayRoot />
    </AppContext.Provider>
  </StrictMode>,
);

// Storage can be blocked or full; the app still runs, but says so once.
app.storage.onWriteError = () => toast('Out of storage: this change will not be saved.', { tone: 'error' });
if (!app.storage.persistent) toast('Storage is blocked: settings will not be saved.', { tone: 'error' });

const updateServiceWorker = registerSW({
  async onNeedRefresh() {
    if (await confirm('A new version of Crackjack is ready.', { title: 'Update', yes: 'Reload', no: 'Later' }))
      updateServiceWorker(true);
  },
  onRegisterError: err => console.warn('Service worker registration failed:', err),
});
navigator.storage?.persist?.();

window.app = app;
