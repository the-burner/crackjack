import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const SHELL = 'https://example.test/index.html';

/** Runs public/sw.js with stand-ins for the worker globals; returns its fetch handler. */
function serviceWorker({ cached = new Map([['./index.html', { shell: true }]]) } = {}) {
  const listeners = {};
  const self = { addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting() {}, clients: { claim() {} } };
  const caches = {
    match: key => Promise.resolve(cached.get(typeof key === 'string' ? key : key.url)),
    open: () => Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
  };
  const location = { origin: 'https://example.test', href: 'https://example.test/sw.js' };
  const Response = { redirect: url => ({ redirectTo: url }), error: () => ({ type: 'error' }) };
  const fetch = () => Promise.reject(new Error('offline'));
  const source = fs.readFileSync('public/sw.js', 'utf8');
  new Function('self', 'caches', 'location', 'Response', 'fetch', source)(self, caches, location, Response, fetch);
  return request => new Promise(resolve => listeners.fetch({ request, respondWith: resolve }));
}

describe('the service worker offline', () => {
  it('sends a deep link to the shell instead of serving the shell in its place', async () => {
    const sw = serviceWorker();
    const response = await sw({ method: 'GET', url: 'https://example.test/some/deep/link', mode: 'navigate' });
    // Served in place, every relative asset would resolve under /some/deep/.
    expect(response.redirectTo).toBe(SHELL);
  });

  it('does not redirect the shell to itself when that is missing too', async () => {
    const sw = serviceWorker({ cached: new Map() });
    const response = await sw({ method: 'GET', url: SHELL, mode: 'navigate' });
    expect(response).toEqual({ type: 'error' });
  });

  it('fails a missing sub-resource outright', async () => {
    const sw = serviceWorker();
    const response = await sw({ method: 'GET', url: 'https://example.test/src/main.js', mode: 'cors' });
    expect(response.type).toBe('error');
  });
});
