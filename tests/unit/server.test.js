import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from '../../tools/server.mjs';

let server;
let base;

beforeAll(async () => {
  server = await startServer({ port: 0 });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

const get = path => fetch(base + path);

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
});
