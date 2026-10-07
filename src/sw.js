// Service worker: precaches every built file so the installed app runs fully
// offline. The file list is injected at build time by vite-plugin-pwa.

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST, { ignoreURLParametersMatching: [/.*/] });
cleanupOutdatedCaches();

// A navigation anywhere else is sent to the shell when offline, so the app's
// relative assets resolve under its own base rather than the link's.
const SHELL = new URL('./index.html', location.href).href;
registerRoute(
  ({ request }) => request.mode === 'navigate',
  ({ request }) => fetch(request).catch(() => Response.redirect(SHELL)),
);

// Sent by the page when the user accepts an update.
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      // Caches from before the Vite build were named cj-<version>.
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cj-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
