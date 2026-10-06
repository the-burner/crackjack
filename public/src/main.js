// Entry point: creates the app, registers screens and shows the home screen.

import { createApp } from './app/app.js';
import { registerScreens } from './screens/index.js';
import { applyTheme } from './ui/theme.js';
import { toast } from './ui/toast.js';

const app = createApp(document.getElementById('app'));
applyTheme(app.settings.get('display.theme'));
app.settings.subscribe((key, value) => { if (key === 'display.theme') applyTheme(value); });
registerScreens(app.router);
app.router.open('home');

// Storage can be blocked or full; the app still runs, but says so once.
app.storage.onWriteError = () => toast('Out of storage: this change will not be saved.', { tone: 'error' });
if (!app.storage.persistent) toast('Storage is blocked: settings will not be saved.', { tone: 'error' });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
    navigator.storage?.persist?.();
  });
}

window.app = app;
