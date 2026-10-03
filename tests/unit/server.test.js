import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startServer } from '../../tools/server.mjs';

let server;
let base;

beforeAll(async () => {
  server = await startServer({ port: 0 });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

// Node's own fetch talks to the test server; only qfit.com requests are faked.
const realFetch = globalThis.fetch;
const get = path => realFetch(base + path);

describe('the app server', () => {
  it('serves the app shell, its modules and assets with the right types', async () => {
    const index = await get('/');
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    expect(await index.text()).toContain('src/main.js');
    expect((await get('/src/main.js')).headers.get('content-type')).toContain('text/javascript');
    expect((await get('/assets/cards/cards.png')).headers.get('content-type')).toBe('image/png');
    expect((await get('/manifest.webmanifest')).status).toBe(200);
    expect((await get('/sw.js')).status).toBe(200);
  });

  it('does not serve the rest of the repository', async () => {
    for (const path of ['/package.json', '/.git/config', '/tests/unit/server.test.js', '/tools/server.mjs', '/.certs/x.pem', '/src/../package.json']) {
      expect((await get(path)).status, path).not.toBe(200);
    }
  });

  it('answers 404 for missing files and 400 for malformed paths', async () => {
    expect((await get('/src/nope.js')).status).toBe(404);
    expect((await get('/src/%E0%A4%A')).status).toBe(400);
  });

  it('forwards /apps/ requests to qfit.com, keeping the path and query', async () => {
    const seen = [];
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (!String(url).startsWith('https://www.qfit.com')) return realFetch(url, options);
      seen.push(String(url));
      return new Response('|My Strategy|UUU', { status: 200, headers: { 'content-type': 'text/html' } });
    });
    try {
      const res = await get('/Apps/z123.php');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('|My Strategy|UUU');
      await get('/apps/cbjn7.php?a=1&b=1');
      expect(seen).toEqual(['https://www.qfit.com/Apps/z123.php', 'https://www.qfit.com/apps/cbjn7.php?a=1&b=1']);
    } finally {
      spy.mockRestore();
    }
  });

  it('answers 502 when qfit.com cannot be reached', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (!String(url).startsWith('https://www.qfit.com')) return realFetch(url, options);
      throw new Error('offline');
    });
    try {
      expect((await get('/Apps/z1.php')).status).toBe(502);
    } finally {
      spy.mockRestore();
    }
  });
});
