import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('service worker precache list', () => {
  it('lists every file the app serves (run `npm run precache` if this fails)', () => {
    expect(() => execFileSync('node', ['tools/update-precache.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
