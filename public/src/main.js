// Entry point: creates the app, registers screens and shows the home screen.

import { createApp } from './app/app.js';
import { registerScreens } from './screens/index.js';
import { applyTheme } from './ui/theme.js';

const app = createApp(document.getElementById('app'));
applyTheme(app.settings.get('display.theme'));
app.settings.subscribe((key, value) => { if (key === 'display.theme') applyTheme(value); });
registerScreens(app.router);
app.router.open('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
    navigator.storage?.persist?.();
  });
}

window.app = app;
