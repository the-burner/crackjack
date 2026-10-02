// Entry point: creates the app, registers screens and shows the home screen.

import { createApp } from './app/app.js';
import { registerScreens } from './screens/index.js';

const app = createApp(document.getElementById('app'));
registerScreens(app.router);
app.router.open('home');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
    navigator.storage?.persist?.();
  });
}

window.app = app;
